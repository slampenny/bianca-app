#!/bin/bash
# Quick fix script for WordPress uploads permissions issue
# Run this on the WordPress EC2 instance to fix permissions immediately

set -e

echo "Fixing WordPress uploads directory permissions..."

WORDPRESS_DATA_DIR="/opt/wordpress-data"

# Ensure wp-content and uploads directories exist
mkdir -p $WORDPRESS_DATA_DIR/wp-content/uploads

# WordPress container runs as www-data (UID 33), so wp-content must be owned by UID 33
echo "Setting ownership to www-data (UID 33)..."
chown -R 33:33 $WORDPRESS_DATA_DIR/wp-content

# Set proper permissions (775 for directories allows write access)
echo "Setting permissions to 775..."
chmod -R 775 $WORDPRESS_DATA_DIR/wp-content

# Verify permissions
echo ""
echo "Verifying permissions..."
ls -la $WORDPRESS_DATA_DIR/wp-content | head -5
echo ""
ls -la $WORDPRESS_DATA_DIR/wp-content/uploads 2>/dev/null | head -5 || echo "uploads directory is empty or doesn't exist yet"

echo ""
echo "✅ Permissions fixed!"
echo ""
echo "The wp-content directory is now owned by www-data (UID 33) with 775 permissions."
echo "WordPress should now be able to upload files."
echo ""
echo "If the issue persists, you may need to restart the WordPress container:"
echo "  cd /opt/bianca-wordpress"
echo "  docker-compose restart wordpress"

