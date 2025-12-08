#!/bin/bash
# Script to check S3 bucket access and create if needed

set -e

BUCKET_NAME="bianca-terraform-state"
REGION="us-east-2"
PROFILE="jordan"

echo "🔍 Checking AWS credentials..."
aws sts get-caller-identity --profile $PROFILE

echo ""
echo "🔍 Checking if bucket exists..."
if aws s3 ls "s3://${BUCKET_NAME}" --region $REGION --profile $PROFILE 2>/dev/null; then
  echo "✅ Bucket exists and is accessible"
else
  echo "❌ Bucket does not exist or is not accessible"
  echo ""
  echo "Creating bucket..."
  aws s3 mb "s3://${BUCKET_NAME}" --region $REGION --profile $PROFILE
  echo "✅ Bucket created"
  
  echo "Enabling versioning..."
  aws s3api put-bucket-versioning \
    --bucket $BUCKET_NAME \
    --versioning-configuration Status=Enabled \
    --region $REGION \
    --profile $PROFILE
  echo "✅ Versioning enabled"
  
  echo "Enabling encryption..."
  aws s3api put-bucket-encryption \
    --bucket $BUCKET_NAME \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }]
    }' \
    --region $REGION \
    --profile $PROFILE
  echo "✅ Encryption enabled"
fi

echo ""
echo "✅ S3 bucket is ready!"
echo ""
echo "Now run:"
echo "  export AWS_PROFILE=jordan"
echo "  terraform init"
