#!/bin/bash
# One-time fix for Asterisk on staging after blue-green deploy.
# Step 6 in the pipeline should do this automatically; use this if Asterisk
# stopped working and the pipeline restart didn't run (e.g. SSM failed or
# only docker-compose is installed and the pipeline used "docker compose").
#
# Run on the staging instance (SSH or SSM):
#   cd /opt/bianca-staging && curl -sS "https://raw.githubusercontent.com/.../fix-staging-asterisk-external-address.sh" | bash
# Or copy this script to the instance and run: ./fix-staging-asterisk-external-address.sh

set -e

DEPLOY_DIR="${DEPLOY_DIR:-/opt/bianca-staging}"
cd "$DEPLOY_DIR"

if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml not found in $DEPLOY_DIR"
  exit 1
fi

echo "Getting current public IP..."
PUBLIC_IP=$(curl -sS http://169.254.169.254/latest/meta-data/public-ipv4)
if [ -z "$PUBLIC_IP" ]; then
  echo "❌ Could not get public IP from instance metadata"
  exit 1
fi
echo "Public IP: $PUBLIC_IP"

echo "Updating EXTERNAL_ADDRESS and ASTERISK_PUBLIC_IP in docker-compose.yml..."
sed -i.bak \
  -e "s|EXTERNAL_ADDRESS=[^[:space:]]*|EXTERNAL_ADDRESS=$PUBLIC_IP|" \
  -e "s|ASTERISK_PUBLIC_IP=[^[:space:]]*|ASTERISK_PUBLIC_IP=$PUBLIC_IP|" \
  docker-compose.yml

echo "Restarting Asterisk and app..."
if docker compose version >/dev/null 2>&1; then
  docker compose up -d asterisk app
else
  docker-compose up -d asterisk app
fi

echo "Checking Asterisk logs..."
docker logs staging_asterisk --tail 15 2>/dev/null || docker logs bianca-staging_asterisk --tail 15 2>/dev/null || true
echo "✅ Done. Verify EXTERNAL_ADDRESS in logs above matches $PUBLIC_IP"
