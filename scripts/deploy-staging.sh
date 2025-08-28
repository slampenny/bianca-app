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
# Build frontend with staging config for proper environment
docker build -t bianca-app-frontend:staging -f devops/Dockerfile --build-arg BUILD_ENV=staging .

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

# Step 2: Deploy staging infrastructure (preserves database)
echo "🚀 Deploying staging infrastructure..."
yarn terraform:deploy

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