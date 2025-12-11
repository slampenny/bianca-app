#!/bin/bash
# Script to debug staging 502 error

set -e

echo "=== Debugging Staging 502 Error ==="
echo ""

echo "1. Check CodePipeline status..."
echo "   Run: aws codepipeline get-pipeline-state --name bianca-staging-pipeline --profile jordan"
echo ""

echo "2. Check EC2 instance status..."
echo "   Run: aws ec2 describe-instances --filters 'Name=tag:Name,Values=bianca-staging' --profile jordan --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PublicIpAddress]' --output table"
echo ""

echo "3. Check load balancer target health..."
echo "   Run: aws elbv2 describe-target-health --target-group-arn <TARGET_GROUP_ARN> --profile jordan"
echo "   (Get target group ARN from: aws elbv2 describe-target-groups --names bianca-staging-*-tg --profile jordan)"
echo ""

echo "4. Check application logs (SSM into instance)..."
echo "   Run: aws ssm start-session --target <INSTANCE_ID> --profile jordan"
echo "   Then check:"
echo "   - docker ps (are containers running?)"
echo "   - docker logs production_app (or staging_app)"
echo "   - /var/log/user-data.log"
echo "   - systemctl status codedeploy-agent"
echo ""

echo "5. Check CloudWatch logs..."
echo "   - /bianca/staging/app"
echo "   - /bianca/staging/nginx"
echo "   - /ecs/bianca-app-backend"
echo ""

echo "6. Common causes of 502 after pipeline changes:"
echo "   - Buildspec path changed but file doesn't exist at new location"
echo "   - Docker images not built correctly"
echo "   - CodeDeploy deployment failed"
echo "   - Instance was replaced (from terraform plan) and not fully configured"
echo ""

