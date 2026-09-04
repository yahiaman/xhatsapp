#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ ${EUID} -eq 0 ]] || { echo "Lancez avec sudo." >&2; exit 1; }
model=${1:-}
[[ -n ${model} && ${model} != pending && ${model} != *[[:space:]]* ]] || {
  echo "Usage: sudo ./configure-omniroute.sh <identifiant-modele>" >&2
  exit 1
}
project=/opt/xhatsapp
env_file=${project}/.env
compose=(docker compose --env-file "${env_file}" -f "${project}/docker-compose.yml")
[[ -r ${env_file} ]] || { echo "Configuration Xhatsapp absente" >&2; exit 1; }
[[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]] || {
  echo "OmniRoute n'est pas sain" >&2
  exit 1
}

read -r -s -p "Clé d'endpoint OmniRoute : " api_key
echo
[[ ${#api_key} -ge 16 && ${api_key} != pending ]] || { echo "Clé OmniRoute invalide" >&2; exit 1; }

models_file=$(mktemp)
key_file=$(mktemp)
trap 'rm -f "${models_file}" "${key_file}"' EXIT
printf '%s' "${api_key}" >"${key_file}"
printf 'header = "Authorization: Bearer %s"\n' "${api_key}" |
  curl -fsS --max-time 30 --config - \
    http://127.0.0.1:20128/v1/models >"${models_file}"
jq -e --arg model "${model}" '.data | any(.id == $model)' "${models_file}" >/dev/null || {
  echo "Le modèle ${model} n'est pas proposé par cet endpoint OmniRoute." >&2
  echo "Modèles disponibles :"
  jq -r '.data[].id' "${models_file}" | head -n 30
  exit 1
}

python3 - "${env_file}" "${key_file}" "${model}" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
api_key = pathlib.Path(sys.argv[2]).read_text()
updates = {
    "SUMMARY_PROVIDER": "omniroute",
    "SUMMARY_API_URL": "http://omniroute:20128/v1",
    "SUMMARY_API_KEY": api_key,
    "SUMMARY_MODEL": sys.argv[3],
}
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

if docker inspect xhatsapp-webhook >/dev/null 2>&1; then
  "${compose[@]}" up -d --no-deps --force-recreate webhook
  for _ in $(seq 1 30); do
    [[ $(docker inspect xhatsapp-webhook --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]] && break
    sleep 3
  done
  [[ $(docker inspect xhatsapp-webhook --format '{{.State.Health.Status}}') == healthy ]]
fi

unset api_key
echo "OmniRoute configuré pour Xhatsapp avec le modèle ${model}."
