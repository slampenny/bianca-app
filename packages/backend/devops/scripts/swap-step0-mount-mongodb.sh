#!/bin/bash
# Run on green via SSM during SwapAndTerminate Step 0 (DEPLOY_DIR must be set).
set -eux

DEPLOY_DIR="${DEPLOY_DIR:?DEPLOY_DIR is required}"

cd "$DEPLOY_DIR"
(docker compose stop 2>/dev/null || docker-compose stop 2>/dev/null || true)
sleep 5
sudo umount /opt/mongodb-data 2>/dev/null || true
sleep 2

# Nitro: EBS at /dev/sdf appears as /dev/nvme1n1 (or nvme2n1). Wait after attach-volume.
MONGO_DEV=""
for i in $(seq 1 24); do
  for cand in /dev/nvme1n1 /dev/nvme2n1 /dev/sdf /dev/xvdf; do
    if [ -b "$cand" ]; then
      MONGO_DEV="$cand"
      break 2
    fi
  done
  echo "waiting for MongoDB block device ($i/24)..."
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
  (docker compose logs mongodb 2>&1 || docker-compose logs mongodb 2>&1) | tail -80 || true
  exit 1
fi

MONGO_OK=false
for i in $(seq 1 36); do
  if docker compose exec -T mongodb mongosh --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null | grep -q 1; then
    MONGO_OK=true
    break
  fi
  if docker compose exec -T mongodb mongo --eval 'db.runCommand({ping:1}).ok' --quiet 2>/dev/null | grep -q 1; then
    MONGO_OK=true
    break
  fi
  sleep 5
done
if [ "$MONGO_OK" != "true" ]; then
  echo "FATAL: mongodb ping timeout"
  (docker compose logs mongodb 2>&1 || docker-compose logs mongodb 2>&1) | tail -80 || true
  exit 1
fi

if ! (docker compose up -d 2>/dev/null || docker-compose up -d); then
  echo "FATAL: docker compose up -d failed"
  docker compose ps 2>&1 || docker-compose ps 2>&1 || true
  exit 1
fi

echo "Step 0: MongoDB volume mounted and stack started"
