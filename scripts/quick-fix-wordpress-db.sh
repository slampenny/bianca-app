#!/bin/bash
# Quick fix for WordPress database connection issue
# This restarts the containers and ensures they're on the same network

set -e

echo "=========================================="
echo "Quick Fix: WordPress Database Connection"
echo "=========================================="
echo ""

cd "$(dirname "$0")/../devops/terraform-wordpress" || exit 1
INSTANCE_ID=$(terraform output -raw wordpress_instance_id 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ]; then
    echo "❌ Could not get WordPress instance ID"
    exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo ""

# Simple fix: restart containers properly
FIX_COMMAND=$(cat <<'EOF'
cd /opt/bianca-wordpress

echo "=== Current Container Status ==="
docker ps -a

echo ""
echo "=== Stopping All Containers ==="
docker-compose down

echo ""
echo "=== Removing Old Network (if exists) ==="
docker network rm bianca-wordpress_wordpress-network 2>/dev/null || true

echo ""
echo "=== Starting Containers ==="
docker-compose up -d

echo ""
echo "=== Waiting for Containers to Start ==="
sleep 20

echo ""
echo "=== Verifying Containers are Running ==="
docker ps

echo ""
echo "=== Testing Database Connection ==="
if docker exec bianca-wordpress ping -c 2 wordpress-db >/dev/null 2>&1; then
    echo "✅ Database hostname resolves!"
else
    echo "❌ Database hostname still not resolving"
    echo ""
    echo "Checking network..."
    docker network inspect bianca-wordpress_wordpress-network 2>/dev/null | grep -A 5 "Containers" || echo "Network issue detected"
fi

echo ""
echo "=== Checking Database Container Logs ==="
docker logs --tail 20 bianca-wordpress-db 2>/dev/null || echo "Database container not found"
EOF
)

echo "Sending fix command to instance..."
echo ""

# Send command via SSM
COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[$(echo "$FIX_COMMAND" | jq -Rs .)]" \
    --query 'Command.CommandId' \
    --output text 2>/dev/null)

if [ -z "$COMMAND_ID" ]; then
    echo "❌ Failed to send SSM command"
    echo "   Please check AWS credentials and SSM access"
    exit 1
fi

echo "✅ Command sent (Command ID: $COMMAND_ID)"
echo ""
echo "⏳ Waiting 30 seconds for command to complete..."
sleep 30

# Get command output
echo ""
echo "=== Command Output ==="
aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query '[StandardOutputContent,StandardErrorContent]' \
    --output text 2>/dev/null || echo "Command may still be running. Check status with: aws ssm get-command-invocation --command-id $COMMAND_ID --instance-id $INSTANCE_ID"

echo ""
echo "=========================================="
echo "✅ Fix command completed"
echo ""
echo "If the issue persists, the containers may need to be recreated:"
echo "  cd /opt/bianca-wordpress"
echo "  docker-compose down -v"
echo "  docker-compose up -d"
echo "=========================================="

