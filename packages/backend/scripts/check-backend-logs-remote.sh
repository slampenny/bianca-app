#!/bin/bash
# Script to check backend logs remotely via SSM using jordan AWS profile
# Usage: ./check-backend-logs-remote.sh [production|staging]

set -e

AWS_PROFILE="jordan"
AWS_REGION="us-east-2"
ENVIRONMENT="${1:-staging}"

if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
  echo "❌ Invalid environment. Use 'production' or 'staging'"
  exit 1
fi

echo "=== Remote Backend Diagnostic for $ENVIRONMENT ==="
echo "Using AWS profile: $AWS_PROFILE"
echo ""

# Get instance ID
echo "Finding ${ENVIRONMENT} instance..."
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=bianca-${ENVIRONMENT}" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" == "None" ]; then
  echo "❌ Could not find running ${ENVIRONMENT} instance"
  exit 1
fi

echo "✅ Found instance: $INSTANCE_ID"
echo ""

# Check if SSM is available
echo "Checking SSM availability..."
SSM_STATUS=$(aws ssm describe-instance-information \
  --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'InstanceInformationList[0].PingStatus' \
  --output text 2>/dev/null || echo "Unknown")

if [ "$SSM_STATUS" != "Online" ]; then
  echo "❌ SSM is not available for this instance (Status: $SSM_STATUS)"
  echo ""
  echo "💡 Alternative: SSH into the instance and run the diagnostic script:"
  INSTANCE_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [ -n "$INSTANCE_IP" ] && [ "$INSTANCE_IP" != "None" ]; then
    echo "   ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@$INSTANCE_IP"
    echo "   cd /opt/bianca-${ENVIRONMENT}"
    echo "   bash /opt/bianca-deployment/scripts/check-backend-logs.sh ${ENVIRONMENT}"
  fi
  exit 1
fi

echo "✅ SSM is available"
echo ""

# Create diagnostic script to run on remote instance
DIAGNOSTIC_SCRIPT=$(cat <<'EOF'
#!/bin/bash
ENVIRONMENT="${1:-staging}"
CONTAINER_PREFIX="$ENVIRONMENT"
DEPLOY_DIR="/opt/bianca-$ENVIRONMENT"

cd "$DEPLOY_DIR" 2>/dev/null || {
  echo "❌ Cannot access $DEPLOY_DIR"
  exit 1
}

echo "=== Container Status ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.RestartCount}}" | grep -E "${CONTAINER_PREFIX}_|NAMES" || echo "No ${ENVIRONMENT} containers found"
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
  curl -s http://localhost:3000/health | head -5
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
EOF
)

# Base64 encode the script
SCRIPT_B64=$(echo "$DIAGNOSTIC_SCRIPT" | base64 -w 0)

# Create command to upload and run script
COMMAND="
  echo '$SCRIPT_B64' | base64 -d > /tmp/check-backend-logs-remote.sh
  chmod +x /tmp/check-backend-logs-remote.sh
  bash /tmp/check-backend-logs-remote.sh $ENVIRONMENT
  rm -f /tmp/check-backend-logs-remote.sh
"

# Escape for JSON
COMMAND_ESCAPED=$(echo "$COMMAND" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

echo "📤 Sending diagnostic command via SSM..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "{\"commands\":[\"$COMMAND_ESCAPED\"]}" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'Command.CommandId' \
  --output text 2>&1)

if [ -z "$COMMAND_ID" ] || echo "$COMMAND_ID" | grep -qi "error"; then
  echo "❌ Failed to send SSM command"
  echo "   Error: $COMMAND_ID"
  exit 1
fi

echo "✅ Command sent (Command ID: $COMMAND_ID)"
echo "⏳ Waiting for command to complete..."
echo ""

# Wait for command to complete
aws ssm wait command-executed \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" || true

# Get command output
echo "📋 Diagnostic Output:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query '[StandardOutputContent, StandardErrorContent]' \
  --output text

# Check exit status
STATUS=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'Status' \
  --output text)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$STATUS" == "Success" ]; then
  echo "✅ Diagnostic completed successfully!"
else
  echo "⚠️  Diagnostic completed with status: $STATUS"
fi
