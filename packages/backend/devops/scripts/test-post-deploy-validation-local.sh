#!/bin/bash
# Test PostDeployValidation buildspec locally
# This simulates the exact validation that runs in CodeBuild

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
    echo "   Please provide an instance ID: $0 <instance-id> <profile>"
    exit 1
  fi
  echo "Found instance: $INSTANCE_ID"
fi

echo "=========================================="
echo "Testing PostDeployValidation locally"
echo "Instance: $INSTANCE_ID"
echo "Profile: $PROFILE"
echo "=========================================="
echo ""

# Get green instance IP
echo "Step 1: Getting green instance IP..."
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

echo "✅ Green instance IP: $GREEN_INSTANCE_IP"
echo ""

# Test the validation logic locally
echo "Step 2: Testing validation logic..."
echo "   This simulates the exact test_url function from buildspec-post-deploy-validation.yml"
echo ""

# Function to test URL (same as buildspec)
test_url() {
  local url=$1
  local description=$2
  local max_retries=${3:-20}
  local retry_delay=${4:-10}
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
      echo "⚠️  $description connection failed (attempt $attempt/$max_retries)"
      echo "   Error: ${RESPONSE_BODY:0:200}"
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
if ! test_url "$GREEN_API_URL/health" "Green instance API health endpoint" 20 10; then
  VALIDATION_FAILED=true
fi

# Test frontend on green instance (port 80 via nginx)
GREEN_FRONTEND_URL="http://${GREEN_INSTANCE_IP}"
if ! test_url "$GREEN_FRONTEND_URL" "Green instance Frontend" 20 10; then
  VALIDATION_FAILED=true
fi

echo ""
if [ "$VALIDATION_FAILED" = "true" ]; then
  echo "❌ Post-deployment validation FAILED"
  echo "   Green instance validation failed - instance is not healthy"
  echo "   Green instance ID: $INSTANCE_ID"
  echo "   Green instance IP: $GREEN_INSTANCE_IP"
  echo ""
  echo "   This means the pipeline will NOT swap traffic"
  echo "   Blue instance will remain serving traffic"
  exit 1
else
  echo "✅ Post-deployment validation PASSED"
  echo "   Green instance is healthy and ready for traffic swap"
  exit 0
fi
