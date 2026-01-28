#!/bin/bash
# Script to check backend logs and diagnose SSO/API connectivity issues
# Usage: ./check-backend-logs.sh [production|staging]

set -e

ENVIRONMENT="${1:-staging}"
CONTAINER_PREFIX="$ENVIRONMENT"

echo "=== Backend Diagnostic for $ENVIRONMENT ==="
echo ""

# Detect environment if not provided
if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
  if [ -d "/opt/bianca-production" ]; then
    ENVIRONMENT="production"
    CONTAINER_PREFIX="production"
  elif [ -d "/opt/bianca-staging" ]; then
    ENVIRONMENT="staging"
    CONTAINER_PREFIX="staging"
  else
    echo "❌ Cannot determine environment. Please specify production or staging."
    exit 1
  fi
fi

DEPLOY_DIR="/opt/bianca-$ENVIRONMENT"
cd "$DEPLOY_DIR" 2>/dev/null || {
  echo "❌ Cannot access $DEPLOY_DIR"
  exit 1
}

echo "=== Container Status ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.RestartCount}}\t{{.Ports}}" | grep -E "${CONTAINER_PREFIX}_|NAMES" || echo "No ${ENVIRONMENT} containers found"
echo ""

echo "=== Backend Container Details ==="
if docker ps -a | grep -q "${CONTAINER_PREFIX}_app"; then
  echo "Backend container exists"
  docker inspect ${CONTAINER_PREFIX}_app --format 'Status: {{.State.Status}}, ExitCode: {{.State.ExitCode}}, Started: {{.State.StartedAt}}, Restarts: {{.RestartCount}}' 2>/dev/null || echo "Could not inspect container"
  
  if ! docker ps | grep -q "${CONTAINER_PREFIX}_app"; then
    echo "⚠️  WARNING: Backend container is NOT running!"
    echo ""
    echo "Last exit code:"
    docker inspect ${CONTAINER_PREFIX}_app --format '{{.State.ExitCode}}' 2>/dev/null || echo "Unknown"
    echo ""
  fi
else
  echo "❌ Backend container not found!"
fi
echo ""

echo "=== Backend Container Logs (last 100 lines) ==="
docker logs ${CONTAINER_PREFIX}_app --tail 100 2>&1 || echo "Cannot get app logs"
echo ""

echo "=== Recent Errors in Backend Logs ==="
docker logs ${CONTAINER_PREFIX}_app --tail 500 2>&1 | grep -i "error\|exception\|crash\|fatal\|panic\|failed" | tail -30 || echo "No errors found in recent logs"
echo ""

echo "=== Backend Startup Logs ==="
docker logs ${CONTAINER_PREFIX}_app 2>&1 | grep -i "listening\|started\|ready\|server\|port 3000" | tail -20 || echo "No startup logs found"
echo ""

echo "=== Testing Backend Health Endpoint ==="
if curl -f -s --max-time 5 http://localhost:3000/health > /dev/null 2>&1; then
  echo "✅ Health endpoint responds"
  curl -s http://localhost:3000/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/health
else
  echo "❌ Health endpoint does NOT respond"
  echo "   This means the backend is not running or not accessible"
fi
echo ""

echo "=== Testing API Endpoints ==="
API_ENDPOINTS=(
  "/v1/sso/login"
  "/v1/auth/login"
  "/v1/docs"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
  echo -n "Testing $endpoint: "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:3000$endpoint" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "000" ]; then
    echo "❌ Network error (cannot connect)"
  elif [ "$HTTP_CODE" = "404" ]; then
    echo "⚠️  Not found (route may not be registered)"
  elif [ "$HTTP_CODE" = "405" ]; then
    echo "⚠️  Method not allowed (endpoint exists but wrong method)"
  elif [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
    echo "✅ Responds (HTTP $HTTP_CODE)"
  else
    echo "⚠️  HTTP $HTTP_CODE"
  fi
done
echo ""

echo "=== Testing CORS Preflight ==="
echo -n "Testing OPTIONS /v1/sso/login: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -X OPTIONS \
  -H "Origin: https://app.biancawellness.com" \
  -H "Access-Control-Request-Method: POST" \
  "http://localhost:3000/v1/sso/login" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
  echo "❌ Network error"
elif [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
  echo "✅ CORS preflight works (HTTP $HTTP_CODE)"
else
  echo "⚠️  HTTP $HTTP_CODE (CORS may be blocking)"
fi
echo ""

echo "=== Nginx Container Status ==="
if docker ps | grep -q "${CONTAINER_PREFIX}_nginx"; then
  echo "✅ Nginx is running"
  echo "Nginx logs (last 20 lines):"
  docker logs ${CONTAINER_PREFIX}_nginx --tail 20 2>&1 | tail -10 || echo "Cannot get nginx logs"
else
  echo "❌ Nginx is NOT running"
fi
echo ""

echo "=== Port Status ==="
echo "Port 3000 (backend):"
ss -tlnp 2>/dev/null | grep :3000 || netstat -tlnp 2>/dev/null | grep :3000 || echo "   Port 3000 is NOT listening"
echo "Port 80 (nginx):"
ss -tlnp 2>/dev/null | grep :80 || netstat -tlnp 2>/dev/null | grep :80 || echo "   Port 80 is NOT listening"
echo ""

echo "=== Docker Compose Status ==="
docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null || echo "Cannot get docker compose status"
echo ""

echo "=== System Resources ==="
free -h | head -2
df -h / | tail -1
echo ""

echo "=== Done ==="
