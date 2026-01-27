#!/bin/bash
# Test CodeDeploy agent readiness on an EC2 instance
# This allows testing without running the full pipeline

set -e

INSTANCE_ID="${1}"
PROFILE="${2:-jordan}"

if [ -z "$INSTANCE_ID" ]; then
    echo "Usage: $0 <instance-id> [aws-profile]"
    echo ""
    echo "Example:"
    echo "  $0 i-0123456789abcdef0 jordan"
    echo ""
    echo "Or auto-detect green instance:"
    echo "  $0 auto jordan"
    exit 1
fi

# Auto-detect green instance if requested
if [ "$INSTANCE_ID" = "auto" ]; then
    echo "Auto-detecting green instance..."
    INSTANCE_ID=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=bianca-staging-green" "Name=instance-state-name,Values=running" \
        --profile "$PROFILE" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
        echo "❌ ERROR: No running green instance found"
        exit 1
    fi
    echo "Found instance: $INSTANCE_ID"
fi

echo "=========================================="
echo "Testing CodeDeploy Agent Readiness"
echo "Instance: $INSTANCE_ID"
echo "Profile: $PROFILE"
echo "=========================================="
echo ""

# Check if instance exists and is running
echo "Step 1: Verifying instance state..."
INSTANCE_STATE=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text 2>/dev/null || echo "not-found")

if [ "$INSTANCE_STATE" != "running" ]; then
    echo "❌ ERROR: Instance is not running (state: $INSTANCE_STATE)"
    exit 1
fi
echo "✅ Instance is running"

# Check instance tags
echo ""
echo "Step 2: Verifying instance tags..."
INSTANCE_NAME=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' \
    --output text)

echo "Instance Name tag: $INSTANCE_NAME"
if [ "$INSTANCE_NAME" != "bianca-staging-green" ]; then
    echo "⚠️  WARNING: Instance name is not 'bianca-staging-green'"
    echo "   CodeDeploy deployment group expects: bianca-staging-green"
fi

# Check SSM connectivity
echo ""
echo "Step 3: Checking SSM connectivity..."
SSM_STATUS=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --profile "$PROFILE" \
    --query 'InstanceInformationList[0].PingStatus' \
    --output text 2>/dev/null || echo "unknown")

if [ "$SSM_STATUS" != "Online" ]; then
    echo "❌ ERROR: SSM agent is not online (status: $SSM_STATUS)"
    echo "   Cannot run remote commands. Check SSM agent installation."
    exit 1
fi
echo "✅ SSM agent is online"

# Check CodeDeploy agent via SSM
echo ""
echo "Step 4: Checking CodeDeploy agent status..."
COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=[
        "echo 'CodeDeploy Agent Status'",
        "sudo systemctl is-active codedeploy-agent 2>&1 || echo inactive",
        "echo",
        "echo 'Service Status'",
        "sudo systemctl status codedeploy-agent --no-pager 2>&1 | head -15 || echo service not found",
        "echo",
        "echo 'Process Check'",
        "pgrep -f codedeploy-agent && echo process found || echo no process",
        "echo",
        "echo 'Recent Logs last 30 lines'",
        "sudo tail -30 /var/log/aws/codedeploy-agent/codedeploy-agent.log 2>&1 || echo log file not found"
    ]' \
    --profile "$PROFILE" \
    --query 'Command.CommandId' \
    --output text)

echo "Command sent, waiting for results..."
sleep 5

MAX_WAIT=30
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
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
    --profile "$PROFILE" \
    --query 'StandardOutputContent' \
    --output text 2>/dev/null || echo "")

ERROR=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --query 'StandardErrorContent' \
    --output text 2>/dev/null || echo "")

echo "$OUTPUT"
if [ -n "$ERROR" ]; then
    echo "Errors:"
    echo "$ERROR"
fi

# Check if agent is active
if echo "$OUTPUT" | grep -q "active"; then
    echo ""
    echo "✅ CodeDeploy agent is ACTIVE"
    AGENT_READY=true
elif echo "$OUTPUT" | grep -q "inactive\|not found\|service not found"; then
    echo ""
    echo "❌ CodeDeploy agent is NOT running"
    AGENT_READY=false
else
    echo ""
    echo "⚠️  Could not determine agent status"
    AGENT_READY=false
fi

# Check IAM permissions
echo ""
echo "Step 5: Checking IAM instance profile..."
IAM_ROLE=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' \
    --output text 2>/dev/null || echo "None")

if [ "$IAM_ROLE" != "None" ] && [ -n "$IAM_ROLE" ]; then
    echo "✅ IAM instance profile: $IAM_ROLE"
else
    echo "❌ ERROR: No IAM instance profile attached"
    echo "   CodeDeploy agent needs IAM permissions to function"
    AGENT_READY=false
fi

# Summary
echo ""
echo "=========================================="
if [ "$AGENT_READY" = "true" ]; then
    echo "✅ CodeDeploy agent is READY"
    echo ""
    echo "The instance should be able to receive CodeDeploy deployments."
    echo "You can now test a deployment with:"
    echo "  ./packages/backend/devops/scripts/test-codedeploy-deployment.sh $INSTANCE_ID $PROFILE"
    exit 0
else
    echo "❌ CodeDeploy agent is NOT READY"
    echo ""
    echo "The agent needs to be installed and running before deployments can succeed."
    echo "To fix, run:"
    echo "  aws ssm send-command --instance-ids $INSTANCE_ID --document-name AWS-RunShellScript --parameters file://packages/backend/devops/scripts/fix-codedeploy-agent.sh --profile $PROFILE"
    exit 1
fi
