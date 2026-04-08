#!/bin/bash
# Test script to verify NODE_ENV is correctly passed to Docker container
# This mimics what CodePipeline does in buildspec-playwright.yml

set -e

echo "=== Testing Docker Container NODE_ENV ==="

# Get the repo root directory
# Script is in packages/backend/scripts/, so go up 2 levels to get repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"

# Build or use existing image
IMAGE_NAME="bianca-app-backend:test"
# Try to use staging image if it exists (faster for testing)
if docker images | grep -q "bianca-app-backend.*staging"; then
  STAGING_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "bianca-app-backend.*staging" | head -1)
  echo "Using existing staging image: $STAGING_IMAGE"
  docker tag "$STAGING_IMAGE" "$IMAGE_NAME" 2>/dev/null || true
fi

if ! docker images | grep -q "$IMAGE_NAME"; then
  echo "Building Docker image from $BACKEND_DIR..."
  echo "This may take several minutes on first run..."
  cd "$BACKEND_DIR"
  # Dockerfile expects to be built from packages/backend directory
  docker build -f docker/Dockerfile -t "$IMAGE_NAME" .
fi

# Stop and remove existing container if it exists
docker stop backend-test 2>/dev/null || true
docker rm backend-test 2>/dev/null || true

# Start MongoDB if not running
if ! docker ps | grep -q mongodb; then
  echo "Starting MongoDB..."
  docker run -d --name mongodb-test -p 27017:27017 mongo:6.0 || true
  sleep 2
fi

# Start backend container with NODE_ENV=test (mimicking CodePipeline)
echo "Starting backend container with NODE_ENV=test..."
docker run -d --name backend-test \
  --network host \
  -e NODE_ENV=test \
  -e MONGODB_URL=mongodb://localhost:27017/bianca-app-test \
  -e FORCE_ETHEREAL=true \
  -e JWT_SECRET=test-jwt-secret \
  -e STRIPE_SECRET_KEY=sk_test_dummy \
  -e STRIPE_PUBLISHABLE_KEY=pk_test_dummy \
  -e OPENAI_API_KEY=test-key \
  -e MFA_ENCRYPTION_KEY=test-encryption-key \
  -e TWILIO_AUTHTOKEN=test-token \
  "$IMAGE_NAME"

# Wait for backend to be ready
echo "Waiting for backend to start..."
i=1
while [ $i -le 60 ]; do
  if curl -f http://localhost:3000/health 2>/dev/null; then
    echo "✅ Backend is ready!"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "❌ Backend failed to start"
    docker logs backend-test || true
    exit 1
  fi
  sleep 2
  i=$((i + 1))
done

# Verify NODE_ENV
echo ""
echo "=== Environment Verification ==="
CONTAINER_NODE_ENV=$(docker exec backend-test printenv NODE_ENV 2>/dev/null || echo "NOT_SET")
echo "NODE_ENV in container: $CONTAINER_NODE_ENV"

# Check backend logs
echo ""
echo "Backend startup logs (NODE_ENV related):"
docker logs backend-test 2>&1 | grep -i "NODE_ENV\|Environment:" | head -10 || echo "No NODE_ENV logs found"

# Check health endpoint
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health 2>/dev/null || echo "{}")
BACKEND_ENV=$(echo "$HEALTH_RESPONSE" | grep -o '"environment":"[^"]*"' | cut -d'"' -f4 || echo "UNKNOWN")
echo ""
echo "Backend config.env from /health: $BACKEND_ENV"

# Verify
if [ "$CONTAINER_NODE_ENV" != "test" ] || [ "$BACKEND_ENV" != "test" ]; then
  echo ""
  echo "❌ ERROR: Backend is not in test mode!"
  echo "  Container NODE_ENV: $CONTAINER_NODE_ENV"
  echo "  Backend config.env: $BACKEND_ENV"
  echo ""
  echo "Full backend logs:"
  docker logs backend-test --tail 50 || true
  exit 1
fi

echo ""
echo "✅ SUCCESS: Backend is confirmed to be in test mode!"
echo "  Container NODE_ENV: $CONTAINER_NODE_ENV"
echo "  Backend config.env: $BACKEND_ENV"

# Cleanup option
echo ""
read -p "Stop and remove containers? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  docker stop backend-test mongodb-test 2>/dev/null || true
  docker rm backend-test mongodb-test 2>/dev/null || true
  echo "Containers stopped and removed"
fi
