#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

project=/opt/xhatsapp
backup_root=/var/backups/xhatsapp
stamp=$(date +%Y%m%d_%H%M%S)
partial="${backup_root}/.daily-${stamp}.partial"
final="${backup_root}/daily-${stamp}"
compose=(docker compose --env-file "${project}/.env" -f "${project}/docker-compose.yml")
omniroute_stopped=0

[[ ${EUID} -eq 0 ]] || { echo "root_required" >&2; exit 1; }
[[ ${backup_root} == /var/backups/xhatsapp ]] || { echo "unsafe_backup_root" >&2; exit 1; }
exec 9>/run/lock/xhatsapp-backup.lock
flock -n 9 || { echo "backup_already_running"; exit 0; }

cleanup() {
  if [[ ${omniroute_stopped} -eq 1 ]]; then "${compose[@]}" start omniroute >/dev/null 2>&1 || true; fi
  if [[ -d ${partial} ]]; then rm -rf -- "${partial}"; fi
}
trap cleanup EXIT

install -d -o root -g root -m 0700 "${backup_root}" "${partial}"

"${compose[@]}" exec -T postgres \
  pg_dumpall -U postgres --globals-only >"${partial}/postgres-globals.sql"
"${compose[@]}" exec -T postgres \
  pg_dump -U postgres -d openwa -Fc >"${partial}/openwa.dump"
"${compose[@]}" exec -T postgres \
  pg_dump -U postgres -d xhatsapp -Fc >"${partial}/xhatsapp.dump"

docker cp xhatsapp-openwa:/app/data/. "${partial}/openwa-data"
tar -czf "${partial}/openwa-data.tar.gz" -C "${partial}/openwa-data" .
redis_password=$(sed -n 's/^REDIS_PASSWORD=//p' "${project}/.env")
[[ -n ${redis_password} ]] || { echo "redis_password_missing" >&2; exit 1; }
docker exec -e REDISCLI_AUTH="${redis_password}" xhatsapp-redis redis-cli SAVE >/dev/null
docker cp xhatsapp-redis:/data/. "${partial}/redis-data"
tar -czf "${partial}/redis-data.tar.gz" -C "${partial}/redis-data" .
unset redis_password
rm -rf -- "${partial}/openwa-data" "${partial}/redis-data"

"${compose[@]}" stop -t 40 omniroute >/dev/null
omniroute_stopped=1
docker cp xhatsapp-omniroute:/app/data/. "${partial}/omniroute-data"
tar -czf "${partial}/omniroute-data.tar.gz" -C "${partial}/omniroute-data" .
rm -rf -- "${partial}/omniroute-data"
"${compose[@]}" start omniroute >/dev/null
for _ in $(seq 1 40); do
  if [[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}' 2>/dev/null || true) == healthy ]]; then
    break
  fi
  sleep 3
done
[[ $(docker inspect xhatsapp-omniroute --format '{{.State.Health.Status}}') == healthy ]]
omniroute_stopped=0

tar --acls --xattrs -czf "${partial}/configuration.tar.gz" \
  -C /opt \
  xhatsapp/.env \
  xhatsapp/docker-compose.yml \
  xhatsapp/caddy \
  xhatsapp/config \
  xhatsapp/scripts \
  xhatsapp/webhook

pg_restore --list "${partial}/openwa.dump" >/dev/null
pg_restore --list "${partial}/xhatsapp.dump" >/dev/null
tar -tzf "${partial}/configuration.tar.gz" >/dev/null
tar -tzf "${partial}/openwa-data.tar.gz" >/dev/null
tar -tzf "${partial}/redis-data.tar.gz" >/dev/null
tar -tzf "${partial}/omniroute-data.tar.gz" >/dev/null
test -s "${partial}/postgres-globals.sql"
(cd "${partial}" && sha256sum \
  postgres-globals.sql openwa.dump xhatsapp.dump \
  openwa-data.tar.gz redis-data.tar.gz omniroute-data.tar.gz configuration.tar.gz >SHA256SUMS)
chmod 0600 "${partial}"/*
if [[ -e ${backup_root}/latest && ! -L ${backup_root}/latest ]]; then
  echo "latest_path_is_not_a_symlink" >&2
  exit 1
fi
mv "${partial}" "${final}"
trap - EXIT
ln -sfn "${final}" "${backup_root}/latest"

while IFS= read -r -d '' expired; do
  [[ ${expired} == "${backup_root}/daily-"* ]] || continue
  rm -rf -- "${expired}"
done < <(find "${backup_root}" -mindepth 1 -maxdepth 1 -type d -name 'daily-*' -mtime +14 -print0)

echo "backup_completed path=${final}"
