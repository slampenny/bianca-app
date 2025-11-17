#!/bin/bash
# ApplicationStop hook - Stop old containers gracefully

# Output to both stdout and stderr so CodeDeploy captures it
exec > >(tee /tmp/application_stop.log) 2>&1

echo "🛑 ApplicationStop: Stopping old containers..."
echo "   Script started at $(date)"

# Navigate to staging directory
if ! cd /opt/bianca-staging 2>/dev/null; then
  echo "⚠️  /opt/bianca-staging not found, skipping stop"
  exit 0
fi

echo "   Current directory: $(pwd)"
echo "   Listing containers before stop..."
docker ps --format "{{.Names}}\t{{.Status}}" | grep staging_ || echo "   No staging containers running"

# Stop all staging containers by name
echo "   Stopping containers..."
CONTAINERS="staging_app staging_frontend staging_nginx staging_mongodb staging_asterisk staging_posthog staging_posthog_db staging_posthog_redis"
for container in $CONTAINERS; do
  if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
    echo "   Stopping $container..."
    if ! docker stop $container 2>&1; then
      echo "   ⚠️  Failed to stop $container, trying kill..."
      docker kill $container 2>&1 || true
    fi
  else
    echo "   $container not running, skipping"
  fi
done

# Remove containers
echo "   Removing containers..."
for container in $CONTAINERS; do
  if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
    echo "   Removing $container..."
    docker rm $container 2>&1 || echo "   ⚠️  Failed to remove $container (may not exist)"
  fi
done

echo "   Listing containers after stop..."
docker ps --format "{{.Names}}\t{{.Status}}" | grep staging_ || echo "   No staging containers running (expected)"

echo "✅ ApplicationStop completed at $(date)"
exit 0

