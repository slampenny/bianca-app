#!/bin/bash
# ApplicationStart hook - Start new containers

# Don't use set -e - we want to handle errors gracefully and provide diagnostics

echo "🚀 ApplicationStart: Starting new containers..."

# Detect environment from instance Name tag
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
AWS_REGION="us-east-2"
INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")

# Determine environment based on instance name
if echo "$INSTANCE_NAME" | grep -qi "production"; then
  DEPLOY_DIR="/opt/bianca-production"
  CONTAINER_PREFIX="production"
else
  DEPLOY_DIR="/opt/bianca-staging"
  CONTAINER_PREFIX="staging"
fi

echo "   Detected deployment directory: $DEPLOY_DIR"

cd "$DEPLOY_DIR" || {
  echo "❌ ERROR: Cannot cd to $DEPLOY_DIR"
  exit 1
}

# Verify required files exist
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ ERROR: docker-compose.yml not found in $DEPLOY_DIR"
  ls -la "$DEPLOY_DIR/" || true
  exit 1
fi

if [ ! -f "nginx.conf" ]; then
  echo "❌ ERROR: nginx.conf not found in $DEPLOY_DIR"
  exit 1
fi

# Determine which docker compose command to use
# Check for docker-compose (standalone) first, as it's more reliable
if command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD=$(command -v docker-compose)
  echo "   Using: docker-compose (standalone) at $DOCKER_COMPOSE_CMD"
  USE_DOCKER_COMPOSE_PLUGIN=false
# Then check for docker compose (plugin) - must actually work, not just exist
elif docker compose version >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
  echo "   Using: docker compose (plugin)"
  DOCKER_COMPOSE_CMD="docker compose"
  USE_DOCKER_COMPOSE_PLUGIN=true
else
  echo "❌ ERROR: Neither 'docker-compose' nor 'docker compose' is available" >&2
  echo "   Checking what's available..." >&2
  command -v docker-compose >&2 || echo "   docker-compose: not found" >&2
  docker compose version >&2 || echo "   docker compose: not working" >&2
  exit 1
fi

# Ensure ECR is logged in (token might have expired)
echo "   Ensuring ECR login..."
ECR_TOKEN_FILE=/tmp/ecr-token-$(date +%Y%m%d)
if [ ! -f "$ECR_TOKEN_FILE" ]; then
  echo "   Logging into ECR..."
  aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin 730335291008.dkr.ecr.$AWS_REGION.amazonaws.com || {
    echo "   ⚠️  ECR login failed, but continuing..."
  }
  touch "$ECR_TOKEN_FILE"
else
  echo "   Using cached ECR token"
fi

# Stop any existing containers first
echo "   Stopping any existing containers..."
if [ "$USE_DOCKER_COMPOSE_PLUGIN" = "true" ]; then
  bash -c "docker compose down" 2>/dev/null || true
else
  $DOCKER_COMPOSE_CMD down 2>/dev/null || true
fi

# Start containers - use background process with timeout to prevent hangs
# --pull always ensures we use the latest images, --force-recreate ensures new containers
echo "   Starting containers with newly pulled images..."
if [ "$USE_DOCKER_COMPOSE_PLUGIN" = "true" ]; then
  # For plugin, need to use bash -c to properly execute "docker compose" as a command
  bash -c "docker compose up -d --pull always --force-recreate --remove-orphans" > /tmp/docker_start.log 2>&1 &
else
  $DOCKER_COMPOSE_CMD up -d --pull always --force-recreate --remove-orphans > /tmp/docker_start.log 2>&1 &
fi
DOCKER_PID=$!

# Wait up to 120 seconds for it to complete
DOCKER_STARTED=false
EXIT_CODE=0
for i in {1..120}; do
  if ! kill -0 $DOCKER_PID 2>/dev/null; then
    # Process finished
    DOCKER_STARTED=true
    wait $DOCKER_PID
    EXIT_CODE=$?
    break
  fi
  sleep 1
done

