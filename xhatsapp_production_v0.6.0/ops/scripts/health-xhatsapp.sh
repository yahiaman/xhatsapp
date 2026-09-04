#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

project=/opt/xhatsapp
state_dir=/var/lib/xhatsapp-monitor
state_file="${state_dir}/state"
compose=(docker compose --env-file "${project}/.env" -f "${project}/docker-compose.yml")
errors=()

add_error() { errors+=("$1"); }

for container in xhatsapp-postgres xhatsapp-redis xhatsapp-openwa xhatsapp-omniroute xhatsapp-webhook xhatsapp-caddy; do
  status=$(docker inspect "${container}" --format '{{.State.Status}}' 2>/dev/null || true)
  health=$(docker inspect "${container}" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
  [[ ${status} == running ]] || add_error "${container}:not_running"
  [[ ${health} == healthy || ${health} == none ]] || add_error "${container}:health_${health}"
done

curl -fsS --max-time 10 http://127.0.0.1:2785/api/health/ready >/dev/null || add_error "openwa:ready_failed"
version=$(curl -fsS --max-time 10 http://127.0.0.1:3000/health 2>/dev/null | jq -r '.version // empty' || true)
[[ ${version} == 0.6.0 ]] || add_error "webhook:version_or_health_failed"
curl -fsS --max-time 10 http://127.0.0.1:20128/api/monitoring/health >/dev/null || add_error "omniroute:health_failed"
summary_key=$(sed -n 's/^SUMMARY_API_KEY=//p' "${project}/.env")
summary_model=$(sed -n 's/^SUMMARY_MODEL=//p' "${project}/.env")
if [[ -z ${summary_key} || ${summary_key} == pending || -z ${summary_model} || ${summary_model} == pending ]]; then
  summary_state=pending
else
  summary_state=configured
  printf 'header = "Authorization: Bearer %s"\n' "${summary_key}" |
    curl -fsS --max-time 20 --config - http://127.0.0.1:20128/v1/models |
    jq -e --arg model "${summary_model}" \
    '.data | any(.id == $model)' >/dev/null || add_error "summary:model_or_key_invalid"
fi
unset summary_key summary_model
"${compose[@]}" exec -T postgres psql -U xhatsapp -d xhatsapp -Atc 'SELECT 1' 2>/dev/null | grep -qx 1 || add_error "postgres:query_failed"

domain=$(sed -n 's/^DOMAIN=//p' "${project}/.env")
[[ -n ${domain} ]] || add_error "config:domain_missing"
if [[ -n ${domain} ]]; then
  curl -fsS --max-time 15 "https://${domain}/api/health/ready" >/dev/null || add_error "public_https:failed"
  timeout 15 openssl s_client -connect "${domain}:443" -servername "${domain}" </dev/null 2>/dev/null |
    openssl x509 -checkend 1209600 -noout >/dev/null 2>&1 || add_error "tls:expires_within_14d"
fi

disk_percent=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
[[ ${disk_percent} =~ ^[0-9]+$ && ${disk_percent} -lt 85 ]] || add_error "disk:usage_${disk_percent:-unknown}"

latest=$(readlink -f /var/backups/xhatsapp/latest 2>/dev/null || true)
if [[ -z ${latest} || ! -d ${latest} ]]; then
  add_error "backup:missing"
else
  age=$(( $(date +%s) - $(stat -c %Y "${latest}") ))
  (( age < 129600 )) || add_error "backup:older_than_36h"
  [[ -s ${latest}/SHA256SUMS ]] || add_error "backup:manifest_missing"
fi

install -d -o root -g root -m 0700 "${state_dir}"
previous_status=unknown
previous_epoch=0
if [[ -s ${state_file} ]]; then IFS='|' read -r previous_status previous_epoch <"${state_file}" || true; fi
now=$(date +%s)

send_admin_message() {
  local text=$1 api_key session_id encoded_session admin_chat payload
  api_key=$(sed -n 's/^XHATSAPP_OPENWA_API_KEY=//p' "${project}/.env")
  session_id=$(sed -n 's/^OPENWA_SESSION_ID=//p' "${project}/.env")
  admin_chat=$("${compose[@]}" exec -T postgres psql -U xhatsapp -d xhatsapp -Atc \
    "SELECT chat_id FROM whatsapp_groups WHERE enabled=true AND is_admin=true ORDER BY updated_at DESC LIMIT 1;" 2>/dev/null || true)
  [[ -n ${api_key} && -n ${session_id} && -n ${admin_chat} ]] || return 1
  encoded_session=$(jq -rn --arg value "${session_id}" '$value|@uri')
  payload=$(jq -nc --arg chatId "${admin_chat}" --arg text "${text}" '{chatId:$chatId,text:$text}')
  curl -fsS --max-time 15 -X POST -H 'Content-Type: application/json' \
    -H "X-API-Key: ${api_key}" --data-binary "${payload}" \
    "http://127.0.0.1:2785/api/sessions/${encoded_session}/messages/send-text" >/dev/null
}

if (( ${#errors[@]} > 0 )); then
  summary=$(IFS=', '; echo "${errors[*]}")
  if [[ ${previous_status} != failed ]] || (( now - previous_epoch >= 3600 )); then
    send_admin_message "⚠️ Supervision Xhatsapp : anomalie détectée (${summary}). Consultez la VM." || true
    previous_epoch=${now}
  fi
  printf 'failed|%s\n' "${previous_epoch}" >"${state_file}"
  echo "health_failed errors=${summary}" >&2
  exit 1
fi

if [[ ${previous_status} == failed ]]; then
  send_admin_message "✅ Supervision Xhatsapp : tous les contrôles sont de nouveau opérationnels." || true
fi
printf 'healthy|%s\n' "${now}" >"${state_file}"
echo "health_ok version=${version} disk=${disk_percent}% summary=${summary_state:-unknown}"
