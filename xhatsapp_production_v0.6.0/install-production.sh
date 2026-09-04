#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ ${EUID} -eq 0 ]] || { echo "Lancez avec sudo." >&2; exit 1; }
domain=${1:-}
admin_user=${2:-${SUDO_USER:-}}
[[ ${domain} =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Usage: sudo ./install-production.sh <domaine> <utilisateur-admin>" >&2; exit 1; }
[[ -n ${admin_user} && ${admin_user} != root ]] || { echo "Utilisateur administrateur invalide" >&2; exit 1; }
for command_name in docker curl jq openssl; do command -v "${command_name}" >/dev/null || { echo "Commande absente : ${command_name}" >&2; exit 1; }; done
[[ $(nproc) -ge 4 ]] || { echo "4 vCPU minimum requis" >&2; exit 1; }
[[ $(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo) -ge 14000 ]] || { echo "16 Go de RAM recommandés" >&2; exit 1; }

source_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project=/opt/xhatsapp
[[ ! -e ${project}/.env ]] || { echo "Installation existante détectée; utilisez upgrade-to-v0.6.sh" >&2; exit 1; }
getent group xhatsapp >/dev/null || groupadd --system xhatsapp
usermod -a -G xhatsapp "${admin_user}"
install -d -o root -g xhatsapp -m 0750 "${project}" "${project}/caddy" "${project}/config" "${project}/scripts" "${project}/webhook"
cp -a "${source_dir}/webhook/." "${project}/webhook/"
install -o root -g xhatsapp -m 0640 "${source_dir}/docker-compose.yml" "${project}/docker-compose.yml"
install -o root -g xhatsapp -m 0640 "${source_dir}/caddy/Caddyfile" "${project}/caddy/Caddyfile"
install -o root -g xhatsapp -m 0750 "${source_dir}/config/postgres-init.sh" "${project}/config/postgres-init.sh"
install -o root -g xhatsapp -m 0640 "${source_dir}/config/openwa-groups.json" "${project}/config/openwa-groups.json"
chown -R root:xhatsapp "${project}/webhook"
find "${project}/webhook" -type d -exec chmod 0750 {} \;
find "${project}/webhook" -type f -exec chmod 0640 {} \;

pin_image() {
  local tag=$1 expected=$2 ref
  docker pull "${tag}" >/dev/null
  ref=$(docker image inspect "${tag}" --format '{{index .RepoDigests 0}}')
  [[ ${ref} == "${expected}@sha256:"* || ${ref} == "docker.io/library/${expected}@sha256:"* || ${ref} == "docker.io/${expected}@sha256:"* ]] || { echo "Digest inattendu pour ${tag}: ${ref}" >&2; return 1; }
  ref=${ref#docker.io/}
  ref=${ref#library/}
  printf '%s' "${ref}"
}

postgres_image=$(pin_image postgres:16-alpine postgres)
redis_image=$(pin_image redis:7.4-alpine redis)
caddy_image=$(pin_image caddy:2.11.4-alpine caddy)
node_image=$(pin_image node:24-alpine node)
omniroute_image=$(pin_image diegosouzapw/omniroute:3.8.50 diegosouzapw/omniroute)
group_gid=$(getent group xhatsapp | cut -d: -f3)
secret() { openssl rand -hex 32; }

env_tmp=$(mktemp)
printf '%s\n' \
  'COMPOSE_PROJECT_NAME=xhatsapp' \
  'TZ=Europe/Paris' \
  "DOMAIN=${domain}" \
  "POSTGRES_IMAGE=${postgres_image}" \
  "REDIS_IMAGE=${redis_image}" \
  'OPENWA_IMAGE=rmyndharis/openwa@sha256:c00b5b589446ce7dd6177f1b871789284bcfbe3612189ba109465025eb0ad4ec' \
  "CADDY_IMAGE=${caddy_image}" \
  "WEBHOOK_NODE_IMAGE=${node_image}" \
  "OMNIROUTE_IMAGE=${omniroute_image}" \
  'OLLAMA_IMAGE=ollama/ollama:latest' \
  'OLLAMA_MODEL=gemma4:12b' \
  'SUMMARY_PROVIDER=omniroute' \
  'SUMMARY_API_URL=http://omniroute:20128/v1' \
  'SUMMARY_API_KEY=pending' \
  'SUMMARY_MODEL=pending' \
  'OPENWA_ENGINE_TYPE=whatsapp-web.js' \
  'OPENWA_DATABASE_NAME=openwa' \
  'OPENWA_DATABASE_USERNAME=openwa' \
  'XHATSAPP_DATABASE_NAME=xhatsapp' \
  'XHATSAPP_DATABASE_USERNAME=xhatsapp' \
  "POSTGRES_PASSWORD=$(secret)" \
  "OPENWA_DB_PASSWORD=$(secret)" \
  "XHATSAPP_DB_PASSWORD=$(secret)" \
  "REDIS_PASSWORD=$(secret)" \
  "OPENWA_API_MASTER_KEY=$(secret)" \
  "OPENWA_API_KEY_PEPPER=$(secret)" \
  "OPENWA_WEBHOOK_SECRET=$(secret)" \
  "XHATSAPP_ADMIN_TOKEN=$(secret)" \
  "OMNIROUTE_INITIAL_PASSWORD=$(secret)" \
  "OMNIROUTE_WS_BRIDGE_SECRET=$(secret)" \
  'OPENWA_SESSION_ID=pending' \
  'XHATSAPP_OPENWA_API_KEY=pending' \
  'BROADCAST_SEND_DELAY_MS=750' \
  "XHATSAPP_GROUP_GID=${group_gid}" >"${env_tmp}"
install -o root -g xhatsapp -m 0640 "${env_tmp}" "${project}/.env"
rm -f "${env_tmp}"

# OmniRoute 3.8.50 s'exécute avec l'UID 1000. Préparer explicitement le
# volume nommé évite une base SQLite en lecture seule au premier démarrage.
docker volume create xhatsapp-omniroute-data >/dev/null
docker run --rm \
  --user 0:0 \
  --volume xhatsapp-omniroute-data:/app/data \
  --entrypoint /bin/sh \
  "${omniroute_image}" \
  -c 'chown -R 1000:1000 /app/data && chmod -R u+rwX /app/data'

unset postgres_image redis_image caddy_image node_image omniroute_image group_gid

compose=(docker compose --env-file "${project}/.env" -f "${project}/docker-compose.yml")
"${compose[@]}" config --quiet
"${compose[@]}" up -d postgres redis openwa omniroute caddy
for _ in $(seq 1 60); do
  [[ $(docker inspect xhatsapp-openwa --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]] &&
  [[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]] && break
  sleep 5
done
[[ $(docker inspect xhatsapp-openwa --format '{{.State.Health.Status}}') == healthy ]]
[[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}') == healthy ]]

echo "Infrastructure installée. Configurez OmniRoute par tunnel SSH, associez WhatsApp dans OpenWA, puis lancez finalize-production.sh."
