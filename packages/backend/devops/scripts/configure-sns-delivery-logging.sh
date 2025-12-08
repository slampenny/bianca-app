#!/bin/bash
# Configure SNS SMS delivery status logging to CloudWatch
# This script should be run after Terraform creates the IAM role and CloudWatch log group

set -e

AWS_REGION="${AWS_REGION:-us-east-2}"
AWS_PROFILE="${AWS_PROFILE:-jordan}"

# Get the IAM role ARN (created by Terraform)
ROLE_ARN=$(aws iam get-role \
  --profile "$AWS_PROFILE" \
  --role-name "bianca-staging-sns-delivery-status-role" \
  --query 'Role.Arn' \
  --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "❌ Error: IAM role 'bianca-staging-sns-delivery-status-role' not found"
  echo "   Please run 'terraform apply' first to create the role"
  exit 1
fi

echo "✅ Found IAM role: $ROLE_ARN"

# Configure SNS SMS attributes for delivery status logging
echo "Configuring SNS SMS delivery status logging..."

aws sns set-sms-attributes \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --attributes "{
    \"DeliveryStatusSuccessSamplingRate\": \"100\",
    \"DeliveryStatusFailureSamplingRate\": \"100\",
    \"DeliveryStatusIAMRole\": \"$ROLE_ARN\"
  }"

if [ $? -eq 0 ]; then
  echo "✅ SNS SMS delivery status logging configured successfully"
  echo ""
  echo "Delivery status logs will be written to: /aws/sns/staging/sms-delivery"
  echo ""
  echo "To view logs:"
  echo "  aws logs tail /aws/sns/staging/sms-delivery --profile $AWS_PROFILE --region $AWS_REGION --follow"
else
  echo "❌ Failed to configure SNS SMS delivery status logging"
  exit 1
fi

# Verify the configuration
echo ""
echo "Verifying configuration..."
aws sns get-sms-attributes \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'attributes' \
  --output json | jq '.'

echo ""
echo "✅ Configuration complete!"

