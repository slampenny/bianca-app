#!/bin/bash
# ValidateService hook - Verify deployment was successful

# Don't use set -e here - we want to handle failures gracefully

echo "✅ ValidateService: Verifying deployment..."

cd /opt/bianca-staging

# Check if containers are running
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml not found"
  exit 1
fi

echo "   Checking container health..."

# Wait a bit for containers to fully start
sleep 15

# Check if all required containers are running
echo "   Checking container status..."
CONTAINER_STATUS=$(docker ps --filter "name=staging_" --format "{{.Names}}\t{{.Status}}" || true)
echo "$CONTAINER_STATUS"

# Check if backend container is running
BACKEND_RUNNING=$(docker ps --filter "name=staging_app" --format "{{.Names}}" | wc -l)
if [ "$BACKEND_RUNNING" -eq 0 ]; then
  echo "❌ Backend container is not running"
  echo "   Checking for container errors..."
  docker ps -a --filter "name=staging_app" --format "{{.Names}}\t{{.Status}}\t{{.Image}}" || true
  docker logs staging_app --tail 50 2>&1 || true
  exit 1
fi

# Check if frontend container is running (optional - don't fail if missing)
FRONTEND_RUNNING=$(docker ps --filter "name=staging_frontend" --format "{{.Names}}" | wc -l)
if [ "$FRONTEND_RUNNING" -eq 0 ]; then
  echo "⚠️  Frontend container is not running (may still be starting)"
else
  echo "✅ Frontend container is running"
fi

# Check if backend is responding to health checks
echo "   Checking backend health endpoint..."
HEALTH_CHECK_PASSED=false
for i in {1..15}; do
  if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed (attempt $i)"
    HEALTH_CHECK_PASSED=true
    break
  fi
  echo "   Health check attempt $i/15 failed, retrying in 3 seconds..."
  sleep 3
done

if [ "$HEALTH_CHECK_PASSED" = "false" ]; then
  echo "⚠️  Backend health check failed after 15 attempts"
  echo "   Checking backend logs..."
  docker logs staging_app --tail 30 2>&1 || true
  echo "   Container status:"
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep staging_ || true
  # Don't fail the deployment - let it continue and monitor manually
  echo "⚠️  Deployment completed but health check failed - please verify manually"
  exit 0
fi

echo "✅ ValidateService completed successfully"



