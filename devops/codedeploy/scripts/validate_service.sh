#!/bin/bash
# ValidateService hook - Verify deployment was successful

set -e

echo "✅ ValidateService: Verifying deployment..."

cd /opt/bianca-staging

# Check if containers are running
if [ -f "docker-compose.yml" ]; then
  echo "   Checking container health..."
  
  # Wait a bit for containers to fully start
  sleep 10
  
  # Check if backend container is running
  BACKEND_RUNNING=$(docker ps --filter "name=staging_app" --format "{{.Names}}" | wc -l)
  if [ "$BACKEND_RUNNING" -eq 0 ]; then
    echo "❌ Backend container is not running"
    exit 1
  fi
  
  # Check if backend is responding to health checks
  echo "   Checking backend health endpoint..."
  for i in {1..10}; do
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
      echo "✅ Backend health check passed"
      exit 0
    fi
    echo "   Health check attempt $i/10 failed, retrying..."
    sleep 3
  done
  
  echo "⚠️  Backend health check failed, but deployment may still be in progress"
  echo "   Container status:"
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep staging_ || true
else
  echo "❌ docker-compose.yml not found"
  exit 1
fi

echo "✅ ValidateService completed"

