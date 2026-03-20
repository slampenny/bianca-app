#!/bin/bash
# ApplicationStart hook - Start new containers

# Don't use set -e - we want to handle errors gracefully and provide diagnostics

echo "🚀 ApplicationStart: Starting new containers..."

# Detect environment - check /etc/environment first, then directories, then instance tags
AWS_REGION="us-east-2"

echo "   Detecting environment..."

DETECTED_ENV=""

# Method 1: Check /etc/environment file first (set by userdata)
if [ -f "/etc/environment" ]; then
  ENV_FROM_FILE=$(grep "^ENVIRONMENT=" /etc/environment 2>/dev/null | cut -d'=' -f2 | tr -d '"' | xargs)
  if [ -n "$ENV_FROM_FILE" ]; then
    echo "   ✅ Found ENVIRONMENT in /etc/environment: $ENV_FROM_FILE"
    DETECTED_ENV="$ENV_FROM_FILE"
  fi
fi

# Method 2: Check environment variables (if not already set from /etc/environment)
if [ -z "$DETECTED_ENV" ] && [ -n "$ENVIRONMENT" ]; then
  echo "   ✅ Found ENVIRONMENT variable: $ENVIRONMENT"
  DETECTED_ENV="$ENVIRONMENT"
fi

# Method 3: Check which deployment directory exists (if not already set from env vars)
if [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-production" ]; then
  echo "   ✅ Found /opt/bianca-production directory - using production"
  DETECTED_ENV="production"
elif [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-staging" ]; then
  echo "   ✅ Found /opt/bianca-staging directory - using staging"
  DETECTED_ENV="staging"
elif [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-demo" ]; then
  echo "   ✅ Found /opt/bianca-demo directory - using demo"
  DETECTED_ENV="demo"
fi

# Method 4: Fallback to instance tags (if not already set)
if [ -z "$DETECTED_ENV" ]; then
  echo "   ⚠️  No deployment directory found, trying instance tags..."
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
    echo "   ✅ Detected production from tags"
    DETECTED_ENV="production"
  elif [ "$ENVIRONMENT_TAG" = "staging" ] || echo "$INSTANCE_NAME" | grep -qi "staging"; then
    echo "   ✅ Detected staging from tags"
    DETECTED_ENV="staging"
  elif [ "$ENVIRONMENT_TAG" = "demo" ] || echo "$INSTANCE_NAME" | grep -qi "demo"; then
    echo "   ✅ Detected demo from tags"
    DETECTED_ENV="demo"
  fi
fi

# Set deployment variables based on detected environment
if [ "$DETECTED_ENV" = "production" ]; then
  DEPLOY_DIR="/opt/bianca-production"
  CONTAINER_PREFIX="production"
elif [ "$DETECTED_ENV" = "staging" ]; then
  DEPLOY_DIR="/opt/bianca-staging"
  CONTAINER_PREFIX="staging"
elif [ "$DETECTED_ENV" = "demo" ]; then
  DEPLOY_DIR="/opt/bianca-demo"
  CONTAINER_PREFIX="demo"
else
  echo "   ❌ ERROR: Cannot determine environment"
  echo "   Checked /etc/environment, environment variables, deployment directories, and instance tags"
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
# Determine environment for migrations (use detected environment)
if [ "$DETECTED_ENV" = "production" ]; then
  MIGRATION_NODE_ENV="production"
elif [ "$DETECTED_ENV" = "demo" ]; then
  MIGRATION_NODE_ENV="production"  # Demo uses production environment
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
    echo "   🔍 Verifying migration status..."
    if docker compose run --rm \
      -e NODE_ENV="$MIGRATION_NODE_ENV" \
      -e MONGODB_URL="$MONGODB_URL" \
      app \
      yarn migrate:check 2>&1; then
      echo "   ✅ All critical migrations verified"
    else
      echo "   ⚠️  Warning: Migration check reported issues (see above)"
    fi
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
    echo "   🔍 Verifying migration status..."
    if docker-compose run --rm \
      -e NODE_ENV="$MIGRATION_NODE_ENV" \
      -e MONGODB_URL="$MONGODB_URL" \
      app \
      yarn migrate:check 2>&1; then
      echo "   ✅ All critical migrations verified"
    else
      echo "   ⚠️  Warning: Migration check reported issues (see above)"
    fi
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
ASTERISK_RUNNING=$(docker ps --filter "name=${CONTAINER_PREFIX}_asterisk" --format "{{.Names}}" | wc -l)

if [ "$APP_RUNNING" -eq 0 ] || [ "$NGINX_RUNNING" -eq 0 ]; then
  echo "❌ ERROR: Required containers are not running!" >&2
  echo "   App container running: $APP_RUNNING" >&2
  echo "   Nginx container running: $NGINX_RUNNING" >&2
  EXIT_CODE=1  # Mark as failed
fi

# Asterisk is required for calls; if compose defines it but it's not running, fail deployment
if [ -f "$DEPLOY_DIR/docker-compose.yml" ] && grep -q "asterisk:" "$DEPLOY_DIR/docker-compose.yml" && [ "$ASTERISK_RUNNING" -eq 0 ]; then
  echo "❌ ERROR: Asterisk container is not running (required for phone calls)!" >&2
  echo "   Asterisk container running: $ASTERISK_RUNNING" >&2
  echo "   This can cause calls to hang up or fail after blue/green deployment." >&2
  docker logs ${CONTAINER_PREFIX}_asterisk --tail 50 2>/dev/null || echo "   (Asterisk container not found or not started)" >&2
  EXIT_CODE=1
fi

if [ "$EXIT_CODE" -ne 0 ]; then
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

# Display container status
echo ""
echo "   Container status:"
CONTAINER_LIST=$(docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep ${CONTAINER_PREFIX}_ || echo "")
if [ -n "$CONTAINER_LIST" ]; then
  echo "$CONTAINER_LIST"
else
  echo "   ⚠️  WARNING: Could not list containers" >&2
fi

echo ""
echo "✅ ApplicationStart completed - Containers started (validation will verify they're running)"
