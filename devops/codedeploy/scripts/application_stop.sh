#!/bin/bash
# ApplicationStop hook - Stop old containers gracefully
# Always exit 0 - don't block deployment

set +e  # Don't exit on errors

echo "🛑 ApplicationStop: Stopping old containers..."

# Change to deployment directory
if ! cd /opt/bianca-staging 2>/dev/null; then
  echo "   ⚠️  /opt/bianca-staging not found, nothing to stop"
  exit 0
fi

# Check if docker-compose.yml exists and use docker-compose if available
if [ -f "docker-compose.yml" ] && command -v docker-compose >/dev/null 2>&1; then
  echo "   Stopping containers with docker-compose..."
  # Use docker-compose down with timeout to prevent hangs
  if command -v timeout >/dev/null 2>&1; then
    timeout 30 docker-compose down --remove-orphans 2>&1 || {
      echo "   ⚠️  docker-compose down timed out or failed, trying force stop..."
      timeout 10 docker-compose kill 2>&1 || true
      timeout 5 docker-compose rm -f 2>&1 || true
    }
  else
    # Fallback if timeout command not available
    docker-compose down --remove-orphans 2>&1 || {
      echo "   ⚠️  docker-compose down failed, trying force stop..."
      docker-compose kill 2>&1 || true
      docker-compose rm -f 2>&1 || true
    }
  fi
else
  echo "   docker-compose.yml not found or docker-compose not available, stopping individual containers..."
  # Fallback: stop individual containers
  CONTAINERS="staging_app staging_frontend staging_nginx staging_mongodb staging_asterisk staging_posthog staging_posthog_db staging_posthog_redis"
  
  for container in $CONTAINERS; do
    # Check if container exists before trying to stop it
    if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
      echo "   Stopping $container..."
      if command -v timeout >/dev/null 2>&1; then
        timeout 5 docker stop "$container" 2>&1 || timeout 2 docker kill "$container" 2>&1 || true
        timeout 2 docker rm "$container" 2>&1 || true
      else
        docker stop "$container" 2>&1 || docker kill "$container" 2>&1 || true
        docker rm "$container" 2>&1 || true
      fi
    fi
  done
fi

echo "✅ ApplicationStop completed"
exit 0

