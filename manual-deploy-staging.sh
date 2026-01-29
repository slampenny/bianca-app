#!/bin/bash
# Manually deploy latest build to staging EC2 instance

set -e

REGION="us-east-2"
PROFILE="jordan"
ECR_REGISTRY="730335291008.dkr.ecr.us-east-2.amazonaws.com"
DEPLOY_DIR="/opt/bianca-staging"

# Discover current staging instance by tag (blue/green: Name=bianca-staging is the one serving traffic)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text \
  --profile "$PROFILE" \
  --region "$REGION" 2>/dev/null || true)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo "❌ No running staging instance found with Name=bianca-staging in $REGION."
  echo "   Check AWS console or run: aws ec2 describe-instances --filters Name=instance-state-name,Values=running --query 'Reservations[*].Instances[*].[InstanceId,Tags[?Key==\`Name\`].Value|[0]]' --output table --profile $PROFILE --region $REGION"
  exit 1
fi

echo "🚀 Manually deploying latest build to staging EC2 instance..."
echo "   Instance: $INSTANCE_ID"
echo "   Region: $REGION"
echo ""

# Commands to run on the instance
cat > /tmp/manual-deploy-commands.sh <<'DEPLOY_SCRIPT'
#!/bin/bash
set -e

DEPLOY_DIR="/opt/bianca-staging"
ECR_REGISTRY="730335291008.dkr.ecr.us-east-2.amazonaws.com"
AWS_REGION="us-east-2"

echo "📦 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

echo "📥 Pulling latest images..."
docker pull $ECR_REGISTRY/bianca-app-backend:staging
docker pull $ECR_REGISTRY/bianca-app-frontend:staging
docker pull $ECR_REGISTRY/bianca-app-asterisk:staging

echo "🛑 Stopping existing containers..."
cd $DEPLOY_DIR
docker compose down 2>/dev/null || true

echo "🚀 Starting containers with latest images..."
docker compose up -d --pull always --force-recreate --remove-orphans

echo "⏳ Waiting for containers to start..."
sleep 10

echo "📊 Container status:"
docker ps --filter "name=staging_" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Checking health..."
sleep 5
docker ps --filter "name=staging_app" --format "{{.Names}}" | wc -l
docker ps --filter "name=staging_nginx" --format "{{.Names}}" | wc -l
DEPLOY_SCRIPT

echo "📤 Uploading deployment script to instance..."
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters file://<(cat <<EOF
{
  "commands": [
    "cd $DEPLOY_DIR",
    "aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY",
    "docker pull $ECR_REGISTRY/bianca-app-backend:staging",
    "docker pull $ECR_REGISTRY/bianca-app-frontend:staging",
    "docker pull $ECR_REGISTRY/bianca-app-asterisk:staging",
    "docker compose down 2>/dev/null || true",
    "docker compose up -d --pull always --force-recreate --remove-orphans",
    "sleep 10",
    "docker ps --filter 'name=staging_' --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'",
    "echo 'Checking health...'",
    "sleep 5",
    "docker ps --filter 'name=staging_app' --format '{{.Names}}' | wc -l",
    "docker ps --filter 'name=staging_nginx' --format '{{.Names}}' | wc -l"
  ]
}
EOF
) \
  --profile "$PROFILE" \
  --region "$REGION" \
  --output json > /tmp/ssm-command.json

COMMAND_ID=$(grep -o '"CommandId": "[^"]*"' /tmp/ssm-command.json | head -1 | sed 's/.*: "\([^"]*\)".*/\1/')
echo "   Command ID: $COMMAND_ID"
echo ""

echo "⏳ Waiting for command to complete..."
sleep 5

# Poll for completion
for i in {1..60}; do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Status' \
    --output text 2>/dev/null || echo "InProgress")
  
  if [ "$STATUS" = "Success" ] || [ "$STATUS" = "Failed" ] || [ "$STATUS" = "Cancelled" ]; then
    break
  fi
  sleep 2
done

echo ""
echo "📋 Command output:"
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query '[Status, StandardOutputContent, StandardErrorContent]' \
  --output text

echo ""
echo "✅ Manual deployment complete!"
