#!/bin/bash
# Runs ON the staging EC2 instance — restores normal ECR images (no nodemon).
set -e

DEPLOY_DIR="/opt/bianca-staging"
LIVE_FLAG="$DEPLOY_DIR/.live-dev-enabled"
COMPOSE_BASE="$DEPLOY_DIR/docker-compose.yml"
COMPOSE_LIVE="$DEPLOY_DIR/docker-compose.staging-live.yml"

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "docker compose not available"
  exit 1
fi

cd "$DEPLOY_DIR"

rm -f "$LIVE_FLAG"

if [ -f nginx.conf.production-backup ]; then
  cp nginx.conf.production-backup nginx.conf
  rm -f nginx.live-dev.conf
fi

echo "Stopping live-dev containers..."
$DC -f "$COMPOSE_BASE" -f "$COMPOSE_LIVE" stop app frontend nginx 2>/dev/null || true
$DC -f "$COMPOSE_BASE" -f "$COMPOSE_LIVE" rm -f app frontend 2>/dev/null || true

echo "Logging into ECR and restoring production-like staging containers..."
AWS_REGION="${AWS_REGION:-ca-central-1}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin 730335291008.dkr.ecr.ca-central-1.amazonaws.com

$DC -f "$COMPOSE_BASE" pull app frontend nginx 2>/dev/null || $DC -f "$COMPOSE_BASE" pull app frontend
$DC -f "$COMPOSE_BASE" up -d --force-recreate app frontend nginx

echo "Live-dev mode disabled — staging is back on ECR images (pm2 / static nginx)."
