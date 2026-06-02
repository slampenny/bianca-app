#!/bin/bash
# Run on green via SSM during SwapAndTerminate Step 0 (DEPLOY_DIR must be set).
set -eu

DEPLOY_DIR="${DEPLOY_DIR:?DEPLOY_DIR is required}"
case "$DEPLOY_DIR" in
  /opt/bianca-production) CONTAINER_PREFIX="production" ;;
  /opt/bianca-staging) CONTAINER_PREFIX="staging" ;;
  /opt/bianca-demo) CONTAINER_PREFIX="demo" ;;
  *)
    base=$(basename "$DEPLOY_DIR")
    CONTAINER_PREFIX="${base#bianca-}"
    ;;
esac
MONGO_CONTAINER="${CONTAINER_PREFIX}_mongodb"

# SSM RunShellScript often has no HOME; compose uses ~/.aws volume mounts for app.
export HOME="${HOME:-/root}"
mkdir -p "$HOME/.aws" 2>/dev/null || true

start_compose_stack_after_mongo() {
  cd "$DEPLOY_DIR"
  local svc
  for svc in redis asterisk app frontend admin nginx; do
    if ! docker-compose config --services 2>/dev/null | grep -qx "$svc"; then
      continue
    fi
    docker-compose stop "$svc" 2>/dev/null || true
    docker rm -f "${CONTAINER_PREFIX}_${svc}" 2>/dev/null || true
    docker-compose rm -sf "$svc" 2>/dev/null || true
  done
  sleep 2
  for svc in redis asterisk app frontend admin nginx; do
    if ! docker-compose config --services 2>/dev/null | grep -qx "$svc"; then
      continue
    fi
    echo "Starting $svc..."
    if ! docker-compose up -d --no-deps --force-recreate "$svc"; then
      echo "FATAL: failed to start $svc"
      docker-compose ps 2>&1 || true
      docker logs "${CONTAINER_PREFIX}_${svc}" 2>&1 | tail -40 || true
      return 1
    fi
    sleep 3
  done
}

cd "$DEPLOY_DIR"
(docker compose stop 2>/dev/null || docker-compose stop 2>/dev/null || true)
sleep 5
sudo umount /opt/mongodb-data 2>/dev/null || true
sleep 2

MONGO_DEV=""
for i in $(seq 1 30); do
  for cand in /dev/nvme1n1 /dev/nvme2n1 /dev/sdf /dev/xvdf; do
    if [ -b "$cand" ]; then
      MONGO_DEV="$cand"
      break 2
    fi
  done
  echo "waiting for MongoDB block device ($i/30)..."
  lsblk || true
  sleep 5
done

if [ -z "$MONGO_DEV" ]; then
  echo "FATAL: MongoDB EBS block device not found after attach"
  lsblk -f || true
  exit 1
fi

echo "Using block device: $MONGO_DEV"
sudo mkdir -p /opt/mongodb-data
if ! sudo mount "$MONGO_DEV" /opt/mongodb-data 2>/dev/null; then
  sudo mount -o nouuid "$MONGO_DEV" /opt/mongodb-data
fi
sudo chown -R 999:999 /opt/mongodb-data

if ! sudo test -f /opt/mongodb-data/WiredTiger 2>/dev/null \
  && ! sudo test -d /opt/mongodb-data/diagnostic.data 2>/dev/null; then
  echo "FATAL_mongodb_data_dir_empty"
  sudo ls -la /opt/mongodb-data || true
  exit 1
fi

cd "$DEPLOY_DIR"
if ! (docker compose up -d mongodb 2>/dev/null || docker-compose up -d mongodb); then
  echo "FATAL: mongodb service failed to start"
  docker logs "$MONGO_CONTAINER" 2>&1 | tail -80 || true
  exit 1
fi

echo "Waiting for MongoDB to accept connections (WiredTiger recovery after volume move)..."
sleep 25

MONGO_OK=false
for i in $(seq 1 72); do
  if docker exec "$MONGO_CONTAINER" mongo --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
    MONGO_OK=true
    echo "MongoDB ping ok after ${i} attempt(s)"
    break
  fi
  if docker exec "$MONGO_CONTAINER" mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
    MONGO_OK=true
    echo "MongoDB ping ok after ${i} attempt(s)"
    break
  fi
  if [ $((i % 6)) -eq 1 ]; then
    echo "mongodb not ready yet ($i/72)..."
  fi
  sleep 5
done

if [ "$MONGO_OK" != "true" ]; then
  echo "FATAL: mongodb ping timeout"
  docker logs "$MONGO_CONTAINER" 2>&1 | tail -80 || true
  exit 1
fi

# AMI has docker-compose v1 only; parallel `up -d` races and SSM lacks HOME for ~/.aws mounts.
if ! start_compose_stack_after_mongo; then
  echo "FATAL: docker-compose stack startup failed"
  docker-compose ps 2>&1 || true
  exit 1
fi

echo "Step 0: MongoDB volume mounted and stack started"
