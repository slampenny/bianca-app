#!/usr/bin/env bash
#
# Deploy Bianca Wellness marketing WordPress (local packages/marketing) → Bitnami on Lightsail.
#
# Prereqs:
#   - Docker: yarn marketing:up (or docker compose -f packages/marketing/docker-compose.yml up -d)
#   - Database `biancawellness` exists and is current (run ./pull-from-production.sh if needed)
#   - SSH: default is ~/.ssh/bianca-key-pair.pem (same PEM Lightsail Terraform imports). Override with BIANCA_SSH_KEY.
#
# Usage:
#   ./deploy-to-lightsail.sh
#   BIANCA_LIGHTSAIL_HOST=3.x.x.x ./deploy-to-lightsail.sh
#
# SSH key: default ~/.ssh/bianca-key-pair.pem. Optional: BIANCA_SSH_FROM_SECRET=1 + BIANCA_SSH_SECRET_ID to fetch from Secrets Manager.
#
# This script does NOT upload wp-config.php (avoid leaking secrets; configure SES on the server separately).
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BIANCA_LIGHTSAIL_HOST="${BIANCA_LIGHTSAIL_HOST:-}"
BIANCA_SSH_KEY="${BIANCA_SSH_KEY:-$HOME/.ssh/bianca-key-pair.pem}"
BIANCA_SSH_FROM_SECRET="${BIANCA_SSH_FROM_SECRET:-}"
BIANCA_SSH_SECRET_ID="${BIANCA_SSH_SECRET_ID:-biancawellness/marketing-lightsail/ssh-private-key}"
AWS_REGION="${AWS_REGION:-us-east-2}"
AWS_PROFILE="${AWS_PROFILE:-jordan}"
BIANCA_SSH_USER="${BIANCA_SSH_USER:-bitnami}"
BIANCA_LOCAL_DB_CONTAINER="${BIANCA_LOCAL_DB_CONTAINER:-bianca-marketing-db-1}"
BIANCA_LOCAL_DB_NAME="${BIANCA_LOCAL_DB_NAME:-biancawellness}"
BIANCA_LOCAL_DB_USER="${BIANCA_LOCAL_DB_USER:-wordpress}"
BIANCA_LOCAL_DB_PASSWORD="${BIANCA_LOCAL_DB_PASSWORD:-wordpress}"
BIANCA_PRODUCTION_URL="${BIANCA_PRODUCTION_URL:-https://biancawellness.com}"
REMOTE_WP="/opt/bitnami/wordpress"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIANCA_APP="${BIANCA_APP:-$(cd "$MARKETING_ROOT/../.." && pwd)}"
WP_CONTENT="$MARKETING_ROOT/wordpress/wp-content"

_BIANCA_SSH_TMP=""

resolve_ssh_key() {
	if [[ -n "$BIANCA_SSH_FROM_SECRET" ]]; then
		info "Fetching SSH private key from Secrets Manager: $BIANCA_SSH_SECRET_ID (region $AWS_REGION) …"
		_BIANCA_SSH_TMP="$(mktemp /tmp/biancawellness-lightsail-ssh.XXXXXX)"
		BIANCA_SSH_KEY="$_BIANCA_SSH_TMP"
		if [[ -n "$AWS_PROFILE" ]]; then
			aws --profile "$AWS_PROFILE" secretsmanager get-secret-value \
				--secret-id "$BIANCA_SSH_SECRET_ID" \
				--region "$AWS_REGION" \
				--query SecretString \
				--output text >"$BIANCA_SSH_KEY"
		else
			aws secretsmanager get-secret-value \
				--secret-id "$BIANCA_SSH_SECRET_ID" \
				--region "$AWS_REGION" \
				--query SecretString \
				--output text >"$BIANCA_SSH_KEY"
		fi
		chmod 600 "$BIANCA_SSH_KEY"
		return 0
	fi
	if [[ -f "$BIANCA_SSH_KEY" ]]; then
		chmod 600 "$BIANCA_SSH_KEY" 2>/dev/null || true
		return 0
	fi
	die "SSH key not found: $BIANCA_SSH_KEY (same PEM as Lightsail Terraform ssh_private_key_pem_path, or set BIANCA_SSH_FROM_SECRET=1 to use Secrets Manager)."
}

SSH=()
SCP=()

die() {
	echo -e "${RED}Error:${NC} $*" >&2
	exit 1
}

info() { echo -e "${BLUE}[deploy]${NC} $*"; }
ok() { echo -e "${GREEN}[ok]${NC} $*"; }

[[ -n "$BIANCA_LIGHTSAIL_HOST" ]] || die "Set BIANCA_LIGHTSAIL_HOST (terraform output lightsail_static_ip in bianca-app) or pass as env."

