#!/bin/bash
# Quick test script to validate buildspec ECR_REGISTRY logic
# Run this locally to test without running the full pipeline

echo "Testing ECR_REGISTRY construction..."

# Simulate CodeBuild environment
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-2}"

# Test the logic from buildspec
if [ -z "$ECR_REGISTRY" ]; then
  echo "ECR_REGISTRY not set, getting from AWS..."
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
  if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ ERROR: Could not determine AWS Account ID"
    echo "Make sure you're logged into AWS: aws configure"
    exit 1
  fi
  export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
fi

echo "✅ ECR Registry: $ECR_REGISTRY"
echo "✅ AWS Region: ${AWS_DEFAULT_REGION}"
echo ""
echo "You can test ECR login with:"
echo "  aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin $ECR_REGISTRY"

