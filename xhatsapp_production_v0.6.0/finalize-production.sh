#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ ${EUID} -eq 0 ]] || { echo "Lancez avec sudo." >&2; exit 1; }
session_id=${1:-}
[[ ${session_id} =~ ^[0-9a-fA-F-]{36}$ ]] || { echo "Usage: sudo ./finalize-production.sh <UUID-session-OpenWA>" >&2; exit 1; }
source_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project=/opt/xhatsapp
env_file=${project}/.env
compose=(docker compose --env-file "${env_file}" -f "${project}/docker-compose.yml")
master_key=$(sed -n 's/^OPENWA_API_MASTER_KEY=//p' "${env_file}")
domain=$(sed -n 's/^DOMAIN=//p' "${env_file}")
webhook_secret=$(sed -n 's/^OPENWA_WEBHOOK_SECRET=//p' "${env_file}")
[[ -n ${master_key} && -n ${domain} && -n ${webhook_secret} ]] || { echo "Configuration incomplète" >&2; exit 1; }

status=$(curl -fsS -H "X-API-Key: ${master_key}" http://127.0.0.1:2785/api/sessions | jq -r --arg id "${session_id}" '.[]|select(.id==$id)|.status')
[[ ${status} == ready ]] || { echo "La session OpenWA n'est pas prête" >&2; exit 1; }

key_payload=$(mktemp)
jq -nc --arg sid "${session_id}" '{name:"xhatsapp-production",role:"operator",allowedSessions:[$sid]}' >"${key_payload}"
key_response=$(mktemp)
curl -fsS -X POST -H 'Content-Type: application/json' -H "X-API-Key: ${master_key}" \
  --data-binary "@${key_payload}" http://127.0.0.1:2785/api/auth/api-keys >"${key_response}"
operator_key=$(jq -r '.key // .apiKey // .token // empty' "${key_response}")
rm -f "${key_payload}" "${key_response}"
[[ ${#operator_key} -ge 32 ]] || { echo "Clé opérateur non retournée par OpenWA" >&2; exit 1; }

python3 - "${env_file}" "${session_id}" "${operator_key}" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
updates = {"OPENWA_SESSION_ID": sys.argv[2], "XHATSAPP_OPENWA_API_KEY": sys.argv[3]}
lines = path.read_text().splitlines()
seen = set()
out = []
for line in lines:
    key = line.split("=", 1)[0]
    if key in updates:
        out.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n")
PY
chown root:xhatsapp "${env_file}"
chmod 0640 "${env_file}"

curl -fsS -H "X-API-Key: ${master_key}" \
  "http://127.0.0.1:2785/api/sessions/${session_id}/groups?limit=500&offset=0" \
  -o "${project}/config/openwa-groups.json"
chown root:xhatsapp "${project}/config/openwa-groups.json"
chmod 0640 "${project}/config/openwa-groups.json"

"${compose[@]}" build --no-cache webhook
"${compose[@]}" up -d webhook
for _ in $(seq 1 40); do
  [[ $(docker inspect xhatsapp-webhook --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]] && break
  sleep 3
done
[[ $(curl -fsS http://127.0.0.1:3000/health | jq -r '.version') == 0.6.0 ]]

webhook_payload=$(mktemp)
jq -nc --arg url "https://${domain}/webhook/openwa" --arg secret "${webhook_secret}" \
  '{url:$url,events:["message.received"],secret:$secret,retryCount:3}' >"${webhook_payload}"
webhook_response=$(mktemp)
curl -fsS -X POST -H 'Content-Type: application/json' -H "X-API-Key: ${master_key}" \
  --data-binary "@${webhook_payload}" \
  "http://127.0.0.1:2785/api/sessions/${session_id}/webhooks" >"${webhook_response}"
webhook_id=$(jq -r '.id // empty' "${webhook_response}")
rm -f "${webhook_payload}" "${webhook_response}"
[[ -n ${webhook_id} ]] || { echo "Webhook OpenWA non créé" >&2; exit 1; }

python3 - "${env_file}" "${webhook_id}" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
lines = [line for line in path.read_text().splitlines() if not line.startswith("OPENWA_WEBHOOK_ID=")]
lines.append(f"OPENWA_WEBHOOK_ID={sys.argv[2]}")
path.write_text("\n".join(lines) + "\n")
PY
chown root:xhatsapp "${env_file}"
chmod 0640 "${env_file}"

bash "${source_dir}/ops/install.sh"
unset master_key webhook_secret operator_key
echo "Xhatsapp 0.6.0 est installé. Vérifiez OmniRoute, puis configurez les rôles de groupes dans la console privée."
