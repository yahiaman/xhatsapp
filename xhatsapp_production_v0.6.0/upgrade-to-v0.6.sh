#!/usr/bin/env bash
set -Eeuo pipefail

project=/opt/xhatsapp
source_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
backup_root=/var/backups/xhatsapp
stamp=$(date +%Y%m%d_%H%M%S)
backup_dir="${backup_root}/webhook-v051-${stamp}"
compose=(docker compose --env-file "${project}/.env" -f "${project}/docker-compose.yml")

if [[ ${EUID} -ne 0 ]]; then echo "Lancez ce script avec sudo." >&2; exit 1; fi
for path in "${project}/.env" "${project}/docker-compose.yml" "${project}/webhook" "${source_dir}/docker-compose.yml" "${source_dir}/webhook"; do
  [[ -e ${path} ]] || { echo "Fichier requis absent : ${path}" >&2; exit 1; }
done

rollback() {
  local exit_code=$?
  trap - ERR
  echo "Échec du déploiement ; restauration de la version précédente…" >&2
  install -o root -g xhatsapp -m 0640 "${backup_dir}/docker-compose.yml" "${project}/docker-compose.yml"
  install -o root -g xhatsapp -m 0640 "${backup_dir}/.env" "${project}/.env"
  mv "${project}/webhook" "${project}/webhook-v051-failed-${stamp}"
  cp -a "${backup_dir}/webhook" "${project}/webhook"
  "${compose[@]}" build webhook
  "${compose[@]}" up -d --no-deps --force-recreate webhook
  docker stop xhatsapp-omniroute >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap rollback ERR

mkdir -p "${backup_dir}"
cp -a "${project}/webhook" "${backup_dir}/webhook"
cp -a "${project}/docker-compose.yml" "${backup_dir}/docker-compose.yml"
cp -a "${project}/.env" "${backup_dir}/.env"
chmod -R go-rwx "${backup_dir}"

install -o root -g xhatsapp -m 0640 "${source_dir}/docker-compose.yml" "${project}/docker-compose.yml"
cp -a "${source_dir}/webhook/." "${project}/webhook/"
chown -R root:xhatsapp "${project}/webhook"
find "${project}/webhook" -type d -exec chmod 0750 {} \;
find "${project}/webhook" -type f -exec chmod 0640 {} \;

docker pull diegosouzapw/omniroute:3.8.50
omniroute_image=$(docker image inspect diegosouzapw/omniroute:3.8.50 --format '{{index .RepoDigests 0}}')
omniroute_image=${omniroute_image#docker.io/}
[[ ${omniroute_image} =~ ^diegosouzapw/omniroute@sha256:[0-9a-f]{64}$ ]] || { echo "Digest OmniRoute invalide" >&2; false; }
if grep -q '^OMNIROUTE_IMAGE=' "${project}/.env"; then
  sed -i "s|^OMNIROUTE_IMAGE=.*|OMNIROUTE_IMAGE=${omniroute_image}|" "${project}/.env"
else
  printf '\nOMNIROUTE_IMAGE=%s\n' "${omniroute_image}" >>"${project}/.env"
fi
grep -q '^OMNIROUTE_INITIAL_PASSWORD=' "${project}/.env" || printf 'OMNIROUTE_INITIAL_PASSWORD=%s\n' "$(openssl rand -hex 32)" >>"${project}/.env"
grep -q '^OMNIROUTE_WS_BRIDGE_SECRET=' "${project}/.env" || printf 'OMNIROUTE_WS_BRIDGE_SECRET=%s\n' "$(openssl rand -hex 32)" >>"${project}/.env"
grep -q '^SUMMARY_PROVIDER=' "${project}/.env" || printf 'SUMMARY_PROVIDER=omniroute\n' >>"${project}/.env"
grep -q '^SUMMARY_API_URL=' "${project}/.env" || printf 'SUMMARY_API_URL=http://omniroute:20128/v1\n' >>"${project}/.env"
grep -q '^SUMMARY_API_KEY=' "${project}/.env" || printf 'SUMMARY_API_KEY=pending\n' >>"${project}/.env"
grep -q '^SUMMARY_MODEL=' "${project}/.env" || printf 'SUMMARY_MODEL=pending\n' >>"${project}/.env"
grep -q '^OLLAMA_IMAGE=' "${project}/.env" || printf 'OLLAMA_IMAGE=ollama/ollama:latest\n' >>"${project}/.env"
grep -q '^OLLAMA_MODEL=' "${project}/.env" || printf 'OLLAMA_MODEL=gemma4:12b\n' >>"${project}/.env"
[[ ${omniroute_image} =~ ^diegosouzapw/omniroute@sha256:[0-9a-f]{64}$ ]] || { echo "Référence OmniRoute non verrouillée" >&2; false; }

"${compose[@]}" config --quiet
node_image=$(sed -n 's/^WEBHOOK_NODE_IMAGE=//p' "${project}/.env")
[[ ${node_image} =~ ^node@sha256:[0-9a-f]{64}$ ]] || { echo "Référence Node.js invalide" >&2; false; }
docker run --rm -v "${project}/webhook:/app:ro" -w /app "${node_image}" npm run check
docker run --rm -v "${project}/webhook:/app:ro" -w /app "${node_image}" npm test

# Les versions récentes d'OmniRoute s'exécutent avec l'UID 1000. Une ancienne
# installation peut avoir créé storage.sqlite avec root comme propriétaire.
"${compose[@]}" stop omniroute >/dev/null 2>&1 || true
docker volume create xhatsapp-omniroute-data >/dev/null
docker run --rm \
  --user 0:0 \
  --volume xhatsapp-omniroute-data:/app/data \
  --entrypoint /bin/sh \
  "${omniroute_image}" \
  -c 'chown -R 1000:1000 /app/data && chmod -R u+rwX /app/data'
unset omniroute_image

"${compose[@]}" up -d omniroute
for _ in $(seq 1 30); do
  if [[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]]; then break; fi
  sleep 3
done
[[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}') == healthy ]]

"${compose[@]}" build --no-cache webhook
"${compose[@]}" up -d --no-deps --force-recreate webhook

for _ in $(seq 1 30); do
  if [[ $(docker inspect xhatsapp-webhook --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]]; then break; fi
  sleep 3
done
[[ $(docker inspect xhatsapp-webhook --format '{{.State.Health.Status}}') == healthy ]]
[[ $(curl -fsS http://127.0.0.1:3000/health | jq -r '.version') == 0.6.0 ]]
[[ $("${compose[@]}" exec -T postgres psql -U xhatsapp -d xhatsapp -Atc \
  "SELECT count(*) FROM schema_migrations WHERE version='006_daily_recaps';") == 1 ]]

bash "${source_dir}/ops/install.sh"

trap - ERR
echo "Xhatsapp 0.6.0 déployé et sain."
echo "Sauvegarde : ${backup_dir}"
