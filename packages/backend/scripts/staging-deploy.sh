#!/bin/bash
# yarn staging:deploy — build :staging images, SSM regenerate compose + pull/up, smoke + checklist.
# Mirrors production CodeDeploy mechanics minus blue/green. Safe to re-run.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/staging-common.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_BUILD="${STAGING_DEPLOY_SKIP_BUILD:-0}"
NO_CACHE="${STAGING_DEPLOY_NO_CACHE:-0}"
BUILD_CACHE_ARGS=()
if [ "$NO_CACHE" = "1" ]; then
  BUILD_CACHE_ARGS=(--no-cache)
fi

cd "$ROOT_DIR"
GIT_SHA=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo -e "${BLUE}🚀 Staging deploy${NC}"
echo "   Region:   $STAGING_AWS_REGION"
echo "   Registry: $STAGING_ECR_REGISTRY"
echo "   Branch:   $GIT_BRANCH"
echo "   SHA:      $GIT_SHA"
echo ""

if [ "$GIT_BRANCH" != "staging" ] && [ "${STAGING_DEPLOY_ALLOW_ANY_BRANCH:-0}" != "1" ]; then
  echo -e "${YELLOW}⚠️  Current branch is '$GIT_BRANCH' (expected 'staging').${NC}"
  echo "   Set STAGING_DEPLOY_ALLOW_ANY_BRANCH=1 to proceed anyway."
  exit 1
fi

