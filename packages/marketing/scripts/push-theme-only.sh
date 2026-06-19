#!/bin/bash
#
# Deploy ONLY the bianca-wellness theme to production — no database, no full wp-content replace.
# Use this when you want production posts/pages untouched and only ship theme files.
#
# Production WordPress runs in Docker (official wordpress:*-apache image). Theme files live on the
# host at REMOTE_THEME_DIR and are bind-mounted into the container as .../wp-content/themes/....
# Ownership must match the container user (www-data, typically UID 33). This script prefers
# `docker exec … chown` inside the running WordPress container; if none is found, it uses chown 33:33
# on the host path (works even when the AMI has no `www-data` user).
#
# After deploy:
#   1. WP Admin → Appearance → Themes → Activate "Bianca Wellness"
#   2. Add/update pages on production (see CONTENT.md or use Tools → Import)
#   3. Settings → Reading → set static front page to your landing page
#
# Usage: ./push-theme-only.sh
# Optional: INSTANCE_IP=x.x.x.x ./push-theme-only.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AWS_REGION="us-east-2"
AWS_PROFILE="jordan"
SSH_KEY_PATH="$HOME/.ssh/bianca-key-pair.pem"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_THEME_DIR="$SCRIPT_DIR/wordpress/wp-content/themes/bianca-wellness"
REMOTE_THEME_DIR="/opt/wordpress-data/wp-content/themes/bianca-wellness"

get_instance_ip() {
    echo -e "${YELLOW}Finding WordPress EC2 instance...${NC}"
    INSTANCE_IP=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --filters "Name=tag:Name,Values=bianca-wordpress" "Name=instance-state-name,Values=running" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text 2>/dev/null || echo "")
    if [[ -z "$INSTANCE_IP" || "$INSTANCE_IP" == "None" ]]; then
        echo -e "${RED}Could not find EC2 instance. Set INSTANCE_IP manually.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Instance: $INSTANCE_IP${NC}"
}

main() {
    if [[ ! -d "$LOCAL_THEME_DIR" ]]; then
        echo -e "${RED}Theme not found: $LOCAL_THEME_DIR${NC}"
        echo "Copy packaged theme here first, e.g.:"
        echo "  cp -r \"\$(git rev-parse --show-toplevel 2>/dev/null)/packaged-themes/bianca-wellness\" \"$SCRIPT_DIR/wordpress/wp-content/themes/\""
        exit 1
    fi

    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        echo -e "${RED}SSH key not found: $SSH_KEY_PATH${NC}"
        exit 1
    fi
    chmod 600 "$SSH_KEY_PATH" 2>/dev/null || true

    if [[ -z "$INSTANCE_IP" ]]; then
        get_instance_ip
    fi

    echo -e "${BLUE}Rsync theme only → ec2-user@$INSTANCE_IP:$REMOTE_THEME_DIR${NC}"
    echo -e "${YELLOW}Database is NOT modified.${NC}"

    rsync -avz --delete \
        -e "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no" \
        --exclude='.DS_Store' \
        "$LOCAL_THEME_DIR/" \
        "ec2-user@$INSTANCE_IP:/tmp/bianca-wellness-theme-upload/"

    # Remote: rsync into host bind-mount, then fix ownership for Docker (www-data inside container).
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ec2-user@$INSTANCE_IP" bash << EOF
set -e
REMOTE_THEME_DIR="$REMOTE_THEME_DIR"
sudo mkdir -p "\$REMOTE_THEME_DIR"
sudo rsync -a /tmp/bianca-wellness-theme-upload/ "\$REMOTE_THEME_DIR/"
WP_C=""
for id in \$(sudo docker ps -q 2>/dev/null || true); do
  if sudo docker exec "\$id" test -f /var/www/html/wp-config.php 2>/dev/null; then
    WP_C="\$id"
    break
  fi
done
if [[ -n "\$WP_C" ]]; then
  echo "chown inside WordPress container \$WP_C (www-data)..."
  sudo docker exec "\$WP_C" chown -R www-data:www-data /var/www/html/wp-content/themes/bianca-wellness
else
  echo "No WordPress container detected; chown host mount as UID 33:33 (official image www-data)..."
  sudo chown -R 33:33 "\$REMOTE_THEME_DIR" 2>/dev/null || \
    { id www-data >/dev/null 2>&1 && sudo chown -R www-data:www-data "\$REMOTE_THEME_DIR"; } || \
    { id apache >/dev/null 2>&1 && sudo chown -R apache:apache "\$REMOTE_THEME_DIR"; } || \
    sudo chown -R ec2-user:ec2-user "\$REMOTE_THEME_DIR"
fi
rm -rf /tmp/bianca-wellness-theme-upload
EOF

    echo ""
    echo -e "${GREEN}Theme deployed.${NC}"
    echo "Next: Production WP Admin → Appearance → Themes → Activate Bianca Wellness"
    echo "      Then add/import pages; Settings → Reading → static front page."
}

main "$@"
