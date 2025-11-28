#!/bin/bash
# Manual WordPress restart script - can work without Terraform

set -e

# Try to get instance ID from Terraform first
INSTANCE_ID=""
if [ -d "../devops/terraform-wordpress" ]; then
    cd "$(dirname "$0")/../devops/terraform-wordpress" 2>/dev/null || true
    INSTANCE_ID=$(terraform output -raw wordpress_instance_id 2>/dev/null || echo "")
fi

# If Terraform didn't work, check for command line argument or prompt
if [ -z "$INSTANCE_ID" ]; then
    if [ -n "$1" ]; then
        INSTANCE_ID="$1"
    else
        echo "Could not get instance ID from Terraform."
        echo ""
        echo "Usage: $0 [instance-id]"
        echo ""
        echo "To find the instance ID, you can:"
        echo "  1. Check AWS Console → EC2 → Instances → Filter by 'bianca-wordpress'"
        echo "  2. Or run: aws ec2 describe-instances --filters 'Name=tag:Name,Values=bianca-wordpress' --query 'Reservations[*].Instances[*].InstanceId' --output text"
        echo ""
        read -p "Enter WordPress instance ID: " INSTANCE_ID
        
        if [ -z "$INSTANCE_ID" ]; then
            echo "❌ Instance ID is required"
            exit 1
        fi
    fi
fi

echo "Restarting WordPress containers on instance: $INSTANCE_ID"
echo ""

# Restart command (try with jordan profile first, fallback to default)
COMMAND_ID=$(aws ssm send-command --profile jordan \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["cd /opt/bianca-wordpress && docker-compose restart && sleep 15 && docker ps"]' \
    --output text --query 'Command.CommandId' 2>&1)

if [ $? -eq 0 ] && [ -n "$COMMAND_ID" ]; then
    echo "✅ Restart command sent (Command ID: $COMMAND_ID)"
    echo ""
    echo "Waiting 5 seconds, then checking command status..."
    sleep 5
    
    # Check command status
    aws ssm get-command-invocation --profile jordan \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query '[Status,ResponseCode,StandardOutputContent]' \
        --output text 2>&1 || echo "   (Status check may take a moment)"
    
    echo ""
    echo "Site should be back online in ~30 seconds."
    echo ""
    echo "To check command status later:"
    echo "  aws ssm get-command-invocation --profile jordan --command-id $COMMAND_ID --instance-id $INSTANCE_ID"
    echo ""
    echo "⚠️  If SSM shows 'Undeliverable' or 'ConnectionLost', the SSM agent may not be running."
    echo "   You may need to:"
    echo "   1. SSH into the instance and restart WordPress manually:"
    echo "      ssh ec2-user@18.225.149.168"
    echo "      cd /opt/bianca-wordpress && docker-compose restart"
    echo "   2. Or restart the SSM agent: sudo systemctl restart amazon-ssm-agent"
else
    echo "❌ Failed to send restart command"
    echo "Error: $COMMAND_ID"
    exit 1
fi

