#!/usr/bin/env bash
# Run from your laptop with AWS creds. Syncs EXTERNAL_ADDRESS / ASTERISK_PUBLIC_IP from
# instance metadata and restarts asterisk + app — same logic as CodeDeploy application_start.sh.
#
#   AWS_PROFILE=jordan AWS_REGION=us-east-2 ./sync-external-address-now.sh production
#   ./sync-external-address-now.sh staging
#
# Requires: IAM ssm:SendCommand, ssm:GetCommandInvocation; instance must have SSM agent + role.
set -euo pipefail

ENV_NAME="${1:-production}"
PROFILE="${AWS_PROFILE:-jordan}"
REGION="${AWS_REGION:-us-east-2}"

if [ "$ENV_NAME" = "production" ]; then
  NAME_TAG="bianca-production"
  DIR="bianca-production"
elif [ "$ENV_NAME" = "staging" ]; then
  NAME_TAG="bianca-staging"
  DIR="bianca-staging"
else
  echo "Usage: $0 [production|staging]"
  exit 1
fi

IID=$(aws ec2 describe-instances --profile "$PROFILE" --region "$REGION" \
  --filters "Name=tag:Name,Values=$NAME_TAG" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)

if [ -z "$IID" ] || [ "$IID" = "None" ]; then
  echo "ERROR: No running instance with Name=$NAME_TAG"
  exit 1
fi

echo "Instance: $IID  (/opt/$DIR)"

# Single-line script: metadata IP + sed docker-compose + restart (matches application_start.sh)
REMOTE_SCRIPT="cd /opt/$DIR || exit 1
PUBLIC_IP=\$(curl -sS --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4) || exit 1
echo \"Metadata public IP: \$PUBLIC_IP\"
cp -a docker-compose.yml \"docker-compose.yml.bak.sync.\$(date +%Y%m%d%H%M%S)\" 2>/dev/null || true
sed -i.bak -e \"s|EXTERNAL_ADDRESS=[^[:space:]]*|EXTERNAL_ADDRESS=\$PUBLIC_IP|\" -e \"s|ASTERISK_PUBLIC_IP=[^[:space:]]*|ASTERISK_PUBLIC_IP=\$PUBLIC_IP|\" docker-compose.yml
if docker compose version >/dev/null 2>&1; then docker compose up -d asterisk app; else docker-compose up -d asterisk app; fi
echo \"OK: EXTERNAL_ADDRESS and ASTERISK_PUBLIC_IP set to \$PUBLIC_IP\""

PARAMS_JSON=$(jq -n --arg cmd "$REMOTE_SCRIPT" '{commands: [$cmd]}')

CMD_ID=$(aws ssm send-command --profile "$PROFILE" --region "$REGION" \
  --instance-ids "$IID" \
  --document-name "AWS-RunShellScript" \
  --parameters "$PARAMS_JSON" \
  --timeout-seconds 120 \
  --comment "sync EXTERNAL_ADDRESS from metadata (sync-external-address-now.sh)" \
  --query 'Command.CommandId' --output text)

echo "SSM CommandId: $CMD_ID (waiting up to 2 min)..."

for _ in $(seq 1 24); do
  ST=$(aws ssm get-command-invocation --profile "$PROFILE" --region "$REGION" \
    --command-id "$CMD_ID" --instance-id "$IID" --query 'Status' --output text 2>/dev/null || echo "Pending")
  echo "  Status: $ST"
  if [ "$ST" = "Success" ]; then
    echo "--- stdout ---"
    aws ssm get-command-invocation --profile "$PROFILE" --region "$REGION" \
      --command-id "$CMD_ID" --instance-id "$IID" --query 'StandardOutputContent' --output text
    echo "--- stderr ---"
    aws ssm get-command-invocation --profile "$PROFILE" --region "$REGION" \
      --command-id "$CMD_ID" --instance-id "$IID" --query 'StandardErrorContent' --output text
    exit 0
  fi
  if [ "$ST" = "Failed" ] || [ "$ST" = "Cancelled" ] || [ "$ST" = "TimedOut" ]; then
    echo "SSM command failed with status: $ST"
    aws ssm get-command-invocation --profile "$PROFILE" --region "$REGION" \
      --command-id "$CMD_ID" --instance-id "$IID" --output json
    exit 1
  fi
  sleep 5
done

echo "Timed out waiting for SSM. Check: aws ssm get-command-invocation --command-id $CMD_ID --instance-id $IID"
exit 1
