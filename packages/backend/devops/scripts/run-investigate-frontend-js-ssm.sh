#!/usr/bin/env bash
# Run the frontend JS investigation on the staging instance via AWS SSM (no SSH needed).
# Requires: AWS CLI, instance must have SSM agent and be in "running" state.
# Usage: ./run-investigate-frontend-js-ssm.sh [--green] [--profile PROFILE]

set -e

GREEN=""
PROFILE=""
REGION="${AWS_REGION:-us-east-2}"
while [ $# -gt 0 ]; do
  case "$1" in
    --green) GREEN="green"; shift ;;
    --profile) PROFILE="$2"; shift 2 ;;
    *) echo "Usage: $0 [--green] [--profile PROFILE]"; exit 1 ;;
  esac
done

TAG_NAME="bianca-staging"
[ "$GREEN" = "green" ] && TAG_NAME="bianca-staging-green"

INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$TAG_NAME" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text --region "$REGION" ${PROFILE:+--profile $PROFILE} 2>/dev/null || true)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo "No running instance found with Name=$TAG_NAME. Try --green for bianca-staging-green, or set --profile."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/investigate-frontend-js.sh"
if [ ! -f "$SCRIPT_PATH" ]; then
  echo "Script not found: $SCRIPT_PATH"
  exit 1
fi

echo "Uploading and running frontend JS investigation on instance $INSTANCE_ID (Name=$TAG_NAME)..."

# Minimal inline command (fits SSM limit); uses jq to escape for JSON
INLINE_CMD='C=$(docker ps --format "{{.Names}}"|grep _frontend$|head -1);[ -z "$C" ]&&echo "No frontend container"&&exit 1;echo "Container: $C";echo "Script src:";docker exec $C cat /usr/share/nginx/html/index.html 2>/dev/null|grep -oE "src=\"[^\"]+\\.js\""|head -1;SRC=$(docker exec $C cat /usr/share/nginx/html/index.html 2>/dev/null|grep -oE "src=\"[^\"]+\\.js\""|head -1|sed "s/src=\"//;s/\"$//");[ -n "$SRC" ]&&FP="${SRC#/}"&&docker exec $C test -f "/usr/share/nginx/html/$FP" 2>/dev/null&&echo "FILE EXISTS: $FP"||echo "FILE MISSING: $FP";[ -n "$SRC" ]&&echo "Curl $SRC:"&&docker exec $C curl -s -w " HTTP:%{http_code}" "http://127.0.0.1$SRC" 2>/dev/null|head -c 300'
# Build JSON params (jq or python for proper escaping)
if command -v jq >/dev/null 2>&1; then
  PARAMS=$(jq -n --arg cmd "$INLINE_CMD" '{commands:[$cmd]}')
elif command -v python3 >/dev/null 2>&1; then
  PARAMS=$(python3 -c "import json,sys; print(json.dumps({'commands':[sys.argv[1]]}))" "$INLINE_CMD")
else
  echo "Need jq or python3 to build SSM parameters. Install jq or run via SSH."
  exit 1
fi
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "$PARAMS" \
  --timeout-seconds 90 \
  --region "$REGION" \
  ${PROFILE:+--profile $PROFILE} \
  --query 'Command.CommandId' \
  --output text 2>/dev/null)

if [ -z "$COMMAND_ID" ]; then
  echo "SSM send-command failed. Instance may not be registered with SSM."
  echo "Run via SSH instead:"
  echo "  IP=\$(aws ec2 describe-instances --filters Name=tag:Name,Values=$TAG_NAME Name=instance-state-name,Values=running --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --region $REGION ${PROFILE:+--profile $PROFILE})"
  echo "  scp -i ~/.ssh/YOUR_KEY.pem $SCRIPT_PATH ec2-user@\$IP:~/"
  echo "  ssh -i ~/.ssh/YOUR_KEY.pem ec2-user@\$IP 'bash ~/investigate-frontend-js.sh'"
  exit 1
fi

echo "Command ID: $COMMAND_ID (waiting for result...)"
for i in {1..45}; do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    ${PROFILE:+--profile $PROFILE} \
    --query 'Status' \
    --output text 2>/dev/null || echo "Unknown")
  case "$STATUS" in
    Success|Failed|Cancelled|TimedOut) break ;;
  esac
  sleep 2
done

echo ""
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  ${PROFILE:+--profile $PROFILE} \
  --output text \
  --query 'StandardOutputContent' 2>/dev/null || echo "(no output)"

STDERR=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  ${PROFILE:+--profile $PROFILE} \
  --query 'StandardErrorContent' \
  --output text 2>/dev/null || true)
[ -n "$STDERR" ] && echo "=== stderr ===" && echo "$STDERR" >&2

FINAL_STATUS=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  ${PROFILE:+--profile $PROFILE} \
  --query 'Status' \
  --output text 2>/dev/null)
echo "" && echo "=== Status: $FINAL_STATUS ==="
