#!/bin/bash
# Diagnostic script to check demo environment status

set -e

AWS_PROFILE="jordan"
REGION="us-east-2"

echo "🔍 Diagnosing demo environment (demo.biancawellness.com)..."
echo ""

# Get demo instance info
INSTANCE_INFO=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=bianca-demo" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress,State.Name]' \
  --output text \
  --profile $AWS_PROFILE \
  --region $REGION)

if [ -z "$INSTANCE_INFO" ] || [ "$INSTANCE_INFO" = "None" ]; then
  echo "❌ Could not find running demo instance"
  echo "   Checking if instance exists but is stopped..."
  STOPPED_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=bianca-demo" \
    --query 'Reservations[0].Instances[0].[InstanceId,State.Name]' \
    --output text \
    --profile $AWS_PROFILE \
    --region $REGION 2>/dev/null || echo "")
  
  if [ -n "$STOPPED_INSTANCE" ] && [ "$STOPPED_INSTANCE" != "None" ]; then
    echo "   ⚠️  Demo instance exists but is not running"
    echo "   Run: yarn demo:up (or cd packages/backend/scripts && ./demo-up-aws.sh)"
  else
    echo "   ❌ Demo instance not found. Please check Terraform deployment."
  fi
  exit 1
fi

INSTANCE_ID=$(echo "$INSTANCE_INFO" | awk '{print $1}')
INSTANCE_IP=$(echo "$INSTANCE_INFO" | awk '{print $2}')
INSTANCE_STATE=$(echo "$INSTANCE_INFO" | awk '{print $3}')

echo "📍 Demo instance:"
echo "   Instance ID: $INSTANCE_ID"
echo "   IP Address: $INSTANCE_IP"
echo "   State: $INSTANCE_STATE"
echo ""

# Check SSM availability
SSM_STATUS=$(aws ssm describe-instance-information \
  --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
  --profile $AWS_PROFILE \
  --region $REGION \
  --query 'InstanceInformationList[0].PingStatus' \
  --output text 2>/dev/null || echo "Offline")

if [ "$SSM_STATUS" == "Online" ]; then
  echo "✅ SSM is available - using SSM to execute commands"
  USE_SSM=true
else
  echo "⚠️  SSM is not available (Status: $SSM_STATUS)"
  echo "   Will attempt SSH connection..."
  USE_SSM=false
fi

echo ""
echo "📦 Checking Docker containers..."

