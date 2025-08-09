#!/bin/bash
# Deploy staging environment script

echo "🚀 Deploying Bianca Staging Environment..."

# Step 1: Build and push Docker images (backend and frontend)
echo "🐳 Building and pushing backend Docker image..."
docker build -t bianca-app-backend:staging .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-backend:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:staging

echo "🔐 Logging into ECR..."
# Use temporary credential helper to avoid WSL issues
export AWS_PROFILE=jordan
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com

if [ $? -ne 0 ]; then
    echo "❌ ECR login failed. Please check your AWS credentials and try again."
    exit 1
fi

echo "📦 Pushing backend image to ECR..."
docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-backend:staging

if [ $? -ne 0 ]; then
    echo "❌ Backend docker push failed. Please check the error above."
    exit 1
fi

echo "🐳 Building and pushing frontend Docker image..."
cd ../bianca-app-frontend
docker build -t bianca-app-frontend:staging -f devops/Dockerfile .

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker build failed. Please check the error above."
    exit 1
fi

docker tag bianca-app-frontend:staging 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging

echo "📦 Pushing frontend image to ECR..."
docker push 730335291008.dkr.ecr.us-east-2.amazonaws.com/bianca-app-frontend:staging

if [ $? -ne 0 ]; then
    echo "❌ Frontend docker push failed. Please check the error above."
    exit 1
fi

cd ../bianca-app-backend

# Step 2: Plan staging resources
echo "📋 Planning staging resources..."
yarn terraform:command plan \
  -target=aws_vpc.staging \
  -target=aws_internet_gateway.staging \
  -target=aws_subnet.staging_public \
  -target=aws_subnet.staging_public_b \
  -target=aws_route_table.staging \
  -target=aws_route_table_association.staging_a \
  -target=aws_route_table_association.staging_b \
  -target=aws_security_group.staging \
  -target=aws_iam_role.staging_instance_role \
  -target=aws_iam_role_policy_attachment.staging_ssm \
  -target=aws_iam_role_policy_attachment.staging_cloudwatch \
  -target=aws_iam_role_policy.staging_instance_policy \
  -target=aws_iam_instance_profile.staging_profile \
  -target=aws_launch_template.staging \
  -target=aws_instance.staging \
  -target=aws_lb.staging \
  -target=aws_lb_target_group.staging_api \
  -target=aws_lb_target_group.staging_frontend \
  -target=aws_lb_target_group_attachment.staging_api \
  -target=aws_lb_target_group_attachment.staging_frontend \
  -target=aws_lb_listener.staging_http_redirect \
  -target=aws_lb_listener.staging_https \
  -target=aws_lb_listener_rule.staging_api_https_rule \
  -target=aws_route53_record.staging_api \
  -target=aws_route53_record.staging_frontend \
  -target=aws_route53_record.staging_sip \
  -target=aws_iam_role.staging_lambda_role \
  -target=aws_iam_role_policy.staging_lambda_policy \
  -target=data.archive_file.staging_auto_stop \
  -target=aws_lambda_function.staging_auto_stop \
  -target=aws_cloudwatch_event_rule.staging_auto_stop \
  -target=aws_cloudwatch_event_target.staging_auto_stop \
  -target=aws_lambda_permission.staging_auto_stop

echo "💡 Review the plan above. Press Enter to continue with apply, or Ctrl+C to cancel..."
read

# Step 3: Apply staging resources
echo "🚀 Applying staging resources..."
yarn terraform:command apply -auto-approve \
  -target=aws_vpc.staging \
  -target=aws_internet_gateway.staging \
  -target=aws_subnet.staging_public \
  -target=aws_subnet.staging_public_b \
  -target=aws_route_table.staging \
  -target=aws_route_table_association.staging_a \
  -target=aws_route_table_association.staging_b \
  -target=aws_security_group.staging \
  -target=aws_iam_role.staging_instance_role \
  -target=aws_iam_role_policy_attachment.staging_ssm \
  -target=aws_iam_role_policy_attachment.staging_cloudwatch \
  -target=aws_iam_role_policy.staging_instance_policy \
  -target=aws_iam_instance_profile.staging_profile \
  -target=aws_launch_template.staging \
  -target=aws_instance.staging \
  -target=aws_lb.staging \
  -target=aws_lb_target_group.staging_api \
  -target=aws_lb_target_group.staging_frontend \
  -target=aws_lb_target_group_attachment.staging_api \
  -target=aws_lb_target_group_attachment.staging_frontend \
  -target=aws_lb_listener.staging_http_redirect \
  -target=aws_lb_listener.staging_https \
  -target=aws_lb_listener_rule.staging_api_https_rule \
  -target=aws_route53_record.staging_api \
  -target=aws_route53_record.staging_frontend \
  -target=aws_route53_record.staging_sip \
  -target=aws_iam_role.staging_lambda_role \
  -target=aws_iam_role_policy.staging_lambda_policy \
  -target=data.archive_file.staging_auto_stop \
  -target=aws_lambda_function.staging_auto_stop \
  -target=aws_cloudwatch_event_rule.staging_auto_stop \
  -target=aws_cloudwatch_event_target.staging_auto_stop \
  -target=aws_lambda_permission.staging_auto_stop

echo "✅ Staging infrastructure deployed!"

echo "🧪 Testing staging environment..."
echo "Waiting 30 seconds for deployment to complete..."
sleep 30

echo "Testing staging API..."
curl -f https://staging-api.myphonefriend.com/health && echo "✅ Staging environment is healthy!" || echo "❌ Staging environment health check failed"

echo "🎉 Staging deployment complete!"
echo "🌐 Staging API: https://staging-api.myphonefriend.com"
echo "🌐 Staging Frontend: https://staging.myphonefriend.com"
echo "🔗 SIP Endpoint: staging-sip.myphonefriend.com"