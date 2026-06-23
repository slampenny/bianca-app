#!/bin/bash
# Script to verify that CodePipeline deploys to production EC2 instance

set -e

REGION="ca-central-1"
PIPELINE_NAME="bianca-production-pipeline"
CODEDEPLOY_APP="bianca-production"
CODEDEPLOY_GROUP="bianca-production-ec2"

echo "🔍 Verifying Production Deployment Configuration"
echo "================================================"
echo ""

# 1. Check if pipeline exists
echo "1️⃣  Checking CodePipeline..."
if aws codepipeline get-pipeline --name "$PIPELINE_NAME" --region "$REGION" &>/dev/null; then
    echo "   ✅ Pipeline '$PIPELINE_NAME' exists"
    
    # Get pipeline state
    echo "   📊 Pipeline state:"
    aws codepipeline get-pipeline-state --name "$PIPELINE_NAME" --region "$REGION" \
        --query 'stageStates[*].[stageName,latestExecution.status]' --output table 2>/dev/null || echo "   ⚠️  Could not get pipeline state"
    
    # Get recent executions
    echo ""
    echo "   📜 Recent executions:"
    aws codepipeline list-pipeline-executions --pipeline-name "$PIPELINE_NAME" --region "$REGION" --max-items 3 \
        --query 'pipelineExecutionSummaries[*].[pipelineExecutionId,status,startTime]' --output table 2>/dev/null || echo "   ⚠️  Could not get executions"
else
    echo "   ❌ Pipeline '$PIPELINE_NAME' does NOT exist"
    exit 1
fi

echo ""
echo "2️⃣  Checking CodeDeploy Application..."
if aws codedeploy get-application --application-name "$CODEDEPLOY_APP" --region "$REGION" &>/dev/null; then
    echo "   ✅ CodeDeploy application '$CODEDEPLOY_APP' exists"
else
    echo "   ❌ CodeDeploy application '$CODEDEPLOY_APP' does NOT exist"
    exit 1
fi

echo ""
echo "3️⃣  Checking CodeDeploy Deployment Group..."
if aws codedeploy get-deployment-group --application-name "$CODEDEPLOY_APP" --deployment-group-name "$CODEDEPLOY_GROUP" --region "$REGION" &>/dev/null; then
    echo "   ✅ Deployment group '$CODEDEPLOY_GROUP' exists"
    
    # Get deployment group details
    echo ""
    echo "   📋 Deployment group configuration:"
    aws codedeploy get-deployment-group --application-name "$CODEDEPLOY_APP" --deployment-group-name "$CODEDEPLOY_GROUP" --region "$REGION" \
        --query 'deploymentGroupInfo.{EC2TagFilters:ec2TagFilters,ServiceRoleArn:serviceRoleArn,DeploymentConfig:deploymentConfigName}' --output json 2>/dev/null || echo "   ⚠️  Could not get deployment group details"
    
    # Get recent deployments
    echo ""
    echo "   📜 Recent deployments:"
    aws codedeploy list-deployments --application-name "$CODEDEPLOY_APP" --deployment-group-name "$CODEDEPLOY_GROUP" --region "$REGION" --max-items 5 \
        --query 'deployments[*]' --output table 2>/dev/null || echo "   ⚠️  No deployments found"
else
    echo "   ❌ Deployment group '$CODEDEPLOY_GROUP' does NOT exist"
    exit 1
fi

echo ""
echo "4️⃣  Checking Production EC2 Instance..."
INSTANCE_ID=$(aws ec2 describe-instances --region "$REGION" \
    --filters "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || echo "")

if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
    echo "   ✅ Production instance found: $INSTANCE_ID"
    
    # Get instance details
    echo ""
    echo "   📋 Instance details:"
    aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].{InstanceId:InstanceId,State:State.Name,PrivateIp:PrivateIpAddress,PublicIp:PublicIpAddress,Tags:Tags[?Key==`Name`].Value|[0]}' --output json 2>/dev/null || echo "   ⚠️  Could not get instance details"
    
    # Check if CodeDeploy agent is installed
    echo ""
    echo "   🔍 Checking CodeDeploy agent status..."
    echo "   (This requires SSH access to the instance)"
    echo "   Run this command on the instance:"
    echo "   sudo systemctl status codedeploy-agent"
    
