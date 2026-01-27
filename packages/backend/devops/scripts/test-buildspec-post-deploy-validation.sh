#!/bin/bash
# Test the PostDeployValidation buildspec logic locally
# This simulates what CodeBuild does, including variable persistence issues

set -e

echo "=========================================="
echo "Testing PostDeployValidation Buildspec Logic"
echo "=========================================="
echo ""

# Simulate pre_build phase
echo "=== PRE_BUILD PHASE ==="
GREEN_INSTANCE_ID=""
GREEN_INSTANCE_IP=""

if [ -f instance-info.txt ]; then
  source instance-info.txt
  echo "Green instance ID: ${GREEN_INSTANCE_ID:-not found}"
  echo "Green instance IP: ${GREEN_INSTANCE_IP:-not found}"
elif [ -f ../CreateGreenInstance/instance-info.txt ]; then
  source ../CreateGreenInstance/instance-info.txt
  echo "Green instance ID: ${GREEN_INSTANCE_ID:-not found}"
  echo "Green instance IP: ${GREEN_INSTANCE_IP:-not found}"
else
  echo "⚠️  Warning: instance-info.txt not found, attempting to discover green instance..."
  # Try to find green instance by tags
  GREEN_INSTANCE_ID=$(aws ec2 describe-instances \
    --region us-east-2 \
    --profile jordan \
    --filters "Name=tag:Name,Values=bianca-staging-green" \
              "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$GREEN_INSTANCE_ID" ] && [ "$GREEN_INSTANCE_ID" != "None" ]; then
    GREEN_INSTANCE_IP=$(aws ec2 describe-instances \
      --instance-ids "$GREEN_INSTANCE_ID" \
      --region us-east-2 \
      --profile jordan \
      --query 'Reservations[0].Instances[0].PublicIpAddress' \
      --output text 2>/dev/null || echo "")
    echo "Found green instance: $GREEN_INSTANCE_ID (IP: $GREEN_INSTANCE_IP)"
  else
    echo "❌ ERROR: Cannot find green instance for validation"
    exit 1
  fi
fi

echo ""
echo "=== BUILD PHASE ==="
echo "   (Variables from pre_build: GREEN_INSTANCE_ID=$GREEN_INSTANCE_ID, GREEN_INSTANCE_IP=$GREEN_INSTANCE_IP)"

# Re-read green instance info (variables from pre_build may not persist)
if [ -f instance-info.txt ]; then
  source instance-info.txt
  echo "   Re-read from instance-info.txt"
elif [ -f ../CreateGreenInstance/instance-info.txt ]; then
  source ../CreateGreenInstance/instance-info.txt
  echo "   Re-read from ../CreateGreenInstance/instance-info.txt"
else
  # Try to find green instance by tags if not in file
  echo "   Re-discovering green instance..."
  GREEN_INSTANCE_ID=$(aws ec2 describe-instances \
    --region us-east-2 \
    --profile jordan \
    --filters "Name=tag:Name,Values=bianca-staging-green" \
              "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$GREEN_INSTANCE_ID" ] && [ "$GREEN_INSTANCE_ID" != "None" ]; then
    GREEN_INSTANCE_IP=$(aws ec2 describe-instances \
      --instance-ids "$GREEN_INSTANCE_ID" \
      --region us-east-2 \
      --profile jordan \
      --query 'Reservations[0].Instances[0].PublicIpAddress' \
      --output text 2>/dev/null || echo "")
    echo "   Discovered green instance: $GREEN_INSTANCE_ID (IP: $GREEN_INSTANCE_IP)"
  fi
fi

# Determine if we're in blue-green mode
BLUE_GREEN_MODE=false
if [ -n "$GREEN_INSTANCE_IP" ] && [ "$GREEN_INSTANCE_IP" != "None" ] && [ "$GREEN_INSTANCE_IP" != "" ]; then
  BLUE_GREEN_MODE=true
  echo "🔵 Blue-Green Mode: Validating green instance directly by IP"
  echo "   Green instance ID: ${GREEN_INSTANCE_ID:-unknown}"
  echo "   Green instance IP: $GREEN_INSTANCE_IP"
else
  echo "❌ ERROR: Cannot find green instance for validation"
  echo "   GREEN_INSTANCE_IP is empty: '$GREEN_INSTANCE_IP'"
  exit 1
fi

echo ""
echo "=== VALIDATION ==="
if [ "$BLUE_GREEN_MODE" = "true" ]; then
  echo "Testing green instance directly..."
  
  # Test API
  echo "Testing: http://${GREEN_INSTANCE_IP}:3000/health"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${GREEN_INSTANCE_IP}:3000/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API health check passed (HTTP $HTTP_CODE)"
  else
    echo "❌ API health check failed (HTTP $HTTP_CODE)"
    exit 1
  fi
  
  # Test Frontend
  echo "Testing: http://${GREEN_INSTANCE_IP}"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${GREEN_INSTANCE_IP}" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "✅ Frontend check passed (HTTP $HTTP_CODE)"
  else
    echo "❌ Frontend check failed (HTTP $HTTP_CODE)"
    exit 1
  fi
  
  echo ""
  echo "✅ Validation PASSED"
else
  echo "❌ Should not reach here - blue-green mode should be true"
  exit 1
fi