if [ "$USE_SSM" = true ]; then
  # Use SSM
  aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters '{
      "commands": [
        "echo '=== Container Status ==='",
        "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'demo_|NAMES' || echo 'No demo containers found'",
        "echo ''",
        "echo '=== All Containers (including stopped) ==='",
        "docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'demo_|NAMES' || echo 'No demo containers found'",
        "echo ''",
        "echo '=== Nginx Container Details ==='",
        "if docker ps -a | grep -q demo_nginx; then",
        "  echo 'Nginx container exists'",
        "  docker inspect demo_nginx --format 'Status: {{.State.Status}}' 2>/dev/null || echo 'Could not inspect nginx container'",
        "  echo ''",
        "  echo 'Nginx Logs (last 30 lines):'",
        "  docker logs demo_nginx --tail 30 2>/dev/null || echo 'Could not get nginx logs'",
        "  echo ''",
        "  echo 'Nginx Config:'",
        "  docker exec demo_nginx cat /etc/nginx/conf.d/default.conf 2>/dev/null | head -50 || echo 'Could not read nginx config'",
        "else",
        "  echo '❌ Nginx container not found'",
        "fi",
        "echo ''",
        "echo '=== Frontend Container Details ==='",
        "if docker ps -a | grep -q demo_frontend; then",
        "  echo 'Frontend container exists'",
        "  docker inspect demo_frontend --format 'Status: {{.State.Status}}' 2>/dev/null || echo 'Could not inspect frontend container'",
        "  echo ''",
        "  echo 'Frontend Logs (last 30 lines):'",
        "  docker logs demo_frontend --tail 30 2>/dev/null || echo 'Could not get frontend logs'",
        "else",
        "  echo '❌ Frontend container not found'",
        "fi",
        "echo ''",
        "echo '=== App Container Details ==='",
        "if docker ps -a | grep -q demo_app; then",
        "  echo \"App container exists\"",
        "  docker inspect demo_app --format \"Status: {{.State.Status}}\" 2>/dev/null || echo \"Could not inspect app container\"",
        "  echo \"\"",
        "  echo \"App Logs (last 30 lines):\"",
        "  docker logs demo_app --tail 30 2>/dev/null || echo \"Could not get app logs\"",
        "else",
        "  echo \"❌ App container not found\"",
        "fi",
        "echo \"\"",
        "echo === Docker Networks ===",
        "docker network ls",
        "echo \"\"",
        "echo === Testing Connectivity ===",
        "if docker ps | grep -q demo_nginx; then",
        "  echo \"Testing nginx can reach frontend...\"",
        "  docker exec demo_nginx ping -c 2 frontend 2>/dev/null || echo \"❌ Cannot ping frontend hostname\"",
        "  echo \"\"",
        "  echo \"Testing nginx can reach app...\"",
        "  docker exec demo_nginx ping -c 2 app 2>/dev/null || echo \"❌ Cannot ping app hostname\"",
        "fi",
        "echo \"\"",
        "echo === Port Status ===",
        "ss -tlnp 2>/dev/null | grep :80 || netstat -tlnp 2>/dev/null | grep :80 || echo \"Port 80 not listening\"",
        "ss -tlnp 2>/dev/null | grep :3000 || netstat -tlnp 2>/dev/null | grep :3000 || echo \"Port 3000 not listening\"",
        "echo \"\"",
        "echo === Docker Compose Status ===",
        "cd /opt/bianca-demo && docker compose ps 2>/dev/null || echo \"Could not get docker compose status\"",
        "echo \"\"",
        "echo === Nginx Config File on Host ===",
        "if [ -f /opt/bianca-demo/nginx.conf ]; then",
        "  echo \"nginx.conf exists:\"",
        "  head -50 /opt/bianca-demo/nginx.conf",
        "else",
        "  echo \"❌ nginx.conf not found in /opt/bianca-demo/\"",
        "fi"
      ]
    }' \
    --profile "$AWS_PROFILE" \
    --region "$REGION" \
    --output json > /tmp/ssm-command.json

  # Extract command ID from JSON response (works without jq)
  COMMAND_ID=$(grep -o '"CommandId":\s*"[^"]*"' /tmp/ssm-command.json | head -1 | sed 's/.*"CommandId":\s*"\([^"]*\)".*/\1/')
  
  if [ -z "$COMMAND_ID" ] || [ "$COMMAND_ID" = "null" ]; then
    echo "❌ Failed to get command ID from SSM response"
    echo "   Response file: /tmp/ssm-command.json"
    cat /tmp/ssm-command.json
    exit 1
  fi
  
  echo "   Command ID: $COMMAND_ID"
  echo ""
  echo "⏳ Waiting for command to complete..."
  sleep 5

  # Poll for completion
  for i in {1..30}; do
    STATUS=$(aws ssm get-command-invocation \
      --command-id "$COMMAND_ID" \
      --instance-id "$INSTANCE_ID" \
      --profile "$AWS_PROFILE" \
      --region "$REGION" \
      --query 'Status' \
      --output text 2>/dev/null || echo "InProgress")
    
    if [ "$STATUS" = "Success" ] || [ "$STATUS" = "Failed" ] || [ "$STATUS" = "Cancelled" ]; then
      break
    fi
    sleep 2
  done

  echo ""
  echo "📋 Command output:"
  aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$AWS_PROFILE" \
    --region "$REGION" \
    --query 'StandardOutputContent' \
    --output text 2>/dev/null
  
  ERROR_OUTPUT=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$AWS_PROFILE" \
    --region "$REGION" \
    --query 'StandardErrorContent' \
    --output text 2>/dev/null)
  
  if [ -n "$ERROR_OUTPUT" ] && [ "$ERROR_OUTPUT" != "None" ]; then
    echo ""
    echo "⚠️  Errors:"
    echo "$ERROR_OUTPUT"
  fi

