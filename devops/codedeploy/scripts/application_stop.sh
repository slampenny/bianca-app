#!/bin/bash
# ApplicationStop hook - Stop old containers gracefully

# Don't use set -e - we want to handle errors gracefully
set +e

echo "🛑 ApplicationStop: Stopping old containers..."

# Navigate to staging directory
cd /opt/bianca-staging || {
  echo "⚠️  /opt/bianca-staging not found, skipping stop" >&2
  exit 0
}

# Stop containers - use background process with timeout to prevent hangs
if [ -f "docker-compose.yml" ]; then
  echo "   Stopping containers..."
  
  # Start docker-compose down in background
  docker-compose down > /tmp/docker_stop.log 2>&1 &
  DOCKER_PID=$!
  
  # Wait up to 60 seconds for it to complete
  DOCKER_STOPPED=false
  for i in {1..60}; do
    if ! kill -0 $DOCKER_PID 2>/dev/null; then
      # Process finished
      DOCKER_STOPPED=true
      wait $DOCKER_PID
      EXIT_CODE=$?
      break
    fi
    sleep 1
  done
  
  # Kill if still running
  if [ "$DOCKER_STOPPED" = "false" ]; then
    echo "   ⚠️  Container stop taking too long, forcing stop..." >&2
    kill -9 $DOCKER_PID 2>/dev/null || true
    # Force stop containers
    docker-compose kill 2>/dev/null || true
    docker-compose down --remove-orphans 2>/dev/null || true
  fi
  
  if [ -f /tmp/docker_stop.log ]; then
    echo "   Stop output:"
    tail -20 /tmp/docker_stop.log || true
  fi
else
  echo "   No docker-compose.yml found, skipping stop (containers may not be running yet)"
fi

echo "✅ ApplicationStop completed"
exit 0

