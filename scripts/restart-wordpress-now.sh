#!/bin/bash
# Quick restart - run this to bring WordPress back online

cd "$(dirname "$0")/../devops/terraform-wordpress" || exit 1

# Get instance ID
INSTANCE_ID=$(terraform output -raw wordpress_instance_id 2>/dev/null)

if [ -z "$INSTANCE_ID" ]; then
    echo "Getting instance ID from AWS..."
    INSTANCE_ID=$(aws ec2 describe-instances \
        --profile jordan \
        --filters "Name=tag:Name,Values=bianca-wordpress" "Name=instance-state-name,Values=running" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null)
fi

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" == "None" ]; then
    echo "❌ Could not find WordPress instance"
    exit 1
fi

echo "Restarting WordPress containers on instance: $INSTANCE_ID"
echo ""

# Restart all containers
aws ssm send-command \
    --profile jordan \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["cd /opt/bianca-wordpress && echo \"Restarting containers...\" && docker-compose restart && sleep 20 && echo \"Verifying...\" && docker ps"]' \
    --output text --query 'Command.CommandId' 2>/dev/null

echo ""
echo "✅ Restart command sent!"
echo "⏳ Site should be back online in ~30 seconds"
echo ""
echo "To check status:"
echo "  aws ssm list-command-invocations --profile jordan --instance-id $INSTANCE_ID --max-items 1 --details"

