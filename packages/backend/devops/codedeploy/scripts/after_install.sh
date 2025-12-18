#!/bin/bash
# AfterInstall hook - Pull Docker images and prepare deployment

set -e

echo "📥 AfterInstall: Pulling Docker images and preparing deployment..."

# Detect environment from instance Name tag
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
AWS_REGION="us-east-2"
INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")

# Determine environment based on instance name
if echo "$INSTANCE_NAME" | grep -qi "production"; then
  DEPLOY_DIR="/opt/bianca-production"
else
  DEPLOY_DIR="/opt/bianca-staging"
fi

echo "   Detected deployment directory: $DEPLOY_DIR"

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
# Prefer docker-compose (standalone) as it's more reliable
DOCKER_COMPOSE_CMD=""
if command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD=$(command -v docker-compose)
  echo "   Using: docker-compose (standalone) at $DOCKER_COMPOSE_CMD"
# Fallback to docker compose (plugin) if available and working
elif docker compose version >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
  echo "   Using: docker compose (plugin)"
  DOCKER_COMPOSE_CMD="docker compose"
else
  echo "❌ ERROR: Neither 'docker-compose' nor 'docker compose' is available" >&2
  echo "   Checking what's available..." >&2
  command -v docker-compose >&2 || echo "   docker-compose: not found" >&2
  docker compose version >&2 || echo "   docker compose: not working" >&2
  exit 1
fi

# Pull latest images (with timeout to prevent hangs)
# Remove old images first to force fresh pull
echo "   Removing old images to force fresh pull..."
cd "$DEPLOY_DIR"
if [ -n "$DOCKER_COMPOSE_CMD" ] && [ "$DOCKER_COMPOSE_CMD" != "docker compose" ]; then
  $DOCKER_COMPOSE_CMD down 2>/dev/null || true
else
  bash -c "$DOCKER_COMPOSE_CMD down" 2>/dev/null || true
fi
docker images | grep "bianca-app" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

echo "   Pulling latest Docker images (5 min timeout)..."
if [ -n "$DOCKER_COMPOSE_CMD" ] && [ "$DOCKER_COMPOSE_CMD" != "docker compose" ]; then
  timeout 300 $DOCKER_COMPOSE_CMD pull || {
    echo "⚠️  Image pull timed out or failed, but continuing..."
  }
else
  timeout 300 bash -c "$DOCKER_COMPOSE_CMD pull" || {
  echo "⚠️  Image pull timed out or failed, but continuing..."
}

echo "✅ AfterInstall completed"

