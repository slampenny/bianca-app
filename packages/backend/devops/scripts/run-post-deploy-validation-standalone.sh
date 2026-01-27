#!/bin/bash
# Standalone PostDeployValidation - runs the exact same logic as CodeBuild
# This can be run independently without CodePipeline artifacts

set -e

INSTANCE_ID="${1:-auto}"
PROFILE="${2:-jordan}"

if [ "$INSTANCE_ID" = "auto" ]; then
  echo "Auto-detecting green instance..."
  INSTANCE_ID=$(aws ec2 describe-instances \
    --region us-east-2 \
    --profile "$PROFILE" \
    --filters "Name=tag:Name,Values=bianca-staging-green" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
    echo "❌ ERROR: No running green instance found"
    exit 1
  fi
fi

echo "=========================================="
echo "Standalone PostDeployValidation"
echo "Instance: $INSTANCE_ID"
echo "Profile: $PROFILE"
echo "=========================================="
echo ""

# Get green instance IP
GREEN_INSTANCE_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text 2>/dev/null || echo "")

if [ -z "$GREEN_INSTANCE_IP" ] || [ "$GREEN_INSTANCE_IP" = "None" ]; then
  echo "❌ ERROR: Cannot get IP for instance $INSTANCE_ID"
  exit 1
fi

echo "Green instance IP: $GREEN_INSTANCE_IP"
echo ""

# Set environment variables (same as CodeBuild)
export FRONTEND_URL="https://staging.biancawellness.com"
export API_URL="https://staging-api.biancawellness.com"
export MAX_RETRIES="20"
export RETRY_DELAY="10"
export GREEN_INSTANCE_ID="$INSTANCE_ID"
export GREEN_INSTANCE_IP="$GREEN_INSTANCE_IP"

# Wait for instance to be ready (same logic as buildspec)
echo "Waiting for green instance containers to be ready..."
echo "   This can take 2-3 minutes after CodeDeploy completes..."

MAX_WAIT=180
ELAPSED=0
READY=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 --connect-timeout 3 "http://${GREEN_INSTANCE_IP}:3000/health" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Green instance is ready (HTTP $HTTP_CODE after ${ELAPSED}s)"
    READY=true
    break
  fi
  
  if [ $((ELAPSED % 30)) -eq 0 ]; then
    echo "   Waiting... (${ELAPSED}s/${MAX_WAIT}s) - HTTP code: $HTTP_CODE"
  fi
  
  sleep 10
  ELAPSED=$((ELAPSED + 10))
done

if [ "$READY" != "true" ]; then
  echo "   ⚠️  Warning: Green instance not fully ready after ${MAX_WAIT}s"
  echo "   Continuing with validation anyway..."
fi

echo ""

# test_url function (exact copy from buildspec)
test_url() {
  local url=$1
  local description=$2
  local max_retries=${MAX_RETRIES:-20}
  local retry_delay=${RETRY_DELAY:-10}
  local attempt=1
  
  echo "Testing $description: $url"
  
  while [ $attempt -le $max_retries ]; do
    RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 30 --connect-timeout 10 "$url" 2>&1 || echo -e "\n000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
      echo "✅ $description is accessible (HTTP $HTTP_CODE, attempt $attempt)"
      return 0
    elif [ "$HTTP_CODE" = "503" ]; then
      echo "❌ $description returned 503 Service Unavailable (attempt $attempt/$max_retries)"
      echo "   Response: ${RESPONSE_BODY:0:200}"
    elif [ "$HTTP_CODE" = "000" ]; then
      echo "⚠️  $description connection failed (attempt $attempt/$max_retries) - may still be deploying"
      echo "   Error: ${RESPONSE_BODY:0:200}"
      echo "   DEBUG: This usually means connection refused or timeout"
      echo "   DEBUG: Check security groups allow access from CodeBuild IP ranges"
      echo "   DEBUG: Or instance may not be ready yet"
    elif [ "$HTTP_CODE" = "502" ] || [ "$HTTP_CODE" = "504" ]; then
      echo "⚠️  $description returned HTTP $HTTP_CODE Bad Gateway (attempt $attempt/$max_retries)"
      echo "   Response: ${RESPONSE_BODY:0:200}"
    else
      echo "⚠️  $description returned HTTP $HTTP_CODE (attempt $attempt/$max_retries)"
      echo "   Response: ${RESPONSE_BODY:0:200}"
    fi
    
    if [ $attempt -lt $max_retries ]; then
      echo "   Waiting ${retry_delay}s before retry..."
      sleep $retry_delay
    fi
    attempt=$((attempt + 1))
  done
  
  echo "❌ $description validation FAILED after $max_retries attempts"
  echo "   Final HTTP code: $HTTP_CODE"
  echo "   URL: $url"
  return 1
}

# Track failures
VALIDATION_FAILED=false

echo "Testing green instance directly (bypassing ALB)..."
echo ""

# Test API on green instance (port 3000)
GREEN_API_URL="http://${GREEN_INSTANCE_IP}:3000"
if ! test_url "$GREEN_API_URL/health" "Green instance API health endpoint"; then
  VALIDATION_FAILED=true
fi

# Test frontend on green instance (port 80 via nginx)
GREEN_FRONTEND_URL="http://${GREEN_INSTANCE_IP}"
if ! test_url "$GREEN_FRONTEND_URL" "Green instance Frontend"; then
  VALIDATION_FAILED=true
fi

echo ""

if [ "$VALIDATION_FAILED" = "true" ]; then
  echo "❌ Post-deployment validation FAILED"
  echo "   Green instance validation failed - instance is not healthy"
  echo "   Green instance ID: $INSTANCE_ID"
  echo "   Green instance IP: $GREEN_INSTANCE_IP"
  echo ""
  echo "   CRITICAL: Green instance failed validation - will NOT swap traffic"
  echo "   Blue instance will remain serving traffic to prevent downtime"
  exit 1
else
  echo "✅ Post-deployment validation PASSED"
  echo "   Green instance is healthy and ready for traffic swap"
  echo ""
  echo "   Next step: Run SwapAndTerminate stage"
  exit 0
fi
