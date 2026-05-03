#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
workspace_root="$(cd "$script_dir/.." && pwd)"

if [[ -f "$script_dir/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$script_dir/.env"
  set +a
fi

docker_username="${DOCKER_USERNAME:-}"
docker_token="${DOCKER_ACCESS_TOKEN:-${DOCKER_TOKEN:-}}"
docker_email="${EMAIL:-${DOCKER_EMAIL:-}}"
docker_server="${DOCKER_SERVER:-https://index.docker.io/v1/}"

if [[ -z "$docker_username" || -z "$docker_token" || -z "$docker_email" ]]; then
  echo "Missing env vars: DOCKER_USERNAME, DOCKER_ACCESS_TOKEN (or DOCKER_TOKEN), EMAIL (or DOCKER_EMAIL)" >&2
  exit 1
fi

kubectl apply -f "$workspace_root/k8s/namespace.yaml"

kubectl create secret docker-registry regcred \
  --docker-server="$docker_server" \
  --docker-username="$docker_username" \
  --docker-password="$docker_token" \
  --docker-email="$docker_email" \
  -n tp-node-k8s \
  --dry-run=client -o yaml | kubectl apply -f -