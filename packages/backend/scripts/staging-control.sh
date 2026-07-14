#!/bin/bash
# staging-control.sh — start / stop / status for the Terraform-managed staging EC2.
# Does NOT provision or terminate instances (terraform owns EIP/ALB lifecycle).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/staging-common.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_status() {
  echo -e "${BLUE}🔍 Staging status${NC}"

  local ids id count state ip always_on
  ids=$(staging_list_instance_ids)
  count=$(echo "$ids" | grep -c . || true)

  if [ "${count:-0}" -eq 0 ]; then
    echo -e "${RED}❌ No staging instance found (Name=${STAGING_INSTANCE_NAME_TAG}).${NC}"
    echo "   Apply Terraform: packages/backend/devops/terraform/staging.tf"
    return 1
  fi

  if [ "$count" -gt 1 ]; then
    echo -e "${YELLOW}⚠️  Found $count instances tagged Name=${STAGING_INSTANCE_NAME_TAG}; using EIP-preferred / newest:${NC}"
    echo "$ids" | sed 's/^/     /'
  fi

  id=$(staging_get_instance_id)
  state=$(staging_get_instance_state "$id")
  ip=$(staging_get_public_ip "$id")

  always_on=$(staging_aws ssm get-parameter \
    --name "/bianca/staging/always-on" \
    --query 'Parameter.Value' \
    --output text 2>/dev/null || echo "false")

  echo -e "Instance ID:     ${YELLOW}${id}${NC}"
  echo -e "Status:          ${GREEN}${state}${NC}"
  echo -e "Public IP:       ${YELLOW}${ip}${NC}"
  echo -e "SIP EIP:         ${YELLOW}$(staging_get_sip_eip || echo unknown)${NC}"
  echo -e "Always-on:       ${YELLOW}${always_on}${NC}"
  echo -e "Staging number:  ${YELLOW}${STAGING_PHONE_E164}${NC}"
  echo -e "Health URL:      ${STAGING_HEALTH_URL}"
  echo -e "Auto-stop:       bianca-staging-auto-stop (stops idle; never starts)"

  if [ "$state" != "running" ]; then
    echo -e "${YELLOW}Instance not running — skip remote health/digest checks.${NC}"
    return 0
  fi

  echo -n "App health:      "
  local health_json ari
  if health_json=$(curl -sf --max-time 10 "$STAGING_HEALTH_URL" 2>/dev/null); then
    ari=$(echo "$health_json" | python3 -c "import sys,json; d=json.load(sys.stdin); a=d.get('services',{}).get('asterisk',{}); print('ready='+str(a.get('ready'))+' status='+str(a.get('status')))" 2>/dev/null || echo "parse-error")
    echo -e "${GREEN}OK${NC} (ARI: $ari)"
  else
    echo -e "${RED}unreachable${NC}"
  fi

  if staging_wait_ssm_online "$id" 3 2>/dev/null; then
    echo "Remote digests / git SHA / trunk:"
    set +e
    staging_ssm_run_commands "$id" \
      "set -euo pipefail" \
      "echo GIT_SHA=\$(cat ${STAGING_DEPLOY_DIR}/.deployed-git-sha 2>/dev/null || echo unknown)" \
      "echo DEPLOYED_AT=\$(cat ${STAGING_DEPLOY_DIR}/.deployed-at 2>/dev/null || echo unknown)" \
      "docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E 'bianca-app-(backend|frontend|admin|asterisk).*staging' || true" \
      "docker exec staging_asterisk asterisk -rx 'pjsip show endpoints' 2>/dev/null | grep -i twilio || docker exec asterisk asterisk -rx 'pjsip show endpoints' 2>/dev/null | grep -i twilio || echo 'trunk: (unavailable)'"
    set -e
  else
    echo -e "${YELLOW}SSM not online — cannot read digests/trunk${NC}"
  fi
}

