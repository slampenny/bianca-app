#!/bin/bash
# ApplicationStop hook - Stop old containers gracefully

# Don't use set -e - we want to handle errors gracefully
set +e

echo "🛑 ApplicationStop: Stopping old containers..."

# Navigate to staging directory
cd /opt/bianca-staging 2>/dev/null || {
  echo "⚠️  /opt/bianca-staging not found, skipping stop" >&2
  exit 0
}

# Simple approach: just kill and remove containers directly
# Don't use docker-compose down which can hang
echo "   Stopping containers directly..."

# Stop all staging containers by name
docker stop staging_app staging_frontend staging_nginx staging_mongodb staging_asterisk staging_posthog staging_posthog_db staging_posthog_redis 2>/dev/null || true

# Remove containers
docker rm staging_app staging_frontend staging_nginx staging_mongodb staging_asterisk staging_posthog staging_posthog_db staging_posthog_redis 2>/dev/null || true

# Also try docker-compose if it exists, but don't wait for it
if [ -f "docker-compose.yml" ]; then
  echo "   Attempting docker-compose cleanup (non-blocking)..."
  # Start in background and don't wait
  docker-compose down --remove-orphans > /dev/null 2>&1 &
  # Give it 5 seconds max
  sleep 5
  # Kill it if still running
  kill %1 2>/dev/null || true
fi

echo "✅ ApplicationStop completed"
exit 0

