#!/bin/bash
# Run database migrations on a deployed instance (production or staging).
# Migrations include seeding emergency phrases (required for emergency detection).
# Run this after a fresh/empty DB (e.g. after volume wipe) so default data exists.
#
# Usage (run ON the server via SSH):
#   ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<PRODUCTION_OR_STAGING_IP>
#   cd /opt/bianca-production   # or /opt/bianca-staging
#   ./run-migrations-on-server.sh
#
# Or from your machine (replace <IP> with instance IP):
#   ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<IP> 'cd /opt/bianca-production && (docker compose run --rm -e NODE_ENV=production -e MONGODB_URL=mongodb://mongodb:27017/bianca-service app yarn migrate:up 2>/dev/null || docker-compose run --rm -e NODE_ENV=production -e MONGODB_URL=mongodb://mongodb:27017/bianca-service app yarn migrate:up)'

set -e
DEPLOY_DIR="${DEPLOY_DIR:-.}"
NODE_ENV="${NODE_ENV:-production}"
MONGODB_URL="${MONGODB_URL:-mongodb://mongodb:27017/bianca-service}"

if [ ! -d "$DEPLOY_DIR" ]; then
  echo "Deploy dir not found: $DEPLOY_DIR (run from /opt/bianca-production or /opt/bianca-staging)"
  exit 1
fi

cd "$DEPLOY_DIR"
echo "Running migrations (NODE_ENV=$NODE_ENV)..."
if docker compose run --rm -e NODE_ENV="$NODE_ENV" -e MONGODB_URL="$MONGODB_URL" app yarn migrate:up 2>/dev/null; then
  echo "Migrations completed."
elif docker-compose run --rm -e NODE_ENV="$NODE_ENV" -e MONGODB_URL="$MONGODB_URL" app yarn migrate:up; then
  echo "Migrations completed."
else
  echo "Migrations failed."
  exit 1
fi
