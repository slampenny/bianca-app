#!/bin/bash
# Runs on the staging EC2 via SSM after regenerate-host-stack.sh.
# Pulls :staging images and brings the stack up (idempotent).

set -euo pipefail

AWS_REGION="${AWS_REGION:-ca-central-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-730335291008}"
ECR_REGISTRY="${ECR_REGISTRY:-${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/bianca-staging}"

if [ -f "${DEPLOY_DIR}/.live-dev-enabled" ]; then
  echo "❌ ERROR: Staging live-dev is active (.live-dev-enabled)." >&2
  echo "   Disable it first: yarn staging:live:off" >&2
  exit 1
fi

cd "$DEPLOY_DIR"
if [ ! -f docker-compose.yml ]; then
  echo "❌ ERROR: ${DEPLOY_DIR}/docker-compose.yml missing — regenerate-host-stack did not run" >&2
  exit 1
fi

# Prefer plugin; Amazon Linux staging userdata installs standalone docker-compose.
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD=(docker compose)
  echo "Using: docker compose (plugin)"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD=(docker-compose)
  echo "Using: docker-compose (standalone)"
else
  echo "❌ ERROR: Neither 'docker compose' nor 'docker-compose' is available" >&2
  exit 1
fi

echo "Logging into ECR ${ECR_REGISTRY}..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "Pulling :staging images..."
docker pull "${ECR_REGISTRY}/bianca-app-backend:staging"
docker pull "${ECR_REGISTRY}/bianca-app-frontend:staging"
docker pull "${ECR_REGISTRY}/bianca-app-admin:staging"
docker pull "${ECR_REGISTRY}/bianca-app-asterisk:staging"

echo "Starting stack (compose up -d)..."
"${DOCKER_COMPOSE_CMD[@]}" pull || true
"${DOCKER_COMPOSE_CMD[@]}" up -d --remove-orphans

echo "Waiting for containers..."
sleep 15

echo "Container status:"
docker ps --filter "name=staging_" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

echo "Image digests:"
for img in bianca-app-backend bianca-app-frontend bianca-app-admin bianca-app-asterisk; do
  dig=$(docker image inspect "${ECR_REGISTRY}/${img}:staging" --format '{{index .RepoDigests 0}}' 2>/dev/null || echo "${img}:staging (no digest)")
  echo "  $dig"
done

if [ -f "${DEPLOY_DIR}/.deployed-git-sha" ]; then
  echo "Deployed git SHA: $(cat "${DEPLOY_DIR}/.deployed-git-sha")"
fi

echo "✅ staging-remote-compose-up complete"
