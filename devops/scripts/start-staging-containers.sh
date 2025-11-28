#!/bin/bash
# Start staging containers manually
# Run this if containers aren't running after CodeDeploy

set -e

echo "=== Starting Staging Containers ==="

cd /opt/bianca-staging

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml not found in /opt/bianca-staging"
  exit 1
fi

# Check if nginx.conf exists
if [ ! -f "nginx.conf" ]; then
  echo "❌ nginx.conf not found in /opt/bianca-staging"
  exit 1
fi

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Start containers
echo "Starting containers..."
docker-compose up -d --remove-orphans

# Wait for containers to start
echo "Waiting for containers to initialize..."
sleep 15

# Check container status
echo ""
echo "=== Container Status ==="
docker-compose ps

echo ""
echo "=== Checking Port 80 ==="
if ss -tlnp | grep :80 > /dev/null 2>&1 || netstat -tlnp | grep :80 > /dev/null 2>&1; then
  echo "✅ Port 80 is listening"
  ss -tlnp | grep :80 || netstat -tlnp | grep :80
else
  echo "❌ Port 80 is NOT listening"
fi

echo ""
echo "=== Container Logs ==="
echo "Nginx:"
docker logs staging_nginx --tail 10 2>&1 || echo "Nginx container not found"
echo ""
echo "Frontend:"
docker logs staging_frontend --tail 10 2>&1 || echo "Frontend container not found"
echo ""
echo "App:"
docker logs staging_app --tail 10 2>&1 || echo "App container not found"

echo ""
echo "=== Testing localhost:80 ==="
curl -I http://localhost:80 2>&1 | head -5 || echo "Cannot connect to localhost:80"

echo ""
echo "=== Done ==="









