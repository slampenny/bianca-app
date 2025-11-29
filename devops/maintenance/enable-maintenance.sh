#!/bin/bash
# Enable maintenance mode by creating a flag file and updating nginx config

set -e

MAINTENANCE_FLAG="/opt/maintenance-mode.flag"
MAINTENANCE_HTML="/opt/maintenance.html"
S3_BUCKET="${MAINTENANCE_S3_BUCKET:-bianca-maintenance-pages}"
AWS_REGION="${AWS_REGION:-us-east-2}"

echo "🔧 Enabling maintenance mode..."

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

# Download maintenance page from S3
echo "   Downloading maintenance page from S3..."
if aws s3 cp "s3://${S3_BUCKET}/maintenance.html" "$MAINTENANCE_HTML" --region "$AWS_REGION" 2>/dev/null; then
    echo "   ✅ Downloaded maintenance page from S3"
else
    echo "   ⚠️  Could not download from S3, using local fallback..."
    # Use local maintenance page if S3 download fails
    if [ -f "$(dirname "$0")/maintenance.html" ]; then
        cp "$(dirname "$0")/maintenance.html" "$MAINTENANCE_HTML"
        echo "   ✅ Using local maintenance page"
    else
        echo "   ❌ ERROR: No maintenance page available"
        exit 1
    fi
fi

# Create maintenance flag file
touch "$MAINTENANCE_FLAG"
echo "   ✅ Created maintenance flag: $MAINTENANCE_FLAG"

# Reload nginx if it's running
if [ -d "$DEPLOY_DIR" ] && docker ps --filter "name=.*_nginx" --format "{{.Names}}" | grep -q nginx; then
    echo "   Reloading nginx to enable maintenance mode..."
    NGINX_CONTAINER=$(docker ps --filter "name=.*_nginx" --format "{{.Names}}" | head -1)
    if [ -n "$NGINX_CONTAINER" ]; then
        docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || {
            echo "   ⚠️  Could not reload nginx, but maintenance flag is set"
        }
    fi
fi

echo "✅ Maintenance mode enabled"
echo "   The site will show the maintenance page until maintenance mode is disabled"