else
    echo "   ❌ Production instance with tag 'Name=bianca-production' NOT found"
    exit 1
fi

echo ""
echo "5️⃣  Verifying Pipeline → CodeDeploy Connection..."
echo "   Checking pipeline Deploy stage configuration..."

# Get pipeline definition and check Deploy stage
DEPLOY_STAGE=$(aws codepipeline get-pipeline --name "$PIPELINE_NAME" --region "$REGION" \
    --query 'pipeline.stages[?name==`Deploy`]' --output json 2>/dev/null || echo "[]")

if echo "$DEPLOY_STAGE" | grep -q "CodeDeploy"; then
    echo "   ✅ Pipeline Deploy stage uses CodeDeploy"
    
    # Extract CodeDeploy configuration
    APP_NAME=$(echo "$DEPLOY_STAGE" | jq -r '.[0].actions[0].configuration.ApplicationName // empty' 2>/dev/null || echo "")
    DEPLOY_GROUP=$(echo "$DEPLOY_STAGE" | jq -r '.[0].actions[0].configuration.DeploymentGroupName // empty' 2>/dev/null || echo "")
    
    if [ "$APP_NAME" = "$CODEDEPLOY_APP" ] && [ "$DEPLOY_GROUP" = "$CODEDEPLOY_GROUP" ]; then
        echo "   ✅ Pipeline correctly configured:"
        echo "      Application: $APP_NAME"
        echo "      Deployment Group: $DEPLOY_GROUP"
    else
        echo "   ⚠️  Pipeline configuration mismatch:"
        echo "      Expected: App=$CODEDEPLOY_APP, Group=$CODEDEPLOY_GROUP"
        echo "      Found: App=$APP_NAME, Group=$DEPLOY_GROUP"
    fi
else
    echo "   ❌ Pipeline Deploy stage does NOT use CodeDeploy"
fi

echo ""
echo "6️⃣  Verifying CodeDeploy → EC2 Connection..."
echo "   Checking if deployment group can find the instance..."

# Check if instance matches the tag filter
TAG_FILTER=$(aws codedeploy get-deployment-group --application-name "$CODEDEPLOY_APP" --deployment-group-name "$CODEDEPLOY_GROUP" --region "$REGION" \
    --query 'deploymentGroupInfo.ec2TagFilters[0]' --output json 2>/dev/null || echo "{}")

TAG_KEY=$(echo "$TAG_FILTER" | jq -r '.Key // empty' 2>/dev/null || echo "")
TAG_VALUE=$(echo "$TAG_FILTER" | jq -r '.Value // empty' 2>/dev/null || echo "")

if [ "$TAG_KEY" = "Name" ] && [ "$TAG_VALUE" = "bianca-production" ]; then
    echo "   ✅ Deployment group uses tag filter: $TAG_KEY=$TAG_VALUE"
    echo "   ✅ Instance has matching tag (verified above)"
else
    echo "   ⚠️  Tag filter mismatch:"
    echo "      Expected: Name=bianca-production"
    echo "      Found: $TAG_KEY=$TAG_VALUE"
fi

echo ""
echo "================================================"
echo "✅ Verification Complete"
echo ""
echo "📝 Summary:"
echo "   - Pipeline: $PIPELINE_NAME"
echo "   - CodeDeploy App: $CODEDEPLOY_APP"
echo "   - Deployment Group: $CODEDEPLOY_GROUP"
echo "   - Production Instance: $INSTANCE_ID"
echo ""
echo "💡 To manually trigger a deployment:"
echo "   aws codepipeline start-pipeline-execution --name $PIPELINE_NAME --region $REGION"
echo ""
echo "💡 To check CodeDeploy agent on instance:"
echo "   ssh -i your-key.pem ec2-user@<instance-ip>"
echo "   sudo systemctl status codedeploy-agent"
echo "   sudo tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log"
