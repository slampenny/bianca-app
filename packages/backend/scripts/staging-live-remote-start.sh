#!/bin/bash
# Runs ON the staging EC2 instance — starts live-dev containers (nodemon + Vite).
set -e

DEPLOY_DIR="/opt/bianca-staging"
SRC_DIR="$DEPLOY_DIR/dev-src"
LIVE_FLAG="$DEPLOY_DIR/.live-dev-enabled"
COMPOSE_BASE="$DEPLOY_DIR/docker-compose.yml"
COMPOSE_LIVE="$DEPLOY_DIR/docker-compose.staging-live.yml"

if [ ! -f "$COMPOSE_BASE" ]; then
  echo "Missing $COMPOSE_BASE — run a normal staging deploy first."
  exit 1
fi

if [ ! -d "$SRC_DIR/packages/backend/src" ]; then
  echo "Missing synced source at $SRC_DIR — run staging:live from your laptop first."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "docker compose not available"
  exit 1
fi

cd "$DEPLOY_DIR"

# Base compose publishes frontend as 3001:80; live-dev serves Vite on :5173 internally.
# Compose merges port lists, so duplicate host :3001 bindings fail — use a trimmed base file.
COMPOSE_LIVE_BASE="$DEPLOY_DIR/docker-compose.live-base.yml"
awk '
  /^  frontend:/ { in_fe=1 }
  in_fe && /^  [a-z]/ && !/^  frontend:/ { in_fe=0 }
  in_fe && /^    ports:/ { skip=1; next }
  in_fe && skip && /^      -/ { next }
  in_fe && skip && !/^      -/ { skip=0 }
  { print }
' "$COMPOSE_BASE" > "$COMPOSE_LIVE_BASE"

echo "Ensuring infrastructure is running..."
$DC -f "$COMPOSE_LIVE_BASE" up -d mongodb asterisk admin 2>/dev/null || true
for i in $(seq 1 30); do
  if docker exec staging_mongodb mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1 \
    || docker exec staging_mongodb mongo --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Patching nginx for Vite dev server..."
if [ ! -f nginx.conf ] && [ ! -f nginx.conf.production-backup ]; then
  echo "nginx.conf not found in $DEPLOY_DIR"
  exit 1
fi

if [ ! -f nginx.conf.production-backup ]; then
  cp nginx.conf nginx.conf.production-backup
fi

sed 's|http://frontend:80|http://frontend:5173|g' nginx.conf.production-backup | awk '
  {
    print
    if ($0 ~ /proxy_pass http:\/\/frontend:5173;/) {
      print "        proxy_set_header Upgrade $http_upgrade;"
      print "        proxy_set_header Connection \"upgrade\";"
      print "        proxy_cache_bypass $http_upgrade;"
    }
  }
' > nginx.live-dev.conf

touch "$LIVE_FLAG"

echo "Disabling maintenance mode for live-dev..."
sudo rm -f /opt/maintenance-mode.flag 2>/dev/null || true

echo "Building live-dev images (first run may take a few minutes)..."
$DC -f "$COMPOSE_LIVE_BASE" -f "$COMPOSE_LIVE" build app frontend

echo "Restarting app, frontend, and nginx in live-dev mode..."
$DC -f "$COMPOSE_LIVE_BASE" -f "$COMPOSE_LIVE" up -d --force-recreate app frontend nginx

echo ""
echo "Live-dev mode enabled."
echo "  Backend: nodemon (yarn dev:staging) in staging_app"
echo "  Frontend: Vite on :5173 proxied via nginx"
echo "  Flag: $LIVE_FLAG"
$DC -f "$COMPOSE_LIVE_BASE" -f "$COMPOSE_LIVE" ps app frontend nginx
