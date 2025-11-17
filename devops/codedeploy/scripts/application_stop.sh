#!/bin/bash
# ApplicationStop hook - Stop old containers gracefully

# Don't use set -e - we want to handle errors gracefully
set +e

echo "🛑 ApplicationStop: Stopping old containers..." >&2

# Navigate to staging directory
cd /opt/bianca-staging 2>/dev/null || {
  echo "⚠️  /opt/bianca-staging not found, skipping stop" >&2
  exit 0
}

# Simple approach: just kill and remove containers directly
# Don't use docker-compose down which can hang
echo "   Stopping containers directly..." >&2

# Stop all staging containers by name (with timeout per container)
echo "   Stopping containers..." >&2
for container in staging_app staging_frontend staging_nginx staging_mongodb staging_asterisk staging_posthog staging_posthog_db staging_posthog_redis; do
  if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
    echo "   Stopping $container..." >&2
    docker stop $container 2>&1 || echo "   ⚠️  Failed to stop $container" >&2
  fi
done

# Remove containers
echo "   Removing containers..." >&2
for container in staging_app staging_frontend staging_nginx staging_mongodb staging_asterisk staging_posthog staging_posthog_db staging_posthog_redis; do
  docker rm $container 2>&1 || true
done

# Skip docker-compose entirely - it can hang
# Just rely on direct docker commands above

echo "✅ ApplicationStop completed" >&2
exit 0