resolve_ssh_key
[[ -f "$BIANCA_SSH_KEY" ]] || die "SSH private key not available at: $BIANCA_SSH_KEY"

SSH=(ssh -i "$BIANCA_SSH_KEY" -o StrictHostKeyChecking=accept-new "$BIANCA_SSH_USER@$BIANCA_LIGHTSAIL_HOST")
SCP=(scp -i "$BIANCA_SSH_KEY" -o StrictHostKeyChecking=accept-new)

docker info >/dev/null 2>&1 || die "Docker is not running."
docker inspect "$BIANCA_LOCAL_DB_CONTAINER" >/dev/null 2>&1 || die "DB container not found: $BIANCA_LOCAL_DB_CONTAINER (run: yarn marketing:up)"

[[ -d "$WP_CONTENT/themes" ]] || die "Missing wp-content under $MARKETING_ROOT/wordpress"

LOCAL_WP_CONFIG="$MARKETING_ROOT/wordpress/wp-config.php"
[[ -f "$LOCAL_WP_CONFIG" ]] || die "Missing $LOCAL_WP_CONFIG"
TABLE_PREFIX=$(grep '^\$table_prefix' "$LOCAL_WP_CONFIG" | head -1 | sed -n "s/.*['\"]\([^'\"]*\)['\"].*/\1/p")
[[ -n "$TABLE_PREFIX" ]] || die "Could not parse \$table_prefix from $LOCAL_WP_CONFIG"
info "Table prefix (from local wp-config): $TABLE_PREFIX"

TMP="/tmp/biancawellness-lightsail-deploy-$$"
mkdir -p "$TMP"
cleanup() {
	rm -rf "$TMP"
	if [[ -n "$_BIANCA_SSH_TMP" && -f "$_BIANCA_SSH_TMP" ]]; then
		rm -f "$_BIANCA_SSH_TMP"
	fi
}
trap cleanup EXIT

SQL_LOCAL="$TMP/biancawellness-export.sql"
TGZ_LOCAL="$TMP/biancawellness-wp-content.tgz"

info "Exporting database $BIANCA_LOCAL_DB_NAME from $BIANCA_LOCAL_DB_CONTAINER …"
docker exec "$BIANCA_LOCAL_DB_CONTAINER" mariadb-dump \
	-u"$BIANCA_LOCAL_DB_USER" \
	-p"$BIANCA_LOCAL_DB_PASSWORD" \
	--single-transaction \
	--quick \
	"$BIANCA_LOCAL_DB_NAME" >"$SQL_LOCAL"

[[ -s "$SQL_LOCAL" ]] || die "Database dump is empty — create/populate DB $BIANCA_LOCAL_DB_NAME or run pull-from-production.sh"

info "Packaging wp-content (excludes cache dirs if present) …"
STAGE="$TMP/stage"
mkdir -p "$STAGE"
rsync -a \
	--exclude 'uploads/wpo-cache/' \
	--exclude 'cache/' \
	--exclude 'et-cache/' \
	--exclude 'debug.log' \
	"$WP_CONTENT/" "$STAGE/wp-content/"

tar czf "$TGZ_LOCAL" -C "$STAGE" wp-content

REMOTE_SQL="/tmp/biancawellness-push-$$.sql"
REMOTE_TGZ="/tmp/biancawellness-push-$$.tgz"

info "Uploading SQL ($(wc -c <"$SQL_LOCAL") bytes) + wp-content bundle …"
"${SCP[@]}" "$SQL_LOCAL" "$BIANCA_SSH_USER@$BIANCA_LIGHTSAIL_HOST:$REMOTE_SQL"
"${SCP[@]}" "$TGZ_LOCAL" "$BIANCA_SSH_USER@$BIANCA_LIGHTSAIL_HOST:$REMOTE_TGZ"
SYNC_PHP="$BIANCA_APP/packages/backend/scripts/bianca-wellness-lightsail-sync-home.php"
if [[ -f "$SYNC_PHP" ]]; then
	info "Uploading home sync helper from bianca-app …"
	"${SCP[@]}" "$SYNC_PHP" "$BIANCA_SSH_USER@$BIANCA_LIGHTSAIL_HOST:/tmp/bianca-wellness-lightsail-sync-home.php"
else
	info "No $SYNC_PHP — set BIANCA_APP to your bianca-app path to sync new marketing home HTML on deploy."
fi

info "Remote: stop Apache → import DB → merge wp-content → URL replace → start Apache …"

