#!/bin/bash
# Test validate_service.sh script locally on an EC2 instance via SSM
# This allows you to test the validation script without running a full deployment

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
echo "Testing validate_service.sh on instance"
echo "Instance: $INSTANCE_ID"
echo "Profile: $PROFILE"
echo "=========================================="
echo ""

# First, copy the script to the instance
echo "Step 1: Copying validate_service.sh to instance..."
SCRIPT_PATH="packages/backend/devops/codedeploy/scripts/validate_service.sh"

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "❌ ERROR: Script not found at $SCRIPT_PATH"
  exit 1
fi

# Create a temporary directory on the instance and copy the script
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "{\"commands\":[\"mkdir -p /tmp/test-validation\",\"chmod 755 /tmp/test-validation\"]}" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query 'Command.CommandId' \
  --output text)

sleep 2

# Use AWS Systems Manager to copy the file
# We'll base64 encode it and pipe it through SSM
echo "   Uploading script..."
SCRIPT_CONTENT=$(cat "$SCRIPT_PATH" | base64 -w 0)

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "{\"commands\":[\"echo '$SCRIPT_CONTENT' | base64 -d > /tmp/test-validation/validate_service.sh\",\"chmod +x /tmp/test-validation/validate_service.sh\",\"ls -la /tmp/test-validation/validate_service.sh\"]}" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query 'Command.CommandId' \
  --output text)

echo "   Waiting for upload to complete..."
sleep 5

# Check upload status
MAX_WAIT=30
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region us-east-2 \
    --profile "$PROFILE" \
    --query 'Status' \
    --output text 2>/dev/null || echo "InProgress")
  
  if [ "$STATUS" = "Success" ] || [ "$STATUS" = "Failed" ]; then
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

OUTPUT=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query 'StandardOutputContent' \
  --output text 2>/dev/null || echo "")

if echo "$OUTPUT" | grep -q "validate_service.sh"; then
  echo "✅ Script uploaded successfully"
else
  echo "❌ ERROR: Script upload may have failed"
  echo "   Output: $OUTPUT"
  exit 1
fi

echo ""
echo "Step 2: Running validate_service.sh on instance..."
echo "   (This will test the validation logic with current container state)"
echo ""

# Run the script
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "{\"commands\":[\"cd /opt/bianca-staging && bash /tmp/test-validation/validate_service.sh\"]}" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query 'Command.CommandId' \
  --output text)

echo "   Command sent, waiting for results..."
sleep 5

MAX_WAIT=120
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region us-east-2 \
    --profile "$PROFILE" \
    --query 'Status' \
    --output text 2>/dev/null || echo "InProgress")
  
  if [ "$STATUS" = "Success" ] || [ "$STATUS" = "Failed" ]; then
    break
  fi
  echo "   Status: $STATUS (${ELAPSED}s/${MAX_WAIT}s)..."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

echo ""
echo "=========================================="
echo "Validation Results"
echo "=========================================="
echo ""

STDOUT=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query 'StandardOutputContent' \
  --output text 2>/dev/null || echo "")

STDERR=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query 'StandardErrorContent' \
  --output text 2>/dev/null || echo "")

EXIT_CODE=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region us-east-2 \
  --profile "$PROFILE" \
  --query 'ResponseCode' \
  --output text 2>/dev/null || echo "unknown")

echo "$STDOUT"
if [ -n "$STDERR" ]; then
  echo ""
  echo "Errors:"
  echo "$STDERR"
fi

echo ""
echo "Exit code: $EXIT_CODE"

if [ "$EXIT_CODE" = "0" ]; then
  echo ""
  echo "✅ Validation passed!"
  exit 0
else
  echo ""
  echo "❌ Validation failed (exit code: $EXIT_CODE)"
  exit 1
fi