start_staging() {
  echo -e "${BLUE}🚀 Starting staging instance...${NC}"

  local ids id count status ip
  ids=$(staging_list_instance_ids)
  count=$(echo "$ids" | grep -c . || true)

  if [ "${count:-0}" -eq 0 ]; then
    echo -e "${RED}❌ No staging instance found.${NC}"
    echo "   Apply staging.tf (Terraform) — do not provision outside Terraform."
    echo "   Example: cd packages/backend/devops/terraform && terraform apply -target=aws_instance.staging ..."
    return 1
  fi

  if [ "$count" -gt 1 ]; then
    echo -e "${YELLOW}⚠️  $count staging-tagged instances exist; will start the EIP-preferred/newest one only.${NC}"
  fi

  id=$(staging_get_instance_id)
  status=$(staging_get_instance_state "$id")

  if [ "$status" = "running" ]; then
    echo -e "${YELLOW}⚠️  Instance already running (${id})${NC}"
  elif [ "$status" = "pending" ]; then
    echo -e "${YELLOW}⚠️  Instance pending — waiting...${NC}"
    staging_aws ec2 wait instance-running --instance-ids "$id"
  elif [ "$status" = "stopping" ] || [ "$status" = "shutting-down" ]; then
    echo -e "${RED}❌ Instance is $status — wait until stopped, then yarn staging:up again${NC}"
    return 1
  else
    staging_aws ec2 start-instances --instance-ids "$id" >/dev/null
    echo -e "${GREEN}✅ Start initiated — waiting for running + status checks...${NC}"
    staging_aws ec2 wait instance-running --instance-ids "$id"
    staging_aws ec2 wait instance-status-ok --instance-ids "$id" 2>/dev/null || true
  fi

  ip=$(staging_get_public_ip "$id")
  echo -e "${GREEN}✅ Instance running: ${id} @ ${ip}${NC}"

  # Bootstrap gate
  echo "   Checking bootstrap (/opt/bianca-staging compose + containers)..."
  if ! staging_wait_ssm_online "$id" 24; then
    echo -e "${YELLOW}⚠️  SSM not ready yet. When Online, run: yarn staging:deploy${NC}"
    print_staging_checklist "unknown" ""
    return 0
  fi

  local boot
  set +e
  boot=$(staging_ssm_run_commands "$id" \
    "set -euo pipefail" \
    "if [ -f ${STAGING_DEPLOY_DIR}/docker-compose.yml ]; then echo COMPOSE=yes; else echo COMPOSE=no; fi" \
    "echo CONTAINERS=\$(docker ps -q --filter name=staging_ | wc -l | tr -d ' ')" \
    2>&1)
  set -e
  echo "$boot"
  if ! echo "$boot" | grep -q 'COMPOSE=yes'; then
    echo -e "${YELLOW}⚠️  Compose not present on host — run: yarn staging:deploy${NC}"
  elif echo "$boot" | grep -q 'CONTAINERS=0'; then
    echo -e "${YELLOW}⚠️  No staging_* containers running — run: yarn staging:deploy${NC}"
  fi

  print_staging_checklist "unknown" ""
}

stop_staging() {
  echo -e "${BLUE}🛑 Stopping staging instance...${NC}"

  local id status
  id=$(staging_get_instance_id || true)
  if [ -z "${id:-}" ] || [ "$id" = "None" ]; then
    echo -e "${YELLOW}⚠️  No staging instance found — nothing to stop (safe).${NC}"
    return 0
  fi

  status=$(staging_get_instance_state "$id")
  if [ "$status" = "stopped" ]; then
    echo -e "${YELLOW}⚠️  Already stopped (${id})${NC}"
    echo "stopped (instance persists; terraform destroy for full teardown)"
    return 0
  fi

  staging_aws ec2 stop-instances --instance-ids "$id" >/dev/null
  echo -e "${GREEN}✅ Stop initiated for ${id}${NC}"
  echo "stopped (instance persists; terraform destroy for full teardown)"
}

enable_always_on() {
  staging_aws ssm put-parameter \
    --name "/bianca/staging/always-on" \
    --value "true" \
    --type "String" \
    --overwrite >/dev/null
  echo -e "${GREEN}✅ Always-on enabled (auto-stop paused)${NC}"
}

disable_always_on() {
  staging_aws ssm put-parameter \
    --name "/bianca/staging/always-on" \
    --value "false" \
    --type "String" \
    --overwrite >/dev/null
  echo -e "${GREEN}✅ Always-on disabled (idle auto-stop resumes)${NC}"
}

show_usage() {
  cat <<EOF
Bianca Staging Control

Usage: $0 [COMMAND]

Commands:
  status      Instance state, health, ARI, trunk, digests, staging number
  start       Start Terraform-managed instance (idempotent; does not provision)
  stop        Stop instance (instance persists; terraform destroy for full teardown)
  always-on   Pause idle auto-stop Lambda
  schedule    Resume idle auto-stop
  help

Related:
  yarn staging:deploy   Build :staging images, SSM compose regenerate, smoke checks
  yarn staging:live     Rsync live-dev (not production-parity)
EOF
}

case "${1:-help}" in
  status) show_status ;;
  start) start_staging ;;
  stop) stop_staging ;;
  always-on) enable_always_on ;;
  schedule) disable_always_on ;;
  help|--help|-h) show_usage ;;
  *)
    echo -e "${RED}❌ Unknown command: $1${NC}"
    show_usage
    exit 1
    ;;
esac