# shellcheck disable=SC2029
"${SSH[@]}" bash -s <<REMOTE_EOF
set -euo pipefail
REMOTE_SQL="${REMOTE_SQL}"
REMOTE_TGZ="${REMOTE_TGZ}"
REMOTE_WP="${REMOTE_WP}"
PROD_URL="${BIANCA_PRODUCTION_URL}"
TABLE_PREFIX="${TABLE_PREFIX}"
WP_CLI=(sudo /opt/bitnami/wp-cli/bin/wp --allow-root)

sudo /opt/bitnami/ctlscript.sh stop apache

cd "\$REMOTE_WP"
sudo "\${WP_CLI[@]}" db import "\$REMOTE_SQL"
# Bitnami defaults to wp_; production dump uses local wp-config prefix (e.g. eMd_).
# Real file is /bitnami/wordpress/wp-config.php (/opt/bitnami/... is a symlink); WP-CLI cannot rewrite it.
sudo sed -i.bak "s/^\\\$table_prefix *= *'[^']*';/\\\$table_prefix = '${TABLE_PREFIX}';/" /bitnami/wordpress/wp-config.php

sudo rm -rf /tmp/bwdeploy && sudo mkdir -p /tmp/bwdeploy
sudo tar xzf "\$REMOTE_TGZ" -C /tmp/bwdeploy

if [[ -d /tmp/bwdeploy/wp-content ]]; then
	# Bitnami Lightsail image has no rsync; cp -a merges trees.
	sudo cp -a /tmp/bwdeploy/wp-content/. "\$REMOTE_WP/wp-content/"
fi

sudo chown -R bitnami:daemon "\$REMOTE_WP/wp-content" 2>/dev/null || true
sudo find "\$REMOTE_WP/wp-content" -type d -exec chmod 775 {} \\; 2>/dev/null || true
sudo find "\$REMOTE_WP/wp-content" -type f -exec chmod 664 {} \\; 2>/dev/null || true

cd "\$REMOTE_WP"
sudo "\${WP_CLI[@]}" search-replace 'http://localhost:80' "\$PROD_URL" --all-tables --skip-columns=guid || true
sudo "\${WP_CLI[@]}" search-replace 'http://localhost' "\$PROD_URL" --all-tables --skip-columns=guid || true
sudo "\${WP_CLI[@]}" search-replace 'http://127.0.0.1' "\$PROD_URL" --all-tables --skip-columns=guid || true
sudo "\${WP_CLI[@]}" search-replace 'https://www.biancawellness.com' "\$PROD_URL" --all-tables --skip-columns=guid || true
sudo "\${WP_CLI[@]}" option update home "\$PROD_URL"
sudo "\${WP_CLI[@]}" option update siteurl "\$PROD_URL"
sudo "\${WP_CLI[@]}" option update blogname "Bianca Wellness" --allow-root
sudo "\${WP_CLI[@]}" option update blogdescription "AI-powered wellness checks for seniors and caregivers." --allow-root || true
# New marketing site = bianca-wellness theme + data/home-page-blocks.html (not myphonefriend-new classic hero).
sudo "\${WP_CLI[@]}" theme activate bianca-wellness --allow-root || true
if sudo test -f /tmp/bianca-wellness-lightsail-sync-home.php; then
	sudo "\${WP_CLI[@]}" eval-file /tmp/bianca-wellness-lightsail-sync-home.php --allow-root || true
	sudo rm -f /tmp/bianca-wellness-lightsail-sync-home.php
fi
sudo "\${WP_CLI[@]}" search-replace 'http://myphonefriend.com' "\$PROD_URL" --all-tables --skip-columns=guid || true
sudo "\${WP_CLI[@]}" search-replace 'https://myphonefriend.com' "\$PROD_URL" --all-tables --skip-columns=guid || true
sudo "\${WP_CLI[@]}" cache flush
sudo "\${WP_CLI[@]}" rewrite flush --hard

sudo rm -f "\$REMOTE_SQL" "\$REMOTE_TGZ"
sudo rm -rf /tmp/bwdeploy

sudo /opt/bitnami/ctlscript.sh start apache
echo "REMOTE_DONE"
REMOTE_EOF

ok "Deploy finished."
echo ""
echo -e "${YELLOW}Next:${NC}"
echo "  1. Attach Lightsail managed HTTPS certificate (Networking tab) or use HTTP for smoke test."
echo "  2. In Lightsail firewall, allow 80/443 from the internet."
echo "  3. Smoke test: curl -I http://$BIANCA_LIGHTSAIL_HOST/"
echo "  4. When satisfied, set manage_route53=true in bianca-app packages/backend/devops/terraform-marketing-wordpress/terraform.tfvars and terraform apply (or point apex A record to this IP)."
echo "  5. Configure SES SMTP in Bitnami wp-config on the server (do not commit secrets to git)."
echo "  6. Stop/decommission old EC2 bianca-wordpress when DNS has moved."
