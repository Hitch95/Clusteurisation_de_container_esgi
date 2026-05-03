#!/usr/bin/env bash
set -euo pipefail

ssh-keygen -A

passwd -d deployer >/dev/null 2>&1 || true

authorized_keys="/home/deployer/.ssh/authorized_keys"
install -d -m 700 -o deployer -g deployer /home/deployer/.ssh

if [[ -n "${DEPLOY_PUBLIC_KEY:-}" ]]; then
  printf '%s\n' "$DEPLOY_PUBLIC_KEY" > "$authorized_keys"
elif [[ ! -f "$authorized_keys" ]]; then
  echo "DEPLOY_PUBLIC_KEY is required" >&2
  exit 1
fi

chown deployer:deployer "$authorized_keys"
chmod 600 "$authorized_keys"

exec /usr/sbin/sshd -D -e
