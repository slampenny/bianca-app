#!/bin/bash
# Runs ON the staging EC2 instance — first-time setup for live-dev (compose, MongoDB EBS, infra).
set -e

DEPLOY_DIR="/opt/bianca-staging"
SRC_DIR="$DEPLOY_DIR/dev-src"
AWS_REGION="${AWS_REGION:-ca-central-1}"

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "docker compose not available"
  exit 1
fi

echo "Ensuring MongoDB EBS is mounted at /opt/mongodb-data..."
if ! mountpoint -q /opt/mongodb-data 2>/dev/null; then
  MONGO_DEV=""
  for i in $(seq 1 30); do
    for cand in /dev/nvme1n1 /dev/nvme2n1 /dev/sdf /dev/xvdf; do
      if [ -b "$cand" ]; then
        MONGO_DEV="$cand"
        break 2
      fi
    done
    echo "  waiting for MongoDB block device ($i/30)..."
    sleep 3
  done

  if [ -z "$MONGO_DEV" ]; then
    echo "WARNING: MongoDB EBS not found — MongoDB will use an empty local directory."
    sudo mkdir -p /opt/mongodb-data
    sudo chown 999:999 /opt/mongodb-data
  else
    echo "  mounting $MONGO_DEV -> /opt/mongodb-data"
    sudo mkdir -p /opt/mongodb-data
    if ! sudo mount "$MONGO_DEV" /opt/mongodb-data 2>/dev/null; then
      sudo mount -o nouuid "$MONGO_DEV" /opt/mongodb-data
    fi
    sudo chown 999:999 /opt/mongodb-data
    if ! grep -q '/opt/mongodb-data' /etc/fstab 2>/dev/null; then
      echo "$MONGO_DEV /opt/mongodb-data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab >/dev/null
    fi
  fi
else
  echo "  /opt/mongodb-data already mounted"
fi

if [ ! -f "$DEPLOY_DIR/docker-compose.yml" ]; then
  if [ ! -f "$SRC_DIR/packages/backend/devops/codedeploy/scripts/before_install.sh" ]; then
    echo "Missing before_install.sh in synced source — run rsync from your laptop first."
    exit 1
  fi
  echo "Generating docker-compose.yml and nginx.conf (before_install)..."
  sudo ENVIRONMENT=staging bash "$SRC_DIR/packages/backend/devops/codedeploy/scripts/before_install.sh"
fi

sudo touch /opt/maintenance.html 2>/dev/null || true
# Do not create maintenance-mode.flag — an empty file triggers nginx 503.

cd "$DEPLOY_DIR"

echo "Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin 730335291008.dkr.ecr.ca-central-1.amazonaws.com

echo "Starting infrastructure containers (mongodb, asterisk, admin)..."
$DC pull mongodb asterisk admin 2>/dev/null || true
$DC up -d mongodb
echo "Waiting for MongoDB..."
for i in $(seq 1 60); do
  if docker exec staging_mongodb mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1 \
    || docker exec staging_mongodb mongo --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
    echo "MongoDB ready."
    break
  fi
  sleep 2
done

$DC up -d asterisk admin

echo "Bootstrap complete."
