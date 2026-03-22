#!/usr/bin/env bash
# Safe Docker cleanup on the production EC2 host (EIP instance).
# Run over SSH as a user in the docker group (e.g. ec2-user), or via SSM Session Manager.
#
# Does: prune stopped containers, dangling images, build cache; then docker compose up -d.
# Does NOT: docker volume prune (avoid accidental data loss).
#
# Usage:
#   ssh ec2-user@<PRODUCTION_EIP> 'bash -s' < cleanup-production-docker.sh
#
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/bianca-production}"
if [[ ! -d "$COMPOSE_DIR" ]]; then
  COMPOSE_DIR="/opt/bianca-production-green"
fi

echo "=== BEFORE ==="
df -h /
docker system df || true

echo "=== PRUNE (stopped containers, dangling images, build cache) ==="
docker container prune -f
docker image prune -f
docker builder prune -f

echo "=== AFTER ==="
docker system df || true
df -h /

echo "=== RESTART STACK ($COMPOSE_DIR) ==="
cd "$COMPOSE_DIR"
if docker compose version &>/dev/null; then
  docker compose up -d
else
  docker-compose up -d
fi

docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "Done."
