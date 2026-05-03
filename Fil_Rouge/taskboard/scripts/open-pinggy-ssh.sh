#!/usr/bin/env bash
set -euo pipefail

ssh_port="${SSH_SERVER_PORT:-2222}"
log_file="$(mktemp)"
ssh_pid=""

cleanup() {
  rm -f "$log_file"
  if [[ -n "${ssh_pid:-}" ]]; then
    kill "$ssh_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Opening Pinggy TCP tunnel for local SSH port ${ssh_port}."
echo "Waiting for the public tcp:// endpoint..."

ssh -4 -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=60 -o StrictHostKeyChecking=accept-new -p 443 -R0:127.0.0.1:"$ssh_port" tcp@a.pinggy.io >"$log_file" 2>&1 &
ssh_pid=$!

for _ in $(seq 1 30); do
  if endpoint="$(grep -Eom1 'tcp://[^[:space:]]+' "$log_file" || true)" && [[ -n "$endpoint" ]]; then
    host="${endpoint#tcp://}"
    host="${host%:*}"
    port="${endpoint##*:}"

    echo "DEPLOY_TUNNEL_HOST=$host"
    echo "DEPLOY_TUNNEL_PORT=$port"
    echo "Update the GitHub secrets with these values before triggering deploy."
    wait "$ssh_pid"
    exit 0
  fi

  sleep 1
done

echo "Unable to read the Pinggy tunnel endpoint." >&2
exit 1
