#!/bin/bash
# Post-deployment validation script for production
# Checks that all critical components are configured correctly

set -e

echo "🔍 Validating production deployment..."

PRODUCTION_IP=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan)

if [ -z "$PRODUCTION_IP" ]; then
    echo "❌ Could not find production instance"
    exit 1
fi

echo "✅ Production instance found: $PRODUCTION_IP"

# Check DNS
DNS_IP=$(dig +short sip.myphonefriend.com)
if [ "$DNS_IP" = "$PRODUCTION_IP" ]; then
    echo "✅ DNS correctly points to production IP"
else
    echo "⚠️  DNS mismatch: DNS=$DNS_IP, Production=$PRODUCTION_IP"
    echo "   Run: aws route53 change-resource-record-sets to fix"
fi

# Check Asterisk configuration
echo "🔍 Checking Asterisk configuration..."
ASTERISK_IP=$(ssh -i ~/.ssh/bianca-key-pair.pem -o StrictHostKeyChecking=no ec2-user@$PRODUCTION_IP "docker exec production_asterisk env | grep EXTERNAL_ADDRESS | cut -d= -f2" 2>/dev/null || echo "")

if [ "$ASTERISK_IP" = "$PRODUCTION_IP" ]; then
    echo "✅ Asterisk EXTERNAL_ADDRESS matches production IP"
else
    echo "⚠️  Asterisk EXTERNAL_ADDRESS mismatch: $ASTERISK_IP vs $PRODUCTION_IP"
    echo "   Run: ssh to instance and restart asterisk container"
fi

# Check containers are running
echo "🔍 Checking containers..."
CONTAINERS=$(ssh -i ~/.ssh/bianca-key-pair.pem -o StrictHostKeyChecking=no ec2-user@$PRODUCTION_IP "docker ps --format '{{.Names}}' | grep production" 2>/dev/null || echo "")
REQUIRED_CONTAINERS=("production_app" "production_asterisk" "production_mongodb" "production_frontend")

for container in "${REQUIRED_CONTAINERS[@]}"; do
    if echo "$CONTAINERS" | grep -q "$container"; then
        echo "✅ $container is running"
    else
        echo "❌ $container is NOT running"
    fi
done

# Check security group
echo "🔍 Checking security group..."
SG_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text --profile jordan)
PORT_5061=$(aws ec2 describe-security-groups --group-ids $SG_ID --query 'SecurityGroups[0].IpPermissions[?FromPort==`5061` && IpProtocol==`tcp`]' --output json --profile jordan 2>/dev/null | jq -r 'length')

if [ "$PORT_5061" -gt 0 ]; then
    echo "✅ Security group allows port 5061 TCP"
else
    echo "❌ Security group missing port 5061 TCP"
fi

# Check ARI connection
echo "🔍 Checking ARI connection..."
ARI_STATUS=$(ssh -i ~/.ssh/bianca-key-pair.pem -o StrictHostKeyChecking=no ec2-user@$PRODUCTION_IP "docker logs production_app 2>&1 | grep -i 'ARI.*connected\|ARI.*ready' | tail -1" 2>/dev/null || echo "")

if [ -n "$ARI_STATUS" ]; then
    echo "✅ ARI connection: $ARI_STATUS"
else
    echo "⚠️  Could not verify ARI connection status"
fi

echo ""
echo "🎉 Validation complete!"
echo "💡 If any issues were found, fix them and re-run this script"








