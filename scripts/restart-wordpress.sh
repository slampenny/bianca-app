#!/bin/bash
# Quick script to restart WordPress and bring site back online

set -e

cd "$(dirname "$0")/../devops/terraform-wordpress" || exit 1
INSTANCE_ID=$(terraform output -raw wordpress_instance_id 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ]; then
    echo "❌ Could not get instance ID"
    exit 1
fi

echo "Restarting WordPress containers on instance: $INSTANCE_ID"
echo ""

# Simple restart command
aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["cd /opt/bianca-wordpress && docker-compose restart && sleep 15 && docker ps"]' \
    --output text --query 'Command.CommandId' 2>/dev/null

echo ""
echo "✅ Restart command sent. Site should be back online in ~30 seconds."

