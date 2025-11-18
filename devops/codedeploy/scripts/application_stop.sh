#!/bin/bash
# ApplicationStop hook - Stop old containers gracefully
# Always exit 0 - don't block deployment

set +e  # Don't exit on errors

echo "🛑 ApplicationStop: Stopping old containers..."

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

# Change to deployment directory
if ! cd "$DEPLOY_DIR" 2>/dev/null; then
  echo "   ⚠️  $DEPLOY_DIR not found, nothing to stop"
  exit 0
fi

# Check if docker-compose.yml exists and use docker-compose if available
if [ -f "docker-compose.yml" ] && command -v docker-compose >/dev/null 2>&1; then
  echo "   Stopping containers with docker-compose..."
  # Use docker-compose down with timeout to prevent hangs
  if command -v timeout >/dev/null 2>&1; then
    timeout 30 docker-compose down --remove-orphans 2>&1 || {
      echo "   ⚠️  docker-compose down timed out or failed, trying force stop..."
      timeout 10 docker-compose kill 2>&1 || true
      timeout 5 docker-compose rm -f 2>&1 || true
    }
  else
    # Fallback if timeout command not available
    docker-compose down --remove-orphans 2>&1 || {
      echo "   ⚠️  docker-compose down failed, trying force stop..."
      docker-compose kill 2>&1 || true
      docker-compose rm -f 2>&1 || true
    }
  fi
else
  echo "   docker-compose.yml not found or docker-compose not available, stopping individual containers..."
  # Fallback: stop individual containers
  CONTAINERS="${CONTAINER_PREFIX}_app ${CONTAINER_PREFIX}_frontend ${CONTAINER_PREFIX}_nginx ${CONTAINER_PREFIX}_mongodb ${CONTAINER_PREFIX}_asterisk ${CONTAINER_PREFIX}_posthog ${CONTAINER_PREFIX}_posthog_db ${CONTAINER_PREFIX}_posthog_redis"
  
  for container in $CONTAINERS; do
    # Check if container exists before trying to stop it
    if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
      echo "   Stopping $container..."
      if command -v timeout >/dev/null 2>&1; then
        timeout 5 docker stop "$container" 2>&1 || timeout 2 docker kill "$container" 2>&1 || true
        timeout 2 docker rm "$container" 2>&1 || true
      else
        docker stop "$container" 2>&1 || docker kill "$container" 2>&1 || true
        docker rm "$container" 2>&1 || true
      fi
    fi
  done
fi

echo "✅ ApplicationStop completed"
exit 0

