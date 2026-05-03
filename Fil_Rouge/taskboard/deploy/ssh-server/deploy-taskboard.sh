#!/usr/bin/env bash
set -euo pipefail

image_ref="${1:?Usage: deploy-taskboard.sh <ghcr-image-ref>}"

app_network="${APP_NETWORK:-taskboard-deploy}"
app_container="${APP_CONTAINER_NAME:-taskboard-app}"
db_container="${DB_CONTAINER_NAME:-taskboard-db}"
db_volume="${DB_VOLUME_NAME:-taskboard-db-data}"
app_port="${APP_PUBLISHED_PORT:-3000}"
# Cloudflare Tunnel forwards to SSH standard port 22 on localhost
ssh_port="22"
# Override if SSH_SERVER_PORT is set for local testing
if [[ -n "${SSH_SERVER_PORT:-}" ]]; then
  ssh_port="${SSH_SERVER_PORT}"
fi
db_name="${POSTGRES_DB:-taskboard}"
db_user="${POSTGRES_USER:-taskboard}"
db_password="${POSTGRES_PASSWORD:-taskboard123}"
app_database_url="${APP_DATABASE_URL:-postgresql://${db_user}:${db_password}@${db_container}:5432/${db_name}}"

wait_for_health() {
  local container_name="$1"
  local max_attempts="${2:-30}"
  local delay_seconds="${3:-2}"
  local status="starting"

  for _ in $(seq 1 "$max_attempts"); do
    status="$(sudo docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo starting)"
    if [[ "$status" == "healthy" ]]; then
      return 0
    fi
    sleep "$delay_seconds"
  done

  return 1
}

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

sudo docker pull "$image_ref"

sudo docker network inspect "$app_network" >/dev/null 2>&1 || sudo docker network create "$app_network" >/dev/null
sudo docker volume inspect "$db_volume" >/dev/null 2>&1 || sudo docker volume create "$db_volume" >/dev/null

sudo docker rm -f "$app_container" >/dev/null 2>&1 || true
sudo docker rm -f "$db_container" >/dev/null 2>&1 || true

sudo docker run -d \
  --name "$db_container" \
  --network "$app_network" \
  --restart unless-stopped \
  -e POSTGRES_USER="$db_user" \
  -e POSTGRES_PASSWORD="$db_password" \
  -e POSTGRES_DB="$db_name" \
  -v "$db_volume:/var/lib/postgresql" \
  --health-cmd 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  --health-interval 10s \
  --health-timeout 5s \
  --health-retries 5 \
  --health-start-period 20s \
  postgres:18.3-bookworm

if ! wait_for_health "$db_container" 40 2; then
  sudo docker logs "$db_container" || true
  exit 1
fi

sudo docker run -d \
  --name "$app_container" \
  --network "$app_network" \
  --restart unless-stopped \
  --init \
  -p "$app_port:3000" \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /var/tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  -e PORT=3000 \
  -e DATABASE_URL="$app_database_url" \
  -e JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}" \
  -e DEFAULT_ADMIN_USERNAME="${DEFAULT_ADMIN_USERNAME:-admin}" \
  -e DEFAULT_ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-taskboard123}" \
  "$image_ref"

if ! wait_for_health "$app_container" 40 2; then
  sudo docker logs "$app_container" || true
  exit 1
fi

sudo docker run --rm --network "$app_network" curlimages/curl:8.10.1 --fail --silent --show-error "http://${app_container}:3000/health" | grep -q '"status":"ok"'

echo "Deployment successful: $image_ref"
