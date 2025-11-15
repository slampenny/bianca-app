#!/bin/bash
# ApplicationStart hook - Start new containers

set -e

echo "🚀 ApplicationStart: Starting new containers..."

cd /opt/bianca-staging

# Replace docker-compose.yml if we have a new one
if [ -f "docker-compose.yml.new" ]; then
  echo "   Updating docker-compose.yml..."
  mv docker-compose.yml.new docker-compose.yml
fi

# Start containers with timeout
if [ -f "docker-compose.yml" ]; then
  echo "   Starting containers (2 min timeout)..."
  timeout 120 docker-compose up -d --remove-orphans || {
    echo "❌ Failed to start containers"
    exit 1
  }
  
  echo "   Waiting 5 seconds for containers to initialize..."
  sleep 5
  
  echo "   Container status:"
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep staging_ || echo "   No staging containers found"
else
  echo "❌ docker-compose.yml not found"
  exit 1
fi

echo "✅ ApplicationStart completed"

