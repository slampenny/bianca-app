#!/bin/bash
# Quick script to check and fix WordPress database connection

cd "$(dirname "$0")/../devops/terraform-wordpress" || exit 1
INSTANCE_ID=$(terraform output -raw wordpress_instance_id 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ]; then
    echo "❌ Could not get instance ID. Run: cd devops/terraform-wordpress && terraform output wordpress_instance_id"
    exit 1
fi

echo "Checking WordPress database connection on instance: $INSTANCE_ID"
echo ""

# Command to check and fix
COMMAND='cd /opt/bianca-wordpress && echo "=== Container Status ===" && docker ps -a && echo "" && echo "=== Testing Database Connection ===" && docker exec bianca-wordpress ping -c 2 wordpress-db 2>&1 || echo "Database not reachable" && echo "" && echo "=== Restarting All Containers ===" && docker-compose restart && sleep 20 && echo "" && echo "=== Verifying After Restart ===" && docker ps && docker exec bianca-wordpress ping -c 2 wordpress-db 2>&1'

echo "Sending command to instance..."
aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[$COMMAND]" \
    --output text --query 'Command.CommandId' 2>/dev/null

echo ""
echo "Command sent. Wait 30 seconds, then check output with:"
echo "  aws ssm list-command-invocations --instance-id $INSTANCE_ID --max-items 1 --details"

