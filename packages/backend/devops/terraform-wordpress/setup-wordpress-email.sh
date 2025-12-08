#!/bin/bash
# Script to set up WordPress email via SES SMTP in Docker container
# Run this script on the WordPress EC2 instance

set -e

echo "=========================================="
echo "WordPress Email Setup for Docker Container"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

CONTAINER_NAME="bianca-wordpress"
MU_PLUGINS_DIR="/opt/wordpress-data/wp-content/mu-plugins"
WP_CONTENT_DIR="/opt/wordpress-data/wp-content"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}Note: This script should be run with sudo${NC}"
    echo "Usage: sudo $0"
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}Error: WordPress container '$CONTAINER_NAME' is not running${NC}"
    exit 1
fi

echo "Step 1: Creating mu-plugins directory..."
mkdir -p "$MU_PLUGINS_DIR"
chown -R 33:33 "$WP_CONTENT_DIR"  # www-data user (UID 33 in WordPress container)

echo "Step 2: Creating SES SMTP configuration plugin..."
cat > "$MU_PLUGINS_DIR/ses-smtp-config.php" <<'EOF'
<?php
/**
 * Plugin Name: AWS SES SMTP Configuration
 * Description: Configures WordPress to send emails via AWS SES SMTP
 * Version: 1.0
 * 
 * IMPORTANT: You need to set SES_SMTP_USERNAME and SES_SMTP_PASSWORD
 * environment variables in docker-compose.yml or create SMTP credentials
 * in AWS SES Console and add them below.
 */

add_action('phpmailer_init', 'configure_ses_smtp');

function configure_ses_smtp($phpmailer) {
    $phpmailer->isSMTP();
    $phpmailer->Host = 'email-smtp.us-east-2.amazonaws.com';
    $phpmailer->SMTPAuth = true;
    $phpmailer->Port = 587;
    $phpmailer->SMTPSecure = 'tls';
    $phpmailer->SMTPAutoTLS = true;
    
    // Get credentials from environment variables or wp-config.php constants
    $username = defined('SES_SMTP_USERNAME') ? SES_SMTP_USERNAME : (getenv('SES_SMTP_USERNAME') ?: '');
    $password = defined('SES_SMTP_PASSWORD') ? SES_SMTP_PASSWORD : (getenv('SES_SMTP_PASSWORD') ?: '');
    
    if (empty($username) || empty($password)) {
        error_log('WordPress SES SMTP: Credentials not configured. Please set SES_SMTP_USERNAME and SES_SMTP_PASSWORD.');
        return;
    }
    
    $phpmailer->Username = $username;
    $phpmailer->Password = $password;
    
    // Set default from address
    $phpmailer->From = defined('SES_FROM_EMAIL') ? SES_FROM_EMAIL : 'noreply@biancawellness.com';
    $phpmailer->FromName = defined('SES_FROM_NAME') ? SES_FROM_NAME : 'My Phone Friend';
    
    // Optional: Enable debugging (disable in production)
    // $phpmailer->SMTPDebug = 2;
    // $phpmailer->Debugoutput = 'error_log';
}
EOF

chown 33:33 "$MU_PLUGINS_DIR/ses-smtp-config.php"
chmod 644 "$MU_PLUGINS_DIR/ses-smtp-config.php"

echo -e "${GREEN}✓ MU-plugin created${NC}"
echo ""

echo "Step 3: Installing WP Mail SMTP plugin via WP-CLI..."
# Check if WP-CLI is available in container
if docker exec "$CONTAINER_NAME" which wp > /dev/null 2>&1; then
    echo "WP-CLI found in container"
else
    echo "Installing WP-CLI in container..."
    docker exec "$CONTAINER_NAME" bash -c "curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp" || true
fi

# Install WP Mail SMTP plugin
docker exec "$CONTAINER_NAME" wp plugin install wp-mail-smtp --activate --allow-root 2>/dev/null || {
    echo -e "${YELLOW}Warning: Could not install plugin via WP-CLI. You can install it manually via WordPress admin.${NC}"
}

echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Next Steps:"
echo ""
echo "1. Create SMTP credentials in AWS SES Console:"
echo "   - Go to: https://console.aws.amazon.com/ses/"
echo "   - Navigate to: SMTP Settings"
echo "   - Click: Create SMTP credentials"
echo "   - Save the username and password"
echo ""
echo "2. Add credentials to WordPress:"
echo ""
echo "   Option A: Add to docker-compose.yml environment variables"
echo "   Edit /opt/bianca-wordpress/docker-compose.yml and add:"
echo ""
echo "   environment:"
echo "     SES_SMTP_USERNAME: \"your-smtp-username\""
echo "     SES_SMTP_PASSWORD: \"your-smtp-password\""
echo ""
echo "   Then restart:"
echo "   cd /opt/bianca-wordpress"
echo "   docker-compose restart wordpress"
echo ""
echo "   Option B: Add to wp-config.php"
echo "   Run: sudo docker exec -it $CONTAINER_NAME bash"
echo "   Edit /var/www/html/wp-config.php and add:"
echo ""
echo "   define('SES_SMTP_USERNAME', 'your-smtp-username');"
echo "   define('SES_SMTP_PASSWORD', 'your-smtp-password');"
echo ""
echo "3. Test email sending:"
echo "   sudo docker exec $CONTAINER_NAME wp mail test your-email@example.com --allow-root"
echo ""
echo "4. Or test via WordPress admin:"
echo "   - Go to: https://biancawellness.com/wp-admin"
echo "   - Navigate to: WP Mail SMTP → Tools → Email Test"
echo ""