else
  # Use SSH
  SSH_KEY="${HOME}/.ssh/bianca-key-pair.pem"
  if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found: $SSH_KEY"
    exit 1
  fi

  SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
  
  ssh $SSH_OPTS ec2-user@$INSTANCE_IP "
    echo '=== Container Status ==='
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'demo_|NAMES' || echo 'No demo containers found'
    echo ''
    
    echo '=== All Containers (including stopped) ==='
    docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'demo_|NAMES' || echo 'No demo containers found'
    echo ''
    
    echo '=== Nginx Container Details ==='
    if docker ps -a | grep -q demo_nginx; then
      echo 'Nginx container exists'
      docker inspect demo_nginx --format 'Status: {{.State.Status}}' 2>/dev/null || echo 'Could not inspect nginx container'
      echo ''
      echo 'Nginx Logs (last 30 lines):'
      docker logs demo_nginx --tail 30 2>/dev/null || echo 'Could not get nginx logs'
      echo ''
      echo 'Nginx Config:'
      docker exec demo_nginx cat /etc/nginx/conf.d/default.conf 2>/dev/null | head -50 || echo 'Could not read nginx config'
    else
      echo '❌ Nginx container not found'
    fi
    echo ''
    
    echo '=== Frontend Container Details ==='
    if docker ps -a | grep -q demo_frontend; then
      echo 'Frontend container exists'
      docker inspect demo_frontend --format 'Status: {{.State.Status}}' 2>/dev/null || echo 'Could not inspect frontend container'
      echo ''
      echo 'Frontend Logs (last 30 lines):'
      docker logs demo_frontend --tail 30 2>/dev/null || echo 'Could not get frontend logs'
    else
      echo '❌ Frontend container not found'
    fi
    echo ''
    
    echo '=== App Container Details ==='
    if docker ps -a | grep -q demo_app; then
      echo 'App container exists'
      docker inspect demo_app --format 'Status: {{.State.Status}}' 2>/dev/null || echo 'Could not inspect app container'
      echo ''
      echo 'App Logs (last 30 lines):'
      docker logs demo_app --tail 30 2>/dev/null || echo 'Could not get app logs'
    else
      echo '❌ App container not found'
    fi
    echo ''
    
    echo '=== Docker Networks ==='
    docker network ls
    echo ''
    
    echo '=== Testing Connectivity ==='
    if docker ps | grep -q demo_nginx; then
      echo 'Testing nginx can reach frontend...'
      docker exec demo_nginx ping -c 2 frontend 2>/dev/null || echo '❌ Cannot ping frontend hostname'
      echo ''
      echo 'Testing nginx can reach app...'
      docker exec demo_nginx ping -c 2 app 2>/dev/null || echo '❌ Cannot ping app hostname'
    fi
    echo ''
    
    echo '=== Port Status ==='
    ss -tlnp 2>/dev/null | grep :80 || netstat -tlnp 2>/dev/null | grep :80 || echo 'Port 80 not listening'
    ss -tlnp 2>/dev/null | grep :3000 || netstat -tlnp 2>/dev/null | grep :3000 || echo 'Port 3000 not listening'
    echo ''
    
    echo '=== Docker Compose Status ==='
    cd /opt/bianca-demo && docker compose ps 2>/dev/null || echo 'Could not get docker compose status'
    echo ''
    
    echo '=== Nginx Config File on Host ==='
    if [ -f /opt/bianca-demo/nginx.conf ]; then
      echo 'nginx.conf exists:'
      head -50 /opt/bianca-demo/nginx.conf
    else
      echo '❌ nginx.conf not found in /opt/bianca-demo/'
    fi
  "
fi

echo ""
echo "✅ Diagnosis complete!"
