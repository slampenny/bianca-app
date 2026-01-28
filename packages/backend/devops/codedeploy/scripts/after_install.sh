#!/bin/bash
# AfterInstall hook - Pull Docker images and prepare deployment

set -e

echo "📥 AfterInstall: Pulling Docker images and preparing deployment..."

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

# Set deployment directory based on detected environment
if [ "$DETECTED_ENV" = "production" ]; then
  DEPLOY_DIR="/opt/bianca-production"
elif [ "$DETECTED_ENV" = "staging" ]; then
  DEPLOY_DIR="/opt/bianca-staging"
elif [ "$DETECTED_ENV" = "demo" ]; then
  DEPLOY_DIR="/opt/bianca-demo"
else
  echo "   ❌ ERROR: Cannot determine environment"
  echo "   Checked /etc/environment, environment variables, deployment directories, and instance tags"
  exit 1
fi

echo "   ✅ Detected deployment directory: $DEPLOY_DIR"

# Clean up Docker to free up space before pulling new images
echo "   Cleaning up Docker (removing unused images, containers, volumes)..."
docker system prune -af --volumes || {
  echo "⚠️  Docker cleanup had some issues, but continuing..."
}

# Check available disk space
AVAILABLE_SPACE=$(df -h / | awk 'NR==2 {print $4}' | sed 's/G//')
echo "   Available disk space: ${AVAILABLE_SPACE}G"

# Login to ECR if needed
ECR_TOKEN_FILE=/tmp/ecr-token-$(date +%Y%m%d)
if [ ! -f "$ECR_TOKEN_FILE" ]; then
  echo "   Logging into ECR..."
  aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin 730335291008.dkr.ecr.$AWS_REGION.amazonaws.com || {
    echo "❌ ECR login failed"
    exit 1
  }
  touch "$ECR_TOKEN_FILE"
else
  echo "   Using cached ECR token"
fi

# Note: docker-compose.yml is already on the instance at $DEPLOY_DIR/docker-compose.yml
# We just need to pull the latest images

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

# Pull latest images (with timeout to prevent hangs)
# CRITICAL: Remove ALL old images first to force fresh pull
# Docker's tag-based pulls can use stale cached images even with --pull always
echo "   Removing ALL old images to force fresh pull..."
cd "$DEPLOY_DIR" || {
  echo "❌ ERROR: Cannot cd to $DEPLOY_DIR (directory may not exist yet)"
  exit 1
}
$DOCKER_COMPOSE_CMD down 2>/dev/null || true

# Remove ALL bianca-app images (by image ID, not just by name)
echo "   Removing all cached bianca-app images..."
docker images --format "{{.ID}} {{.Repository}}" | grep "bianca-app" | awk '{print $1}' | xargs -r docker rmi -f 2>/dev/null || true

# Also remove by repository name pattern
docker images | grep "bianca-app" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# Force remove any dangling images
docker image prune -af || true

echo "   Pulling latest Docker images (5 min timeout)..."
echo "   CRITICAL: Removing all cached images first ensures fresh pull from ECR..."
# docker compose pull doesn't support --pull always, but removing images first forces fresh pull
timeout 300 $DOCKER_COMPOSE_CMD pull --ignore-pull-failures || {
  echo "⚠️  Image pull timed out or failed, but continuing..."
}

# Verify we got the images and log their details
echo "   Verifying pulled images..."
$DOCKER_COMPOSE_CMD images || {
  echo "⚠️  Could not list images, but continuing..."
}

# Log image details for verification (including digests if available)
echo "   =========================================="
echo "   Image Details (for verification):"
echo "   =========================================="
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Digest}}\t{{.CreatedAt}}\t{{.ID}}" | grep -E "REPOSITORY|bianca-app" || echo "   (No bianca-app images found)"
echo "   =========================================="

# Also check what's actually in the docker-compose.yml
echo "   Docker-compose.yml image references:"
grep -E "image:.*bianca-app" "$DEPLOY_DIR/docker-compose.yml" || echo "   (No image references found)"

echo "✅ AfterInstall completed"
