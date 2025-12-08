#!/bin/bash
# Script to diagnose and fix WordPress database connection issues

set -e

echo "=========================================="
echo "WordPress Database Connection Fix"
echo "=========================================="
echo ""

# Get instance ID
cd "$(dirname "$0")/../devops/terraform-wordpress" || exit 1
INSTANCE_ID=$(terraform output -raw wordpress_instance_id 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ]; then
    echo "❌ Could not get WordPress instance ID from Terraform"
    exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo ""

# Commands to run on the instance
COMMANDS=$(cat <<'EOF'
echo "=== Checking Docker Containers ==="
docker ps -a

echo ""
echo "=== Checking Docker Network ==="
docker network ls
docker network inspect bianca-wordpress_wordpress-network 2>/dev/null || echo "Network not found"

echo ""
echo "=== Checking Database Container ==="
docker logs --tail 50 bianca-wordpress-db 2>/dev/null || echo "Database container not found"

echo ""
echo "=== Checking WordPress Container ==="
docker logs --tail 50 bianca-wordpress 2>/dev/null || echo "WordPress container not found"

echo ""
echo "=== Testing Database Connection from WordPress Container ==="
docker exec bianca-wordpress ping -c 2 wordpress-db 2>/dev/null || echo "Cannot ping wordpress-db"

echo ""
echo "=== Checking wp-config.php ==="
docker exec bianca-wordpress cat /var/www/html/wp-config.php 2>/dev/null | grep -E "DB_HOST|DB_NAME|DB_USER" || echo "Cannot read wp-config.php"

echo ""
echo "=== Restarting Docker Containers ==="
cd /opt/bianca-wordpress
docker-compose down
sleep 5
docker-compose up -d

echo ""
echo "=== Waiting for containers to start ==="
sleep 15

echo ""
echo "=== Verifying Containers are Running ==="
docker ps

echo ""
echo "=== Testing Database Connection Again ==="
docker exec bianca-wordpress ping -c 2 wordpress-db 2>/dev/null && echo "✅ Database hostname resolves" || echo "❌ Database hostname still not resolving"
EOF
)

echo "Sending diagnostic and fix commands to instance..."
echo ""

# Send command via SSM
COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[$(echo "$COMMANDS" | jq -Rs .)]" \
    --query 'Command.CommandId' \
    --output text 2>/dev/null)

if [ -z "$COMMAND_ID" ]; then
    echo "❌ Failed to send SSM command"
    echo "   Make sure AWS credentials are configured and SSM is enabled on the instance"
    exit 1
fi

echo "✅ Command sent (Command ID: $COMMAND_ID)"
echo ""
echo "Waiting for command to complete..."
sleep 5

# Get command output
OUTPUT=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query '[StandardOutputContent,StandardErrorContent]' \
    --output text 2>/dev/null || echo "")

if [ -n "$OUTPUT" ]; then
    echo "$OUTPUT"
else
    echo "⏳ Command is still running. Check status with:"
    echo "   aws ssm get-command-invocation --command-id $COMMAND_ID --instance-id $INSTANCE_ID"
    echo ""
    echo "Or check the output in a few seconds:"
    echo "   aws ssm list-command-invocations --command-id $COMMAND_ID --instance-id $INSTANCE_ID --details"
fi

echo ""
echo "=========================================="
echo "If the issue persists, try:"
echo "1. Check if containers are on the same network: docker network inspect bianca-wordpress_wordpress-network"
echo "2. Restart all containers: cd /opt/bianca-wordpress && docker-compose restart"
echo "3. Recreate the network: docker network rm bianca-wordpress_wordpress-network && docker-compose up -d"
echo "=========================================="

