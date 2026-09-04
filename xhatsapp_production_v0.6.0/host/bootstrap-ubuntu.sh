#!/usr/bin/env bash
set -Eeuo pipefail

[[ ${EUID} -eq 0 ]] || { echo "Lancez avec sudo." >&2; exit 1; }
admin_user=${1:-${SUDO_USER:-}}
[[ -n ${admin_user} && ${admin_user} != root ]] || { echo "Usage: sudo ./host/bootstrap-ubuntu.sh <utilisateur-admin>" >&2; exit 1; }
id "${admin_user}" >/dev/null 2>&1 || { echo "Utilisateur absent : ${admin_user}" >&2; exit 1; }
[[ -s /home/${admin_user}/.ssh/authorized_keys ]] || { echo "Clé SSH absente pour ${admin_user}; arrêt préventif." >&2; exit 1; }

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl jq openssl unzip ufw fail2ban postgresql-client
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
arch=$(dpkg --print-architecture)
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "${arch}" "${VERSION_CODENAME}" >/etc/apt/sources.list.d/docker.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

install -d -m 0755 /etc/docker
if [[ ! -e /etc/docker/daemon.json ]]; then
  printf '%s\n' '{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"},"live-restore":true}' >/etc/docker/daemon.json
fi
systemctl enable --now docker fail2ban
docker info >/dev/null

if ! swapon --show --noheadings | grep -q .; then
  fallocate -l 4G /swapfile
  chmod 0600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
fi
printf 'vm.swappiness=10\n' >/etc/sysctl.d/99-xhatsapp.conf
sysctl --system >/dev/null

ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp comment 'SSH rate-limited'
ufw allow 80/tcp comment 'HTTP Caddy'
ufw allow 443/tcp comment 'HTTPS Caddy'
ufw --force enable

getent group xhatsapp >/dev/null || groupadd --system xhatsapp
usermod -a -G xhatsapp "${admin_user}"
install -d -o root -g xhatsapp -m 0750 /opt/xhatsapp /var/backups/xhatsapp

echo "Socle Ubuntu prêt. Reconnectez la session SSH pour actualiser le groupe xhatsapp."