# Kill if still running
if [ "$DOCKER_STARTED" = "false" ]; then
  echo "   ⚠️  Container start taking too long, but continuing..." >&2
  kill $DOCKER_PID 2>/dev/null || true
  wait $DOCKER_PID 2>/dev/null || true
  EXIT_CODE=0  # Continue anyway - containers might still start
fi

if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ ERROR: Failed to start containers (exit code: $EXIT_CODE)" >&2
  echo "   Checking for errors..." >&2
  if [ -f /tmp/docker_start.log ]; then
    echo "   Docker compose output:" >&2
    tail -100 /tmp/docker_start.log >&2 || true
  fi
  echo "   Checking docker compose logs..." >&2
  if [ "$USE_DOCKER_COMPOSE_PLUGIN" = "true" ]; then
    bash -c "docker compose logs --tail 50" 2>&1 || true
  else
    $DOCKER_COMPOSE_CMD logs --tail 50 2>&1 || true
  fi
  echo "   Container status:" >&2
  docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep ${CONTAINER_PREFIX}_ || echo "   No ${CONTAINER_PREFIX} containers found" >&2
  echo "   All containers:" >&2
  docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | head -20 >&2 || true
  # Don't exit - let ValidateService decide if deployment failed
  # But log the error clearly so it's visible
fi

# Wait for containers to initialize
echo "   Waiting 15 seconds for containers to initialize..."
sleep 15

# Check container status
echo ""
echo "   Container status:"
CONTAINER_LIST=$(docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep ${CONTAINER_PREFIX}_ || echo "")
if [ -z "$CONTAINER_LIST" ]; then
  echo "   ⚠️  WARNING: No ${CONTAINER_PREFIX} containers found running!" >&2
  echo "   Checking all containers..." >&2
  docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | head -20 >&2
  echo "   Checking docker-compose.yml exists..." >&2
  ls -la docker-compose.yml >&2 || echo "   docker-compose.yml NOT FOUND!" >&2
  echo "   Checking /tmp/docker_start.log for errors..." >&2
  if [ -f /tmp/docker_start.log ]; then
    echo "   Last 50 lines of docker_start.log:" >&2
    tail -50 /tmp/docker_start.log >&2
  fi
else
  echo "$CONTAINER_LIST"
fi

# Verify nginx is listening on port 80
echo ""
echo "   Verifying port 80 is listening..."
if ss -tlnp 2>/dev/null | grep :80 > /dev/null || netstat -tlnp 2>/dev/null | grep :80 > /dev/null; then
  echo "   ✅ Port 80 is listening"
else
  echo "   ⚠️  WARNING: Port 80 is NOT listening"
  echo "   Checking nginx container..."
  docker logs ${CONTAINER_PREFIX}_nginx --tail 20 2>&1 || echo "   Nginx container not found"
fi

# Check if containers are running
echo ""
echo "   Checking container health..."
NGINX_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_nginx" --format "{{.Names}}" | wc -l)
FRONTEND_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_frontend" --format "{{.Names}}" | wc -l)
APP_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_app" --format "{{.Names}}" | wc -l)

if [ "$NGINX_RUNNING" -eq 0 ]; then
  echo "   ⚠️  WARNING: Nginx container is not running"
  docker ps -a --filter "name=${CONTAINER_PREFIX}_nginx" --format "{{.Names}}\t{{.Status}}" || true
  docker logs ${CONTAINER_PREFIX}_nginx --tail 30 2>&1 || true
fi

if [ "$FRONTEND_RUNNING" -eq 0 ]; then
  echo "   ⚠️  WARNING: Frontend container is not running"
  docker logs ${CONTAINER_PREFIX}_frontend --tail 20 2>&1 || true
fi

if [ "$APP_RUNNING" -eq 0 ]; then
  echo "   ⚠️  WARNING: App container is not running"
  docker logs ${CONTAINER_PREFIX}_app --tail 20 2>&1 || true
fi

echo ""
echo "✅ ApplicationStart completed"


