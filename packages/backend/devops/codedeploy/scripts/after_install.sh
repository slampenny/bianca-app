#!/bin/bash
# AfterInstall hook - Pull Docker images and prepare deployment

set -e

echo "📥 AfterInstall: Pulling Docker images and preparing deployment..."

# Detect environment - use directory existence as primary method (most reliable)
AWS_REGION="us-east-2"

echo "   Detecting environment..."

# Primary method: Check which deployment directory exists
if [ -d "/opt/bianca-production" ]; then
  echo "   ✅ Found /opt/bianca-production directory - using production"
  DEPLOY_DIR="/opt/bianca-production"
elif [ -d "/opt/bianca-staging" ]; then
  echo "   ✅ Found /opt/bianca-staging directory - using staging"
  DEPLOY_DIR="/opt/bianca-staging"
else
  # Fallback: Try to get instance tags (may fail due to permissions)
  echo "   ⚠️  No deployment directory found, trying instance tags..."
  INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")
  INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")
  ENVIRONMENT_TAG=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Environment`].Value' --output text 2>/dev/null || echo "")
  
  if [ "$ENVIRONMENT_TAG" = "production" ] || echo "$INSTANCE_NAME" | grep -qi "production"; then
    echo "   ✅ Detected production from tags"
    DEPLOY_DIR="/opt/bianca-production"
  elif [ "$ENVIRONMENT_TAG" = "staging" ] || echo "$INSTANCE_NAME" | grep -qi "staging"; then
    echo "   ✅ Detected staging from tags"
    DEPLOY_DIR="/opt/bianca-staging"
  else
    echo "   ❌ ERROR: Cannot determine environment and no deployment directory found"
    exit 1
  fi
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
