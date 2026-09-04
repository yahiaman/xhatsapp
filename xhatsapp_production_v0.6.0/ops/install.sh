#!/usr/bin/env bash
set -Eeuo pipefail

source_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project=/opt/xhatsapp

[[ ${EUID} -eq 0 ]] || { echo "Lancez avec sudo." >&2; exit 1; }
for path in "${project}/.env" "${project}/docker-compose.yml" "${source_dir}/scripts" "${source_dir}/systemd"; do
  [[ -e ${path} ]] || { echo "Chemin requis absent : ${path}" >&2; exit 1; }
done
if ! command -v pg_restore >/dev/null; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-client
fi
for command_name in docker curl jq openssl tar flock pg_restore; do
  command -v "${command_name}" >/dev/null || { echo "Commande absente : ${command_name}" >&2; exit 1; }
done

install -d -o root -g xhatsapp -m 0750 "${project}/scripts"
install -o root -g xhatsapp -m 0750 "${source_dir}/scripts/backup-xhatsapp.sh" "${project}/scripts/backup-xhatsapp.sh"
install -o root -g xhatsapp -m 0750 "${source_dir}/scripts/health-xhatsapp.sh" "${project}/scripts/health-xhatsapp.sh"
install -d -o root -g root -m 0700 /var/backups/xhatsapp /var/lib/xhatsapp-monitor
install -o root -g root -m 0644 "${source_dir}/systemd/"* /etc/systemd/system/

/bin/bash -n "${project}/scripts/backup-xhatsapp.sh"
/bin/bash -n "${project}/scripts/health-xhatsapp.sh"
systemctl daemon-reload
systemctl start xhatsapp-backup.service
systemctl enable --now xhatsapp-backup.timer xhatsapp-health.timer
for _ in $(seq 1 40); do
  if [[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]]; then
    break
  fi
  sleep 3
done
[[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}') == healthy ]]
systemctl start xhatsapp-health.service

echo "Exploitation Xhatsapp installée."
systemctl --no-pager --full status xhatsapp-backup.timer xhatsapp-health.timer | sed -n '1,30p'
