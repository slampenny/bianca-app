#!/bin/bash
# ValidateService hook - Verify deployment was successful

set -e  # Exit on error - we want to fail if validation doesn't pass

echo "✅ ValidateService: Verifying deployment..."

# Detect environment - use directory existence as primary method (most reliable)
AWS_REGION="us-east-2"

# Primary method: Check which deployment directory exists
if [ -d "/opt/bianca-production" ]; then
  DEPLOY_DIR="/opt/bianca-production"
  CONTAINER_PREFIX="production"
elif [ -d "/opt/bianca-staging" ]; then
  DEPLOY_DIR="/opt/bianca-staging"
  CONTAINER_PREFIX="staging"
else
  # Fallback: Try to get instance tags (may fail due to permissions)
  INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")
  INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")
  ENVIRONMENT_TAG=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Environment`].Value' --output text 2>/dev/null || echo "")
  
  if [ "$ENVIRONMENT_TAG" = "production" ] || echo "$INSTANCE_NAME" | grep -qi "production"; then
    DEPLOY_DIR="/opt/bianca-production"
    CONTAINER_PREFIX="production"
  elif [ "$ENVIRONMENT_TAG" = "staging" ] || echo "$INSTANCE_NAME" | grep -qi "staging"; then
    DEPLOY_DIR="/opt/bianca-staging"
    CONTAINER_PREFIX="staging"
  else
    echo "   ❌ ERROR: Cannot determine environment and no deployment directory found"
    exit 1
  fi
fi

cd "$DEPLOY_DIR" || {
  echo "❌ ERROR: Cannot cd to $DEPLOY_DIR"
  exit 1
}

# Check if containers are running
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml not found"
  exit 1
fi

echo "   Checking container health..."

# Wait a bit for containers to fully start
sleep 20

# Check if all required containers are running
echo "   Checking container status..."
CONTAINER_STATUS=$(docker ps --filter "name=${CONTAINER_PREFIX}_" --format "{{.Names}}\t{{.Status}}" || true)
echo "$CONTAINER_STATUS"

# Track validation failures
VALIDATION_FAILED=false

# Check if backend container is running
BACKEND_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_app" --format "{{.Names}}" | wc -l)
if [ "$BACKEND_RUNNING" -eq 0 ]; then
  echo "❌ Backend container is not running" >&2
  echo "   Checking for container errors..." >&2
  docker ps -a --filter "name=${CONTAINER_PREFIX}_app" --format "{{.Names}}\t{{.Status}}\t{{.Image}}" || true
  docker logs ${CONTAINER_PREFIX}_app --tail 50 2>&1 || true
  VALIDATION_FAILED=true
else
  echo "✅ Backend container is running"
fi

# Check if nginx container is running (required for public access)
NGINX_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_nginx" --format "{{.Names}}" | wc -l)
if [ "$NGINX_RUNNING" -eq 0 ]; then
  echo "❌ Nginx container is not running (required for public access)" >&2
  docker ps -a --filter "name=${CONTAINER_PREFIX}_nginx" --format "{{.Names}}\t{{.Status}}\t{{.Image}}" || true
  docker logs ${CONTAINER_PREFIX}_nginx --tail 50 2>&1 || true
  VALIDATION_FAILED=true
else
  echo "✅ Nginx container is running"
fi

# Check if frontend container is running (optional - don't fail if missing)
FRONTEND_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_frontend" --format "{{.Names}}" | wc -l)
if [ "$FRONTEND_RUNNING" -eq 0 ]; then
  echo "⚠️  Frontend container is not running (may still be starting)"
else
  echo "✅ Frontend container is running"
fi

# Check if backend is responding to health checks (REQUIRED)
echo "   Checking backend health endpoint..."
BACKEND_HEALTH_PASSED=false
for i in {1..10}; do
  if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed (attempt $i)"
    BACKEND_HEALTH_PASSED=true
    break
  fi
  echo "   Health check attempt $i/10 failed, retrying in 3 seconds..."
  sleep 3
done

if [ "$BACKEND_HEALTH_PASSED" = "false" ]; then
  echo "❌ Backend health check failed after 10 attempts" >&2
  echo "   Checking backend logs..." >&2
  docker logs ${CONTAINER_PREFIX}_app --tail 50 2>&1 || true
  echo "   Container status:" >&2
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep ${CONTAINER_PREFIX}_ || true
  VALIDATION_FAILED=true
fi

# Check if nginx is responding on port 80 (REQUIRED for public access)
echo "   Checking nginx on port 80..."
NGINX_HEALTH_PASSED=false
for i in {1..10}; do
  if curl -f -s http://localhost:80 > /dev/null 2>&1; then
    echo "✅ Nginx health check passed (attempt $i)"
    NGINX_HEALTH_PASSED=true
    break
  fi
  echo "   Nginx health check attempt $i/10 failed, retrying in 3 seconds..."
  sleep 3
done

if [ "$NGINX_HEALTH_PASSED" = "false" ]; then
  echo "❌ Nginx health check failed after 10 attempts" >&2
  echo "   Checking nginx logs..." >&2
  docker logs ${CONTAINER_PREFIX}_nginx --tail 50 2>&1 || true
  echo "   Checking if port 80 is listening..." >&2
  ss -tlnp 2>/dev/null | grep :80 || netstat -tlnp 2>/dev/null | grep :80 || echo "   Port 80 is not listening" >&2
  VALIDATION_FAILED=true
fi

# Disable maintenance mode once deployment is validated
if [ -f "/opt/bianca-deployment/devops/maintenance/disable-maintenance.sh" ]; then
    echo "   Disabling maintenance mode..."
    bash /opt/bianca-deployment/devops/maintenance/disable-maintenance.sh || {
        echo "   ⚠️  Could not disable maintenance mode, but deployment is complete"
    }
fi

# Final validation check
if [ "$VALIDATION_FAILED" = "true" ]; then
  echo ""
  echo "❌ ValidateService FAILED - Deployment validation did not pass"
  echo "   One or more required checks failed:"
  echo "   - Backend container must be running"
  echo "   - Nginx container must be running"
  echo "   - Backend health endpoint must respond"
  echo "   - Nginx must respond on port 80"
  echo ""
  echo "   Please check the logs above for details."
  exit 1
fi

echo ""
echo "✅ ValidateService completed successfully - all checks passed"
exit 0