INSTANCE_ID=$(staging_get_instance_id || true)
if [ -z "${INSTANCE_ID:-}" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo -e "${RED}❌ No staging instance found (Name=${STAGING_INSTANCE_NAME_TAG}).${NC}"
  echo "   Apply Terraform staging.tf, then yarn staging:up, then re-run deploy."
  exit 1
fi

STATE=$(staging_get_instance_state "$INSTANCE_ID")
echo "   Instance: $INSTANCE_ID ($STATE)"

if [ "$STATE" != "running" ]; then
  echo -e "${YELLOW}   Instance not running — starting via staging-control...${NC}"
  bash "$SCRIPT_DIR/staging-control.sh" start
  INSTANCE_ID=$(staging_get_instance_id)
  STATE=$(staging_get_instance_state "$INSTANCE_ID")
fi

if [ "$STATE" != "running" ]; then
  echo -e "${RED}❌ Staging instance is not running (state=$STATE)${NC}"
  exit 1
fi

staging_wait_ssm_online "$INSTANCE_ID"

# ─── Build & push (production buildspec-staging logic, local) ───
if [ "$SKIP_BUILD" != "1" ]; then
  echo -e "${BLUE}📦 Building and pushing :staging images to ${STAGING_AWS_REGION}...${NC}"
  staging_aws ecr get-login-password | docker login --username AWS --password-stdin "$STAGING_ECR_REGISTRY"

  echo "   Backend..."
  docker build "${BUILD_CACHE_ARGS[@]}" \
    --build-arg BUILD_TIMESTAMP="$(date +%s)" \
    --build-arg GIT_COMMIT="$GIT_SHA" \
    -t "${STAGING_ECR_REGISTRY}/bianca-app-backend:staging" \
    -t "${STAGING_ECR_REGISTRY}/bianca-app-backend:${GIT_SHA}" \
    -f packages/backend/docker/Dockerfile \
    "$ROOT_DIR"

  echo "   Asterisk..."
  docker build "${BUILD_CACHE_ARGS[@]}" \
    -t "${STAGING_ECR_REGISTRY}/bianca-app-asterisk:staging" \
    -f packages/backend/devops/asterisk/Dockerfile \
    "$ROOT_DIR/packages/backend/devops/asterisk"

  echo "   Frontend..."
  docker build "${BUILD_CACHE_ARGS[@]}" \
    --build-arg BUILD_ENV=staging \
    --build-arg VITE_API_URL=https://staging-api.biancawellness.com/v1 \
    --build-arg VITE_ADMIN_APP_ORIGIN=https://staging-admin.biancawellness.com \
    --build-arg VITE_MOBILE_APP_URL=https://staging-mobile.biancawellness.com \
    -t "${STAGING_ECR_REGISTRY}/bianca-app-frontend:staging" \
    -f packages/web/devops/Dockerfile \
    "$ROOT_DIR"

  echo "   Admin..."
  docker build "${BUILD_CACHE_ARGS[@]}" \
    --build-arg BUILD_ENV=staging \
    --build-arg VITE_API_URL=https://staging-api.biancawellness.com/v1 \
    --build-arg VITE_FACILITY_APP_URL=https://staging.biancawellness.com/ \
    -t "${STAGING_ECR_REGISTRY}/bianca-app-admin:staging" \
    -f packages/admin/devops/Dockerfile \
    "$ROOT_DIR"

  docker push "${STAGING_ECR_REGISTRY}/bianca-app-backend:staging"
  docker push "${STAGING_ECR_REGISTRY}/bianca-app-backend:${GIT_SHA}"
  docker push "${STAGING_ECR_REGISTRY}/bianca-app-asterisk:staging"
  docker push "${STAGING_ECR_REGISTRY}/bianca-app-frontend:staging"
  docker push "${STAGING_ECR_REGISTRY}/bianca-app-admin:staging"
  echo -e "${GREEN}✅ Images pushed${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping build (STAGING_DEPLOY_SKIP_BUILD=1)${NC}"
fi

# Digests from local docker (post-push)
DIGESTS=""
for img in bianca-app-backend bianca-app-frontend bianca-app-admin bianca-app-asterisk; do
  dig=$(docker image inspect "${STAGING_ECR_REGISTRY}/${img}:staging" --format '{{index .RepoDigests 0}}' 2>/dev/null || echo "${img}:staging")
  DIGESTS+="${dig}"$'\n'
done

# ─── Remote: regenerate compose + pull/up ───
REGEN="$ROOT_DIR/packages/backend/devops/scripts/regenerate-host-stack.sh"
RESOLVE="$ROOT_DIR/packages/backend/devops/codedeploy/scripts/resolve-aws-region.sh"
COMPOSE_UP="$SCRIPT_DIR/staging-remote-compose-up.sh"

# Bundle resolve-aws-region next to regenerate for the S3 upload by prepending a temp wrapper
TMP_REGEN=$(mktemp)
{
  echo '#!/bin/bash'
  echo 'set -euo pipefail'
  # Inline region resolve (avoid second file upload)
  cat "$RESOLVE"
  echo "export ENVIRONMENT=staging"
  echo "export AWS_REGION=\"\${AWS_REGION:-${STAGING_AWS_REGION}}\""
  echo "export DEPLOY_GIT_SHA=\"${GIT_SHA}\""
  # Skip the regenerate's own resolve by using body after REGION is set —
  # call regenerate as a nested script via embedding:
  echo "bash -s <<'REGEN_EOF'"
  cat "$REGEN"
  echo "REGEN_EOF"
} > "$TMP_REGEN"
# Simpler: upload regenerate + resolve separately in one SSM multi-command

echo -e "${BLUE}🔧 Regenerating host stack on instance (secrets + compose)...${NC}"
# Upload resolve alongside regenerate into one tar
TMP_BUNDLE=$(mktemp -d)
cp "$REGEN" "$TMP_BUNDLE/regenerate-host-stack.sh"
cp "$RESOLVE" "$TMP_BUNDLE/resolve-aws-region.sh"
chmod +x "$TMP_BUNDLE"/*.sh
TAR_LOCAL=$(mktemp --suffix=.tar.gz)
tar -czf "$TAR_LOCAL" -C "$TMP_BUNDLE" .
BUNDLE_KEY="staging-ssm/host-stack-bundle.$(date +%s).$$.tar.gz"
staging_aws s3 cp "$TAR_LOCAL" "s3://${STAGING_SSM_SCRIPT_BUCKET}/${BUNDLE_KEY}" >/dev/null
rm -rf "$TMP_BUNDLE" "$TAR_LOCAL" "$TMP_REGEN"

PARAMS=$(mktemp)
cat > "$PARAMS" <<EOF
{
  "commands": [
    "set -euo pipefail",
    "mkdir -p /tmp/bianca-staging-deploy",
    "aws s3 cp 's3://${STAGING_SSM_SCRIPT_BUCKET}/${BUNDLE_KEY}' /tmp/bianca-staging-deploy/bundle.tar.gz",
    "tar -xzf /tmp/bianca-staging-deploy/bundle.tar.gz -C /tmp/bianca-staging-deploy",
    "chmod +x /tmp/bianca-staging-deploy/*.sh",
    "export ENVIRONMENT=staging AWS_REGION=${STAGING_AWS_REGION} DEPLOY_GIT_SHA=${GIT_SHA}",
    "bash /tmp/bianca-staging-deploy/regenerate-host-stack.sh",
    "rm -rf /tmp/bianca-staging-deploy",
    "aws s3 rm 's3://${STAGING_SSM_SCRIPT_BUCKET}/${BUNDLE_KEY}' || true"
  ]
}
EOF

CMD_ID=$(staging_aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "bianca staging regenerate-host-stack" \
  --parameters "file://${PARAMS}" \
  --query 'Command.CommandId' \
  --output text)
rm -f "$PARAMS"
echo "   SSM CommandId: $CMD_ID"

STATUS="InProgress"
for _ in $(seq 1 120); do
  STATUS=$(staging_aws ssm get-command-invocation \
    --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
    --query 'Status' --output text 2>/dev/null || echo "InProgress")
  case "$STATUS" in Success|Failed|Cancelled|TimedOut) break ;; esac
  sleep 5
done
echo "──── regenerate stdout ────"
staging_aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
  --query 'StandardOutputContent' --output text || true
echo "──── regenerate stderr ────"
staging_aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
  --query 'StandardErrorContent' --output text || true
if [ "$STATUS" != "Success" ]; then
  echo -e "${RED}❌ regenerate-host-stack failed ($STATUS)${NC}"
  exit 1
fi

echo -e "${BLUE}📥 Pulling images and composing up...${NC}"
staging_ssm_run_script "$INSTANCE_ID" "$COMPOSE_UP" \
  "AWS_REGION=${STAGING_AWS_REGION}" \
  "AWS_ACCOUNT_ID=${STAGING_AWS_ACCOUNT_ID}" \
  "ECR_REGISTRY=${STAGING_ECR_REGISTRY}" \
  "DEPLOY_DIR=${STAGING_DEPLOY_DIR}"

# ─── Smoke checks ───
echo -e "${BLUE}🔍 Post-deploy smoke...${NC}"
SMOKE_OK=1

echo -n "   HTTPS health (${STAGING_HEALTH_URL})... "
HEALTH_JSON=""
for _ in $(seq 1 36); do
  if HEALTH_JSON=$(curl -sf --max-time 10 "$STAGING_HEALTH_URL" 2>/dev/null); then
    break
  fi
  sleep 5
done
if [ -z "$HEALTH_JSON" ]; then
  echo -e "${RED}FAIL${NC}"
  SMOKE_OK=0
else
  echo -e "${GREEN}OK${NC}"
  ARI_READY=$(echo "$HEALTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('services',{}).get('asterisk',{}).get('ready', False)).lower())" 2>/dev/null || echo "false")
  echo "   ARI connected (health.services.asterisk.ready): $ARI_READY"
  if [ "$ARI_READY" != "true" ]; then
    echo -e "${YELLOW}   ⚠️  ARI not ready yet — checking again via SSM logs/health${NC}"
    # Soft-fail: still try Asterisk trunk check
    SMOKE_OK=0
  fi
fi

echo "   PJSIP twilio-trunk endpoint (SSM)..."
TRUNK_OUT=$(mktemp)
set +e
staging_ssm_run_commands "$INSTANCE_ID" \
  "set -euo pipefail" \
  "docker exec staging_asterisk asterisk -rx 'pjsip show endpoints' 2>/dev/null || docker exec asterisk asterisk -rx 'pjsip show endpoints'" \
  > "$TRUNK_OUT" 2>&1
TRUNK_RC=$?
set -e
cat "$TRUNK_OUT"
if [ "$TRUNK_RC" -ne 0 ] || ! grep -qi 'twilio-trunk' "$TRUNK_OUT"; then
  echo -e "${YELLOW}   ⚠️  Could not confirm twilio-trunk endpoint${NC}"
  SMOKE_OK=0
else
  echo -e "${GREEN}   ✅ twilio-trunk present${NC}"
fi
rm -f "$TRUNK_OUT"

# ─── Stripe compose line (sourced from secret; never print key values) ───
echo -e "${BLUE}💳 Stripe publishable key in compose...${NC}"
set +e
STRIPE_SMOKE=$(staging_ssm_run_commands "$INSTANCE_ID" \
  "set -euo pipefail" \
  "COMPOSE_VAL=\$(grep -E '^[[:space:]]*-[[:space:]]*STRIPE_PUBLISHABLE_KEY=' ${STAGING_DEPLOY_DIR}/docker-compose.yml | head -1 | sed 's/^[^=]*=//' | tr -d '[:space:]')" \
  "if [ -z \"\$COMPOSE_VAL\" ]; then echo STRIPE_SMOKE=EMPTY; exit 1; fi" \
  "SECRET_VAL=\$(aws secretsmanager get-secret-value --region ${STAGING_AWS_REGION} --secret-id ${STAGING_SECRET_ID} --query SecretString --output text | jq -r '.STRIPE_PUBLISHABLE_KEY // empty')" \
  "if [ -z \"\$SECRET_VAL\" ]; then echo STRIPE_SMOKE=SECRET_MISSING; exit 1; fi" \
  "if [ \"\$COMPOSE_VAL\" != \"\$SECRET_VAL\" ]; then echo STRIPE_SMOKE=MISMATCH; exit 1; fi" \
  "case \"\$COMPOSE_VAL\" in pk_test_dummy|pk_test_1234567890|pk_test_FAKE*) echo STRIPE_SMOKE=FIXTURE_LITERAL; exit 1 ;; esac" \
  "echo STRIPE_SMOKE=OK prefix=\$(printf '%s' \"\$COMPOSE_VAL\" | cut -c1-8)" \
  2>&1)
STRIPE_SMOKE_RC=$?
set -e
echo "$STRIPE_SMOKE" | grep -E 'STRIPE_SMOKE=|Success|Failed' || echo "$STRIPE_SMOKE" | tail -n 5
if [ "$STRIPE_SMOKE_RC" -ne 0 ] || ! echo "$STRIPE_SMOKE" | grep -q 'STRIPE_SMOKE=OK'; then
  echo -e "${RED}❌ Compose STRIPE_PUBLISHABLE_KEY is empty, mismatches ${STAGING_SECRET_ID}, or matches a repo fixture literal${NC}"
  SMOKE_OK=0
else
  echo -e "${GREEN}✅ Compose Stripe line matches Secrets Manager (${STAGING_SECRET_ID})${NC}"
fi

# ─── Twilio verification (no secrets in output) ───
echo -e "${BLUE}📞 Twilio staging number configuration...${NC}"
verify_twilio() {
  local secret_json acct auth
  set +e
  secret_json=$(staging_aws secretsmanager get-secret-value \
    --secret-id "$STAGING_SECRET_ID" \
    --query SecretString --output text 2>/dev/null)
  set -e
  if [ -z "${secret_json:-}" ] || [ "$secret_json" = "None" ]; then
    return 2
  fi
  acct=$(echo "$secret_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('TWILIO_ACCOUNTSID') or d.get('TWILIO_ACCOUNT_SID') or '')")
  auth=$(echo "$secret_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('TWILIO_AUTHTOKEN') or d.get('TWILIO_AUTH_TOKEN') or '')")
  if [ -z "$acct" ] || [ -z "$auth" ]; then
    return 2
  fi

  local sip_eip
  sip_eip=$(staging_get_sip_eip)

  python3 - "$acct" "$auth" "$STAGING_PHONE_E164" "$sip_eip" "$STAGING_SIP_HOST" "$STAGING_API_URL" <<'PY'
import json, sys, urllib.request, urllib.error, base64
acct, auth, phone, sip_eip, sip_host, api_url = sys.argv[1:7]
token = base64.b64encode(f"{acct}:{auth}".encode()).decode()
url = f"https://api.twilio.com/2010-04-01/Accounts/{acct}/IncomingPhoneNumbers.json?PhoneNumber={urllib.request.quote(phone)}"
req = urllib.request.Request(url, headers={"Authorization": f"Basic {token}"})
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.load(resp)
except Exception as e:
    print(f"Twilio API unavailable: {e}")
    sys.exit(2)
nums = data.get("incoming_phone_numbers") or []
if not nums:
    print(f"No IncomingPhoneNumber found for {phone}")
    sys.exit(1)
n = nums[0]
voice_url = n.get("voice_url") or ""
voice_method = n.get("voice_method") or ""
# Elastic SIP trunk association is via TrunkSid / Originating; report voice_url + friendly name
print(f"Number: {n.get('phone_number')}")
print(f"FriendlyName: {n.get('friendly_name')}")
print(f"VoiceUrl: {voice_url or '(empty)'}")
print(f"VoiceMethod: {voice_method or '(empty)'}")
print(f"TrunkSid: {n.get('trunk_sid') or '(none)'}")
hints = []
blob = (voice_url + " " + (n.get('sms_url') or "")).lower()
if sip_eip and sip_eip in voice_url:
    hints.append("voice_url contains staging SIP EIP")
if sip_host and sip_host.lower() in blob:
    hints.append("config references staging-sip host")
if "staging-api" in blob or api_url.replace("https://", "") in blob:
    hints.append("config references staging-api")
if n.get("trunk_sid"):
    hints.append("number is attached to an Elastic SIP Trunk (confirm Origination → staging SIP URI in Console)")
if hints:
    print("Signals: " + "; ".join(hints))
else:
    print("Signals: none matched automatically — verify SIP Origination URI points at sip:" + sip_host + " (EIP " + (sip_eip or "?") + ")")
PY
}

set +e
verify_twilio
TWILIO_RC=$?
set -e
if [ "$TWILIO_RC" -eq 2 ]; then
  cat <<EOF
${YELLOW}Twilio API check skipped (credentials unavailable or incomplete in ${STAGING_SECRET_ID}).${NC}

Manual Console steps:
  1. Twilio Console → Phone Numbers → ${STAGING_PHONE_E164}
  2. Confirm Elastic SIP Trunk (or Voice webhook) routes to staging:
       SIP: sip:${STAGING_SIP_HOST}  (EIP from terraform tag ${STAGING_EIP_NAME_TAG})
       HTTPS webhooks (if any): ${STAGING_API_URL}
  3. Confirm this number is NOT the production number (+16047060134).
EOF
elif [ "$TWILIO_RC" -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Twilio verification incomplete — use Console steps above if needed${NC}"
fi

print_staging_checklist "$GIT_SHA" "$DIGESTS"

if [ "$SMOKE_OK" -ne 1 ]; then
  echo -e "${YELLOW}⚠️  Deploy finished with smoke warnings — fix ARI/trunk before voice testing.${NC}"
  exit 0
fi

echo -e "${GREEN}✅ Staging deploy complete${NC}"
