#!/bin/bash
# Disable maintenance mode by removing the flag file and reloading nginx

set -e

MAINTENANCE_FLAG="/opt/maintenance-mode.flag"
AWS_REGION="${AWS_REGION:-us-east-2}"

echo "✅ Disabling maintenance mode..."

# Detect environment from instance Name tag
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")
if [ -n "$INSTANCE_ID" ]; then
    INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")
    
    # Determine environment based on instance name
    if echo "$INSTANCE_NAME" | grep -qi "production"; then
        DEPLOY_DIR="/opt/bianca-production"
        ENV="production"
    else
        DEPLOY_DIR="/opt/bianca-staging"
        ENV="staging"
    fi
else
    # Fallback if we can't detect instance
    DEPLOY_DIR="${DEPLOY_DIR:-/opt/bianca-staging}"
    ENV="${ENV:-staging}"
fi

echo "   Environment: $ENV"
echo "   Deployment directory: $DEPLOY_DIR"

# Remove maintenance flag file
if [ -f "$MAINTENANCE_FLAG" ]; then
    rm -f "$MAINTENANCE_FLAG"
    echo "   ✅ Removed maintenance flag: $MAINTENANCE_FLAG"
else
    echo "   ℹ️  Maintenance flag not found (may already be disabled)"
fi

# Reload nginx if it's running
if docker ps --filter "name=.*_nginx" --format "{{.Names}}" | grep -q nginx; then
    echo "   Reloading nginx to disable maintenance mode..."
    NGINX_CONTAINER=$(docker ps --filter "name=.*_nginx" --format "{{.Names}}" | head -1)
    if [ -n "$NGINX_CONTAINER" ]; then
        docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || {
            echo "   ⚠️  Could not reload nginx, but maintenance flag is removed"
        }
        echo "   ✅ Nginx reloaded"
    fi
else
    echo "   ℹ️  Nginx container not running (will use maintenance mode check on next start)"
fi

echo "✅ Maintenance mode disabled"
echo "   The site is now serving normal content"


