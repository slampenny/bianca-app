#!/bin/bash
# ValidateService hook - Verify deployment was successful

set -e  # Exit on error - we want to fail if validation doesn't pass

echo "✅ ValidateService: Verifying deployment..."

# Detect environment - check /etc/environment first, then directories, then instance tags
AWS_REGION="us-east-2"

DETECTED_ENV=""

# Method 1: Check /etc/environment file first (set by userdata)
if [ -f "/etc/environment" ]; then
  ENV_FROM_FILE=$(grep "^ENVIRONMENT=" /etc/environment 2>/dev/null | cut -d'=' -f2 | tr -d '"' | xargs)
  if [ -n "$ENV_FROM_FILE" ]; then
    DETECTED_ENV="$ENV_FROM_FILE"
  fi
fi

# Method 2: Check environment variables (if not already set from /etc/environment)
if [ -z "$DETECTED_ENV" ] && [ -n "$ENVIRONMENT" ]; then
  DETECTED_ENV="$ENVIRONMENT"
fi

# Method 3: Check which deployment directory exists (if not already set from env vars)
if [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-production" ]; then
  DETECTED_ENV="production"
elif [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-staging" ]; then
  DETECTED_ENV="staging"
fi

# Method 4: Fallback to instance tags (if not already set)
if [ -z "$DETECTED_ENV" ]; then
  INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")
  INSTANCE_NAME_RAW=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")
  ENVIRONMENT_TAG_RAW=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Environment`].Value' --output text 2>/dev/null || echo "")
  
  # Filter out HTML responses
  if [ -n "$INSTANCE_NAME_RAW" ] && ! echo "$INSTANCE_NAME_RAW" | grep -q "<html\|<!DOCTYPE"; then
    INSTANCE_NAME="$INSTANCE_NAME_RAW"
  fi
  if [ -n "$ENVIRONMENT_TAG_RAW" ] && ! echo "$ENVIRONMENT_TAG_RAW" | grep -q "<html\|<!DOCTYPE"; then
    ENVIRONMENT_TAG="$ENVIRONMENT_TAG_RAW"
  fi
  
  if [ "$ENVIRONMENT_TAG" = "production" ] || echo "$INSTANCE_NAME" | grep -qi "production"; then
    DETECTED_ENV="production"
  elif [ "$ENVIRONMENT_TAG" = "staging" ] || echo "$INSTANCE_NAME" | grep -qi "staging"; then
    DETECTED_ENV="staging"
  fi
fi

# Set deployment variables based on detected environment
if [ "$DETECTED_ENV" = "production" ]; then
  DEPLOY_DIR="/opt/bianca-production"
  CONTAINER_PREFIX="production"
elif [ "$DETECTED_ENV" = "staging" ]; then
  DEPLOY_DIR="/opt/bianca-staging"
  CONTAINER_PREFIX="staging"
else
  echo "❌ ERROR: Cannot determine environment"
  echo "   Checked /etc/environment, environment variables, deployment directories, and instance tags"
  exit 1
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

# Determine which docker compose command to use
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker-compose"
else
  echo "❌ ERROR: Neither 'docker compose' nor 'docker-compose' is available" >&2
  exit 1
fi

# Wait a bit for containers to fully start
sleep 20

# Check container status with retries - if containers aren't running, try to start them
echo "   Verifying containers are running (with retries if needed)..."
MAX_RETRIES=10
RETRY_DELAY=5
RETRY_COUNT=0
ALL_CONTAINERS_RUNNING=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Check if containers are running
  NGINX_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_nginx" --format "{{.Names}}" | wc -l)
  FRONTEND_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_frontend" --format "{{.Names}}" | wc -l)
  APP_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_app" --format "{{.Names}}" | wc -l)
  
  echo "   Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES: Nginx=$NGINX_RUNNING, Frontend=$FRONTEND_RUNNING, App=$APP_RUNNING"
  
  if [ "$NGINX_RUNNING" -gt 0 ] && [ "$FRONTEND_RUNNING" -gt 0 ] && [ "$APP_RUNNING" -gt 0 ]; then
    ALL_CONTAINERS_RUNNING=true
    echo "   ✅ All required containers are running"
    break
  fi
  
  # If containers aren't running, try to start them
  if [ "$NGINX_RUNNING" -eq 0 ] || [ "$FRONTEND_RUNNING" -eq 0 ] || [ "$APP_RUNNING" -eq 0 ]; then
    echo "   ⚠️  Some containers not running, attempting to start..."
    
    # Try to start containers
    if [ "$DOCKER_COMPOSE_CMD" = "docker compose" ]; then
      docker compose up -d --remove-orphans 2>&1 | head -20 || true
    else
      docker-compose up -d --remove-orphans 2>&1 | head -20 || true
    fi
    
    sleep $RETRY_DELAY
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

# Track validation failures
VALIDATION_FAILED=false

# Check if all required containers are running
if [ "$ALL_CONTAINERS_RUNNING" = "false" ]; then
  echo "   ❌ ERROR: Required containers are still not running after $MAX_RETRIES attempts" >&2
  VALIDATION_FAILED=true
  
  # Show detailed error information
  echo "   Container status:" >&2
  docker ps -a --filter "name=${CONTAINER_PREFIX}_" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" >&2 || true
  
  echo "   Checking container logs..." >&2
  if [ "$NGINX_RUNNING" -eq 0 ]; then
    echo "   Nginx logs:" >&2
    docker logs ${CONTAINER_PREFIX}_nginx --tail 30 2>&1 || echo "   Nginx container not found" >&2
  fi
  if [ "$FRONTEND_RUNNING" -eq 0 ]; then
    echo "   Frontend logs:" >&2
    docker logs ${CONTAINER_PREFIX}_frontend --tail 20 2>&1 || echo "   Frontend container not found" >&2
  fi
  if [ "$APP_RUNNING" -eq 0 ]; then
    echo "   App logs:" >&2
    docker logs ${CONTAINER_PREFIX}_app --tail 20 2>&1 || echo "   App container not found" >&2
  fi
else
  # Display container status
  echo ""
  echo "   Container status:"
  CONTAINER_STATUS=$(docker ps --filter "name=${CONTAINER_PREFIX}_" --format "{{.Names}}\t{{.Status}}" || true)
  echo "$CONTAINER_STATUS"
  
  echo "✅ Backend container is running"
  echo "✅ Nginx container is running"
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

# Check if actual API endpoints are accessible (CRITICAL - health check might pass but routes might not work)
echo "   Checking API endpoints are registered and accessible..."
API_ENDPOINTS_PASSED=false
TEST_ENDPOINTS=(
  "/v1/docs"           # Swagger docs (should return 200 or 301/302)
  "/v1/auth/login"     # Auth endpoint (should return 400/422 for missing body, not 404)
)

ENDPOINT_FAILURES=0
for endpoint in "${TEST_ENDPOINTS[@]}"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:3000${endpoint}" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "000" ]; then
    echo "   ❌ Endpoint $endpoint: Network error (cannot connect)" >&2
    ENDPOINT_FAILURES=$((ENDPOINT_FAILURES + 1))
  elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ❌ Endpoint $endpoint: Not found (route not registered) (HTTP 404)" >&2
    ENDPOINT_FAILURES=$((ENDPOINT_FAILURES + 1))
  elif [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 500 ]; then
    # 200-499 means the route exists (even if it's a 400/422 for validation errors, that's fine)
    echo "   ✅ Endpoint $endpoint: Route registered (HTTP $HTTP_CODE)"
  else
    echo "   ⚠️  Endpoint $endpoint: Unexpected response (HTTP $HTTP_CODE)" >&2
    ENDPOINT_FAILURES=$((ENDPOINT_FAILURES + 1))
  fi
done

if [ "$ENDPOINT_FAILURES" -eq 0 ]; then
  echo "   ✅ All API endpoints are registered and accessible"
  API_ENDPOINTS_PASSED=true
else
  echo "   ❌ $ENDPOINT_FAILURES endpoint(s) failed - routes may not be registered" >&2
  echo "   Checking backend logs for route registration..." >&2
  docker logs ${CONTAINER_PREFIX}_app --tail 100 2>&1 | grep -i "route\|listening\|started\|error" | tail -20 || true
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

# Check if this is a green instance (blue-green deployment)
# Green instances aren't registered with ALB yet, so public URL checks will fail
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")
DEPLOYMENT_TYPE=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`DeploymentType`].Value' --output text 2>/dev/null || echo "")
IS_GREEN_INSTANCE=false

if [ "$DEPLOYMENT_TYPE" = "green" ]; then
  IS_GREEN_INSTANCE=true
  echo ""
  echo "   ℹ️  Detected green instance (DeploymentType=green)"
  echo "   Skipping public URL checks - instance will be registered with ALB during SwapAndTerminate stage"
  PUBLIC_URLS_PASSED=true
  FRONTEND_URL=""
  API_URL=""
elif [ "$DETECTED_ENV" = "staging" ]; then
  FRONTEND_URL="https://staging.biancawellness.com"
  API_URL="https://staging-api.biancawellness.com"
elif [ "$DETECTED_ENV" = "production" ]; then
  FRONTEND_URL="https://app.biancawellness.com"
  API_URL="https://api.biancawellness.com"
else
  echo ""
  echo "   ⚠️  Unknown environment, skipping public URL checks"
  PUBLIC_URLS_PASSED=true
  FRONTEND_URL=""
  API_URL=""
fi

# Only check public URLs if this is NOT a green instance
if [ "$IS_GREEN_INSTANCE" = "false" ] && [ -n "$FRONTEND_URL" ]; then
  echo ""
  echo "   Checking public URLs through ALB..."
  PUBLIC_URLS_PASSED=true

  if [ -n "$FRONTEND_URL" ]; then
  echo "   Testing frontend URL: $FRONTEND_URL"
  FRONTEND_PUBLIC_PASSED=false
  for i in {1..10}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
      echo "   ✅ Frontend public URL check passed (HTTP $HTTP_CODE, attempt $i)"
      FRONTEND_PUBLIC_PASSED=true
      break
    fi
    if [ "$HTTP_CODE" = "503" ]; then
      echo "   ❌ Frontend returned 503 Service Unavailable (attempt $i)" >&2
      echo "   This indicates the ALB has no healthy targets or maintenance mode is enabled" >&2
    else
      echo "   Frontend URL check attempt $i/10 failed (HTTP $HTTP_CODE), retrying in 3 seconds..."
    fi
    sleep 3
  done
  
  if [ "$FRONTEND_PUBLIC_PASSED" = "false" ]; then
    echo "   ❌ Frontend public URL check failed after 10 attempts" >&2
    echo "   URL: $FRONTEND_URL" >&2
    echo "   This means users cannot access the site!" >&2
    PUBLIC_URLS_PASSED=false
  fi
  fi

  if [ -n "$API_URL" ]; then
    echo "   Testing API URL: $API_URL/health"
  API_PUBLIC_PASSED=false
  for i in {1..10}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      echo "   ✅ API public URL check passed (HTTP $HTTP_CODE, attempt $i)"
      API_PUBLIC_PASSED=true
      break
    fi
    if [ "$HTTP_CODE" = "503" ]; then
      echo "   ❌ API returned 503 Service Unavailable (attempt $i)" >&2
      echo "   This indicates the ALB has no healthy targets or maintenance mode is enabled" >&2
    else
      echo "   API URL check attempt $i/10 failed (HTTP $HTTP_CODE), retrying in 3 seconds..."
    fi
    sleep 3
  done
  
  if [ "$API_PUBLIC_PASSED" = "false" ]; then
    echo "   ❌ API public URL check failed after 10 attempts" >&2
    echo "   URL: $API_URL/health" >&2
    echo "   This means users cannot access the API!" >&2
    PUBLIC_URLS_PASSED=false
  fi
  
  # Also test an actual API endpoint through the public URL (not just health)
  echo "   Testing actual API endpoint through public URL: $API_URL/docs"
  API_ENDPOINT_PUBLIC_PASSED=false
  for i in {1..5}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL/docs" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
      echo "   ✅ API endpoint accessible through public URL (HTTP $HTTP_CODE, attempt $i)"
      API_ENDPOINT_PUBLIC_PASSED=true
      break
    fi
    if [ "$HTTP_CODE" = "000" ]; then
      echo "   API endpoint check attempt $i/5 failed (network error), retrying in 3 seconds..."
    elif [ "$HTTP_CODE" = "404" ]; then
      echo "   ⚠️  API endpoint returned 404 (route may not be accessible through ALB)" >&2
    else
      echo "   API endpoint check attempt $i/5 failed (HTTP $HTTP_CODE), retrying in 3 seconds..."
    fi
    sleep 3
  done
  
  if [ "$API_ENDPOINT_PUBLIC_PASSED" = "false" ]; then
    echo "   ⚠️  API endpoint check through public URL failed (this may indicate ALB routing issues)" >&2
    # Don't fail validation for this, but warn
  fi
  fi

  if [ "$PUBLIC_URLS_PASSED" = "false" ]; then
    echo ""
    echo "   ⚠️  CRITICAL: Public URLs are not accessible!" >&2
    echo "   This means the deployment appears successful locally but users cannot access it." >&2
    echo "   Possible causes:" >&2
    echo "   1. Instance not registered with ALB target groups" >&2
    echo "   2. ALB target group health checks failing" >&2
    echo "   3. Security group rules blocking traffic" >&2
    echo "   4. DNS not pointing to ALB" >&2
    echo "   5. Maintenance mode still enabled" >&2
    VALIDATION_FAILED=true
  fi
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
  echo "   - Backend health endpoint must respond (localhost:3000/health)"
  echo "   - API endpoints must be registered and accessible (localhost:3000/v1/*)"
  echo "   - Nginx must respond on port 80 (localhost:80)"
  if [ -n "$FRONTEND_URL" ] || [ -n "$API_URL" ]; then
    echo "   - Public URLs must be accessible through ALB"
    [ -n "$FRONTEND_URL" ] && echo "     Frontend: $FRONTEND_URL"
    [ -n "$API_URL" ] && echo "     API: $API_URL/health"
  fi
  echo ""
  echo "   Please check the logs above for details."
  exit 1
fi

echo ""
echo "✅ ValidateService completed successfully - all checks passed"
exit 0
