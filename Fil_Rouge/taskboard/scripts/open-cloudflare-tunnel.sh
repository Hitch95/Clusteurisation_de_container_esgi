#!/usr/bin/env bash
set -euo pipefail

ssh_port="${SSH_SERVER_PORT:-2222}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared est requis sur PATH." >&2
  exit 1
fi

# Vérifie que cloudflared est authentifié
if ! cloudflared tunnel list >/dev/null 2>&1; then
  echo "Veuillez d'abord authentifier cloudflared: cloudflared tunnel login" >&2
  exit 1
fi

# Crée ou récupère le tunnel 
tunnel_name="taskboard-ssh"
if ! cloudflared tunnel info "$tunnel_name" >/dev/null 2>&1; then
  echo "Création du tunnel Cloudflare $tunnel_name..."
  cloudflared tunnel create "$tunnel_name"
fi

# Récupère le hostname
tunnel_info=$(cloudflared tunnel info "$tunnel_name" 2>/dev/null || true)
tunnel_host=$(echo "$tunnel_info" | grep -Eo 'https?://[^[:space:]]+' | head -n1 || true)

if [[ -z "$tunnel_host" ]]; then
  # Format par défaut
  tunnel_host="${tunnel_name}.trycloudflare.com"
fi

echo "Opening Cloudflare Tunnel for local SSH port ${ssh_port}."
echo "Hostname: $tunnel_host"

# Lance cloudflared en arrière-plan
cloudflared tunnel --name "$tunnel_name" --url "ssh://localhost:${ssh_port}" &
cloudflared_pid=$!

cleanup() {
  kill "$cloudflared_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "DEPLOY_TUNNEL_HOST=$tunnel_host"
echo "DEPLOY_TUNNEL_PORT=22"
echo "Update the GitHub secrets with these values before triggering deploy."
echo "Keep this process running until the GitHub job finishes."

wait "$cloudflared_pid"
