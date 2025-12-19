#!/bin/bash
# Check CodeDeploy deployment status for staging

set -e

PROFILE="jordan"
REGION="us-east-2"
APP_NAME="bianca-staging"
DEPLOY_GROUP="bianca-staging-ec2"

echo "🔍 Checking CodeDeploy deployment status..."
echo ""

# Get latest deployment
DEPLOYMENT_ID=$(aws deploy list-deployments \
  --application-name "$APP_NAME" \
  --deployment-group-name "$DEPLOY_GROUP" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --max-items 1 \
  --output json | jq -r '.deployments[0]')

if [ -z "$DEPLOYMENT_ID" ] || [ "$DEPLOYMENT_ID" = "null" ]; then
  echo "❌ No deployments found"
  exit 1
fi

echo "📋 Deployment ID: $DEPLOYMENT_ID"
echo ""

# Get deployment status
echo "📊 Deployment Status:"
aws deploy get-deployment \
  --deployment-id "$DEPLOYMENT_ID" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --output json | jq '{
    status: .deploymentInfo.status,
    createTime: .deploymentInfo.createTime,
    completeTime: .deploymentInfo.completeTime,
    errorInformation: .deploymentInfo.errorInformation,
    description: .deploymentInfo.description
  }'

echo ""
echo "📋 Instance Status:"
INSTANCE_ID=$(aws deploy list-deployment-instances \
  --deployment-id "$DEPLOYMENT_ID" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --output json | jq -r '.instancesList[0]')

if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "null" ]; then
  echo "Instance ID: $INSTANCE_ID"
  echo ""
  aws deploy get-deployment-instance \
    --deployment-id "$DEPLOYMENT_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --output json | jq '{
      status: .instanceSummary.status,
      lifecycleEvents: .instanceSummary.lifecycleEvents | map({
        name: .lifecycleEventName,
        status: .status,
        startTime: .startTime,
        endTime: .endTime,
        diagnostics: .diagnostics
      })
    }'
else
  echo "No instances found for this deployment"
fi

echo ""
echo "📜 To check logs on the EC2 instance, SSH in and check:"
echo "   /opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log"
echo "   /var/log/aws/codedeploy-agent/codedeploy-agent.log"
echo ""
echo "   Or check CodeDeploy logs:"
echo "   tail -f /opt/codedeploy-agent/deployment-root/*/d-*/logs/scripts.log"
