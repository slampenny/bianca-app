# SNS SMS Delivery Status Logging Setup

This document explains how to set up SNS SMS delivery status logging to CloudWatch.

## Prerequisites

- AWS CLI configured with appropriate permissions
- `iam:PassRole` permission for the SNS delivery status role
- Terraform resources created (or resources created manually)

## Setup Steps

### 1. Create CloudWatch Log Group

```bash
aws logs create-log-group \
  --profile jordan \
  --region us-east-2 \
  --log-group-name "/aws/sns/staging/sms-delivery"

aws logs put-retention-policy \
  --profile jordan \
  --region us-east-2 \
  --log-group-name "/aws/sns/staging/sms-delivery" \
  --retention-in-days 30
```

### 2. Create IAM Role for SNS

The IAM role is created via Terraform in `devops/terraform/staging.tf`. If you need to create it manually:

```bash
# Create assume role policy
cat > /tmp/assume-role-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "sns.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create the role
aws iam create-role \
  --profile jordan \
  --role-name "bianca-staging-sns-delivery-status-role" \
  --assume-role-policy-document file:///tmp/assume-role-policy.json

# Attach policy to allow CloudWatch logging
cat > /tmp/sns-delivery-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:PutMetricFilter",
      "logs:PutRetentionPolicy"
    ],
    "Resource": [
      "arn:aws:logs:us-east-2:730335291008:log-group:/aws/sns/staging/sms-delivery",
      "arn:aws:logs:us-east-2:730335291008:log-group:/aws/sns/staging/sms-delivery:*"
    ]
  }]
}
EOF

aws iam put-role-policy \
  --profile jordan \
  --role-name "bianca-staging-sns-delivery-status-role" \
  --policy-name "bianca-staging-sns-delivery-status-policy" \
  --policy-document file:///tmp/sns-delivery-policy.json
```

### 3. Configure SNS to Use the Role

**Note:** This step requires `iam:PassRole` permission. If you get an authorization error, you may need to:
- Use an AWS account root user, or
- Have an IAM administrator grant you `iam:PassRole` permission for this specific role

```bash
# Get the role ARN
ROLE_ARN=$(aws iam get-role \
  --profile jordan \
  --role-name "bianca-staging-sns-delivery-status-role" \
  --query 'Role.Arn' \
  --output text)

# Configure SNS SMS attributes
aws sns set-sms-attributes \
  --profile jordan \
  --region us-east-2 \
  --attributes \
    DeliveryStatusSuccessSamplingRate=100,\
    DeliveryStatusFailureSamplingRate=100,\
    DeliveryStatusIAMRole=$ROLE_ARN

# Verify configuration
aws sns get-sms-attributes \
  --profile jordan \
  --region us-east-2 \
  --query 'attributes' \
  --output json | jq '.'
```

### 4. View Delivery Status Logs

Once configured, delivery status logs will be written to CloudWatch:

```bash
# View recent logs
aws logs tail /aws/sns/staging/sms-delivery \
  --profile jordan \
  --region us-east-2 \
  --since 1h

# Follow logs in real-time
aws logs tail /aws/sns/staging/sms-delivery \
  --profile jordan \
  --region us-east-2 \
  --follow
```

## Log Format

The delivery status logs will contain JSON entries with information about:
- Message delivery status (success/failure)
- Phone number (may be masked)
- Delivery timestamp
- Error codes (if delivery failed)
- Carrier information

## Troubleshooting

### Authorization Error

If you get an `AuthorizationError` when setting SMS attributes:
1. Ensure you have `iam:PassRole` permission for the role
2. Try using AWS account root credentials
3. Contact your AWS administrator to grant the permission

### No Logs Appearing

1. Verify the IAM role has the correct CloudWatch permissions
2. Check that SNS attributes are configured correctly
3. Send a test SMS and wait a few minutes for logs to appear
4. Check CloudWatch log group exists: `/aws/sns/staging/sms-delivery`

## Automated Setup Script

A script is available at `devops/scripts/configure-sns-delivery-logging.sh` that automates steps 1-3 above. Run it after Terraform has created the IAM role:

```bash
cd devops/scripts
./configure-sns-delivery-logging.sh
```

