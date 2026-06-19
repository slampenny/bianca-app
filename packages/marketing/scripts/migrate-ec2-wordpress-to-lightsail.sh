#!/usr/bin/env bash
#
# Copy marketing WordPress from bianca-wordpress (EC2) → Lightsail Bitnami, with minimal risk:
#   - EC2: read-only (mysqldump + rsync read wp-content). Live site keeps serving. No DNS change.
#   - Local: packages/marketing Docker DB + files updated by pull-from-production.sh
#   - Lightsail: deploy-to-lightsail.sh replaces DB + wp-content on the *Lightsail* copy only.
#
# Prereqs:
#   - yarn marketing:up (packages/marketing docker-compose)
#   - ~/.ssh/bianca-key-pair.pem (EC2 ec2-user + Lightsail bitnami)
#   - AWS CLI profile jordan (or set AWS_PROFILE)
#   - bianca-app checkout for terraform output (or set BIANCA_LIGHTSAIL_HOST)
#
# Usage:
#   cd packages/marketing/scripts && ./migrate-ec2-wordpress-to-lightsail.sh
#   BIANCA_LIGHTSAIL_HOST=3.x.x.x ./migrate-ec2-wordpress-to-lightsail.sh   # skip terraform
#   BIANCA_APP=~/code/bianca-app ./migrate-ec2-wordpress-to-lightsail.sh
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIANCA_APP="${BIANCA_APP:-$(cd "$MARKETING_ROOT/../.." && pwd)}"
TERRAFORM_MARKETING="$BIANCA_APP/packages/backend/devops/terraform-marketing-wordpress"
AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-us-east-2}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/bianca-key-pair.pem}"

die() { echo -e "${RED}Error:${NC} $*" >&2; exit 1; }
info() { echo -e "${BLUE}[migrate]${NC} $*"; }
ok() { echo -e "${GREEN}[ok]${NC} $*"; }

info "Low-risk path: EC2 (read copy) → local marketing Docker → Lightsail. Production DNS and EC2 are unchanged."

docker info >/dev/null 2>&1 || die "Start Docker, then: yarn marketing:up"
docker inspect bianca-marketing-db-1 >/dev/null 2>&1 || die "Run: yarn marketing:up (from bianca-app repo root)"

[[ -f "$SSH_KEY" ]] || die "SSH key not found: $SSH_KEY"

if [[ -z "${BIANCA_LIGHTSAIL_HOST:-}" ]]; then
	[[ -d "$TERRAFORM_MARKETING" ]] || die "Set BIANCA_LIGHTSAIL_HOST or clone bianca-app so this path exists: $TERRAFORM_MARKETING"
	command -v terraform >/dev/null 2>&1 || die "terraform not in PATH (needed to read lightsail_static_ip)"
	BIANCA_LIGHTSAIL_HOST="$(cd "$TERRAFORM_MARKETING" && AWS_PROFILE="$AWS_PROFILE" terraform output -raw lightsail_static_ip 2>/dev/null)" || true
	[[ -n "${BIANCA_LIGHTSAIL_HOST:-}" && "$BIANCA_LIGHTSAIL_HOST" != "None" ]] || die "Could not read lightsail_static_ip. Run: cd $TERRAFORM_MARKETING && terraform init && terraform output -raw lightsail_static_ip"
	ok "Lightsail host from terraform: $BIANCA_LIGHTSAIL_HOST"
else
	ok "Using BIANCA_LIGHTSAIL_HOST=$BIANCA_LIGHTSAIL_HOST"
fi

echo ""
echo -e "${YELLOW}Phase 1 — Pull read-only copy from bianca-wordpress (EC2) into local marketing Docker${NC}"
echo "  (mysqldump + rsync; does not stop Apache/MySQL on EC2.)"
echo ""
(cd "$SCRIPT_DIR" && ./pull-from-production.sh)

echo ""
echo -e "${YELLOW}Phase 2 — Push copy to Lightsail (Bitnami)${NC}"
echo "  (Stops Apache briefly on Lightsail only; rewrites URLs to https://biancawellness.com.)"
echo ""
(cd "$SCRIPT_DIR" && BIANCA_LIGHTSAIL_HOST="$BIANCA_LIGHTSAIL_HOST" AWS_PROFILE="$AWS_PROFILE" ./deploy-to-lightsail.sh)

INSTANCE_IP="$(aws ec2 describe-instances \
	--region "$AWS_REGION" \
	--profile "$AWS_PROFILE" \
	--filters "Name=tag:Name,Values=bianca-wordpress" "Name=instance-state-name,Values=running" \
	--query 'Reservations[0].Instances[0].PublicIpAddress' \
	--output text 2>/dev/null || true)"
if [[ -n "$INSTANCE_IP" && "$INSTANCE_IP" != "None" ]]; then
	info "Removing temporary dump on EC2 (/tmp) if present …"
	ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "ec2-user@$INSTANCE_IP" \
		"rm -f /tmp/myphonefriend-production-database.sql /tmp/.my.cnf 2>/dev/null" || true
fi

echo ""
ok "Migration copy finished."
echo -e "${BLUE}Next (manual, when you are ready):${NC} smoke-test http://$BIANCA_LIGHTSAIL_HOST/ (or /etc/hosts to biancawellness.com), then cut DNS away from EC2."
