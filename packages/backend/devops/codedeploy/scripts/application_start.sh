#!/bin/bash
# ApplicationStart hook - Start new containers

# Don't use set -e - we want to handle errors gracefully and provide diagnostics

echo "🚀 ApplicationStart: Starting new containers..."

# Detect environment from instance Name tag or Environment tag
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
AWS_REGION="us-east-2"
INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")
ENVIRONMENT_TAG=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Environment`].Value' --output text 2>/dev/null || echo "")

echo "   Instance ID: $INSTANCE_ID"
echo "   Instance Name tag: $INSTANCE_NAME"
echo "   Environment tag: $ENVIRONMENT_TAG"

# Determine environment based on multiple checks
# 1. Check Environment tag first (most reliable)
# 2. Check instance name
# 3. Check which deployment directory exists
# 4. Default to production if deploying via production pipeline
if [ "$ENVIRONMENT_TAG" = "production" ] || echo "$INSTANCE_NAME" | grep -qi "production"; then
  DEPLOY_DIR="/opt/bianca-production"
  CONTAINER_PREFIX="production"
elif [ "$ENVIRONMENT_TAG" = "staging" ] || echo "$INSTANCE_NAME" | grep -qi "staging"; then
  DEPLOY_DIR="/opt/bianca-staging"
  CONTAINER_PREFIX="staging"
elif [ -d "/opt/bianca-production" ] && [ -f "/opt/bianca-production/docker-compose.yml" ]; then
  echo "   ⚠️  Environment detection unclear, but /opt/bianca-production exists, using production"
  DEPLOY_DIR="/opt/bianca-production"
  CONTAINER_PREFIX="production"
elif [ -d "/opt/bianca-staging" ] && [ -f "/opt/bianca-staging/docker-compose.yml" ]; then
  echo "   ⚠️  Environment detection unclear, but /opt/bianca-staging exists, using staging"
  DEPLOY_DIR="/opt/bianca-staging"
  CONTAINER_PREFIX="staging"
else
  echo "   ❌ ERROR: Cannot determine environment and no deployment directory found"
  echo "   Instance Name: $INSTANCE_NAME"
  echo "   Environment Tag: $ENVIRONMENT_TAG"
  exit 1
fi

echo "   ✅ Detected deployment directory: $DEPLOY_DIR"
echo "   ✅ Using container prefix: $CONTAINER_PREFIX"

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
# Prefer docker compose (plugin) - matches local development setup
# Fallback to docker-compose (standalone) for backwards compatibility
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
  echo "   Using: docker compose (plugin)"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker-compose"
  echo "   Using: docker-compose (standalone)"
else
  echo "❌ ERROR: Neither 'docker compose' nor 'docker-compose' is available" >&2
  exit 1
fi

# Ensure ECR is logged in (always re-authenticate - tokens expire after 12 hours)
echo "   Logging into ECR (tokens expire, so we always re-authenticate)..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin 730335291008.dkr.ecr.$AWS_REGION.amazonaws.com || {
  echo "❌ ERROR: ECR login failed" >&2
  echo "   This is required to pull Docker images from ECR" >&2
  exit 1
}
echo "   ✅ ECR login successful"

# Ensure we're in the deploy directory
cd "$DEPLOY_DIR" || {
  echo "❌ ERROR: Cannot cd to $DEPLOY_DIR" >&2
  exit 1
}

# Stop any existing containers first
echo "   Stopping any existing containers..."
$DOCKER_COMPOSE_CMD down 2>/dev/null || true

# Validate docker-compose.yml syntax before starting
echo "   Validating docker-compose.yml..."
if [ "$DOCKER_COMPOSE_CMD" = "docker compose" ]; then
  if ! docker compose config > /dev/null 2>&1; then
    echo "❌ ERROR: docker-compose.yml has syntax errors!" >&2
    docker compose config 2>&1 | head -30 >&2
    exit 1
  fi
else
  if ! docker-compose config > /dev/null 2>&1; then
    echo "❌ ERROR: docker-compose.yml has syntax errors!" >&2
    docker-compose config 2>&1 | head -30 >&2
    exit 1
  fi
fi
echo "   ✅ docker-compose.yml is valid"

# Step 1: Start MongoDB first (needed for migrations)
echo ""
echo "   📊 Step 1: Starting MongoDB for migrations..."
if [ "$DOCKER_COMPOSE_CMD" = "docker compose" ]; then
  docker compose up -d mongodb
else
  docker-compose up -d mongodb
fi

# Wait for MongoDB to be ready (max 60 seconds)
echo "   ⏳ Waiting for MongoDB to be ready..."
MONGODB_READY=false
for i in {1..60}; do
  if docker exec ${CONTAINER_PREFIX}_mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    MONGODB_READY=true
    break
  fi
  sleep 1
done

if [ "$MONGODB_READY" = "false" ]; then
  echo "   ⚠️  WARNING: MongoDB may not be fully ready, but continuing with migrations..."
else
  echo "   ✅ MongoDB is ready"
fi

# Step 2: Run database migrations
echo ""
echo "   🔄 Step 2: Running database migrations..."
# Determine environment for migrations
if echo "$INSTANCE_NAME" | grep -qi "production"; then
  MIGRATION_NODE_ENV="production"
else
  MIGRATION_NODE_ENV="staging"
fi

# Get MongoDB URL from docker-compose environment (same as app container will use)
MONGODB_URL="mongodb://mongodb:27017/bianca-service"

# Run migrations using docker compose run (automatically connects to correct network)
# This uses the app service definition but runs a one-off command
# Working directory in container is /usr/src/bianca-app (set in Dockerfile)
echo "   Running: yarn migrate:up"
if [ "$DOCKER_COMPOSE_CMD" = "docker compose" ]; then
  if docker compose run --rm \
    -e NODE_ENV="$MIGRATION_NODE_ENV" \
    -e MONGODB_URL="$MONGODB_URL" \
    app \
    yarn migrate:up; then
    echo "   ✅ Migrations completed successfully"
  else
    MIGRATION_EXIT_CODE=$?
    echo "   ❌ ERROR: Migrations failed with exit code: $MIGRATION_EXIT_CODE" >&2
    echo "   ⚠️  WARNING: Continuing with deployment, but database may not be up-to-date" >&2
    echo "   💡 You may need to run migrations manually:" >&2
    echo "      cd $DEPLOY_DIR && docker compose run --rm -e NODE_ENV=$MIGRATION_NODE_ENV -e MONGODB_URL=$MONGODB_URL app yarn migrate:up" >&2
    # Don't exit - allow deployment to continue, but log the error
  fi
else
  if docker-compose run --rm \
    -e NODE_ENV="$MIGRATION_NODE_ENV" \
    -e MONGODB_URL="$MONGODB_URL" \
    app \
    yarn migrate:up; then
    echo "   ✅ Migrations completed successfully"
  else
    MIGRATION_EXIT_CODE=$?
    echo "   ❌ ERROR: Migrations failed with exit code: $MIGRATION_EXIT_CODE" >&2
    echo "   ⚠️  WARNING: Continuing with deployment, but database may not be up-to-date" >&2
    echo "   💡 You may need to run migrations manually:" >&2
    echo "      cd $DEPLOY_DIR && docker-compose run --rm -e NODE_ENV=$MIGRATION_NODE_ENV -e MONGODB_URL=$MONGODB_URL app yarn migrate:up" >&2
    # Don't exit - allow deployment to continue, but log the error
  fi
fi

# Step 3: Start all containers
echo ""
echo "   🚀 Step 3: Starting all containers with --pull always to ensure latest images..."
echo "   CRITICAL: This will force Docker to check ECR for image updates..."
if [ "$DOCKER_COMPOSE_CMD" = "docker compose" ]; then
  docker compose up -d --pull always --force-recreate --remove-orphans > /tmp/docker_start.log 2>&1 &
else
  docker-compose up -d --pull always --force-recreate --remove-orphans > /tmp/docker_start.log 2>&1 &
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
  echo "   ⚠️  Container start taking too long, killing process..." >&2
  kill $DOCKER_PID 2>/dev/null || true
  wait $DOCKER_PID 2>/dev/null || true
  EXIT_CODE=1  # Mark as failed since it timed out
fi

# Always check if containers actually started, regardless of exit code
sleep 3  # Give containers a moment to start
APP_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_app" --format "{{.Names}}" | wc -l)
NGINX_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_nginx" --format "{{.Names}}" | wc -l)

if [ "$APP_RUNNING" -eq 0 ] || [ "$NGINX_RUNNING" -eq 0 ]; then
  echo "❌ ERROR: Required containers are not running!" >&2
  echo "   App container running: $APP_RUNNING" >&2
  echo "   Nginx container running: $NGINX_RUNNING" >&2
  EXIT_CODE=1  # Mark as failed
  
  # Check for stopped containers
  echo "   Checking for stopped containers..." >&2
  docker ps -a --filter "name=${CONTAINER_PREFIX}_" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" >&2 || true
  
  # Check docker compose logs for errors
  echo "   Checking docker compose logs for errors..." >&2
  cd "$DEPLOY_DIR" && docker compose logs --tail 50 2>&1 || true
  
  # Check docker_start.log
  if [ -f /tmp/docker_start.log ]; then
    echo "   Docker compose startup log:" >&2
    tail -50 /tmp/docker_start.log >&2 || true
  fi
fi

if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ ERROR: Failed to start containers (exit code: $EXIT_CODE)" >&2
  echo "   Checking for errors..." >&2
  if [ -f /tmp/docker_start.log ]; then
    echo "   Docker compose output:" >&2
    tail -100 /tmp/docker_start.log >&2 || true
  fi
  echo "   Checking docker compose logs..." >&2
  cd "$DEPLOY_DIR" && $DOCKER_COMPOSE_CMD logs --tail 50 2>&1 || true
  echo "   Container status:" >&2
  docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep ${CONTAINER_PREFIX}_ || echo "   No ${CONTAINER_PREFIX} containers found" >&2
  echo "   All containers:" >&2
  docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | head -20 >&2 || true
  echo "   Checking docker-compose.yml syntax..." >&2
  cd "$DEPLOY_DIR" && $DOCKER_COMPOSE_CMD config 2>&1 | head -20 || echo "   docker-compose.yml has syntax errors!" >&2
  echo "❌ ApplicationStart FAILED - Containers did not start successfully" >&2
  exit 1
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
