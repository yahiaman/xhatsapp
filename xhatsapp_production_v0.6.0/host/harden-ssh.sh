#!/usr/bin/env bash
set -Eeuo pipefail

[[ ${EUID} -eq 0 ]] || { echo "Lancez avec sudo." >&2; exit 1; }
admin_user=${1:-${SUDO_USER:-}}
[[ -n ${admin_user} && ${admin_user} != root ]] || { echo "Usage: sudo ./host/harden-ssh.sh <utilisateur-admin>" >&2; exit 1; }
[[ -s /home/${admin_user}/.ssh/authorized_keys ]] || { echo "Clé SSH absente; arrêt préventif." >&2; exit 1; }

backup=/etc/ssh/sshd_config.d/99-xhatsapp.conf.backup-$(date +%Y%m%d_%H%M%S)
[[ ! -e /etc/ssh/sshd_config.d/99-xhatsapp.conf ]] || cp -a /etc/ssh/sshd_config.d/99-xhatsapp.conf "${backup}"
printf '%s\n' \
  'PasswordAuthentication no' \
  'KbdInteractiveAuthentication no' \
  'PermitRootLogin no' \
  'PubkeyAuthentication yes' \
  'MaxAuthTries 3' \
  'X11Forwarding no' \
  'AllowTcpForwarding yes' \
  "AllowUsers ${admin_user}" >/etc/ssh/sshd_config.d/99-xhatsapp.conf
sshd -t
systemctl reload ssh
echo "SSH durci. Gardez cette session ouverte et testez une seconde connexion avant de vous déconnecter."

