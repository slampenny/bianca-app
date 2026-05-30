#!/usr/bin/env bash
# Merge missing embedding anchor phrases into staging MongoDB (uses local repo defaults).
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-jordan}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-2}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$(cd "$(dirname "$0")/.." && pwd)"

echo "AWS identity:"
aws sts get-caller-identity --query Account --output text

INSTANCE_ID="${STAGING_INSTANCE_ID:-}"
if [[ -z "$INSTANCE_ID" ]]; then
  INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)
fi
echo "Staging instance: $INSTANCE_ID"

# Staging app uses docker network hostname for Mongo
MONGODB_URL="${MONGODB_URL:-mongodb://staging_mongodb:27017/bianca-app}"

# If not reachable locally, run inside staging_app container via SSM
if ! (cd "$BACKEND" && NODE_ENV=staging MONGODB_URL="$MONGODB_URL" node -e "
const mongoose=require('mongoose');
mongoose.connect(process.argv[1],{serverSelectionTimeoutMS:3000}).then(()=>process.exit(0)).catch(()=>process.exit(1));
" "$MONGODB_URL" 2>/dev/null); then
  echo "Local Mongo unreachable; running merge via SSM inside staging_app..."
  CMD_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name AWS-RunShellScript \
    --parameters "$(node -e "
const cmds = [
  'docker exec staging_app test -f src/scripts/mergeEmbeddingAnchorDefaults.js && MERGE=src/scripts/mergeEmbeddingAnchorDefaults.js || MERGE=',
  'if [ -z \"\$MERGE\" ]; then echo NO_MERGE_SCRIPT_ON_CONTAINER; docker exec staging_app ls src/scripts/ 2>&1 | head -5; exit 2; fi',
  'docker exec staging_app node \$MERGE',
];
console.log(JSON.stringify({commands: cmds}));
")" \
    --query Command.CommandId --output text)
  echo "SSM command: $CMD_ID (waiting...)"
  for i in $(seq 1 30); do
    sleep 4
    ST=$(aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query Status --output text 2>/dev/null || echo Pending)
    if [[ "$ST" == "Success" || "$ST" == "Failed" ]]; then
      aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
        --query '{Status:Status,Out:StandardOutputContent,Err:StandardErrorContent}' --output json
      [[ "$ST" == "Success" ]] || exit 1
      exit 0
    fi
  done
  echo "SSM timed out"
  exit 1
fi

cd "$BACKEND"
NODE_ENV=staging MONGODB_URL="$MONGODB_URL" node src/scripts/mergeEmbeddingAnchorDefaults.js
