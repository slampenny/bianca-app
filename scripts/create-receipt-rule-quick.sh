#!/usr/bin/env bash
# Quick script to create a receipt rule without hanging
# Usage: ./create-receipt-rule-quick.sh <email@biancatechnologies.com>

set -euo pipefail

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
  echo "Usage: $0 <email@biancatechnologies.com>"
  exit 1
fi

AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-us-east-2}"
RULE_SET="myphonefriend-email-forwarding"
S3_BUCKET="bianca-corp-email-storage-730335291008"
LAMBDA_NAME="myphonefriend-email-forwarder"
ACCOUNT_ID="730335291008"

localpart() {
  echo "$EMAIL" | awk -F'@' '{print tolower($1)}'
}

LP=$(localpart "$EMAIL")

# Check if rule exists
if aws ses describe-receipt-rule-set \
  --rule-set-name "$RULE_SET" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --output json 2>/dev/null | jq -e --arg email "$EMAIL" '.Rules[] | select(.Recipients[]? == $email)' >/dev/null 2>&1; then
  echo "✓ Rule already exists for $EMAIL"
  exit 0
fi

# Create rule payload
RULE_NAME="corp-${LP}"
RULE_JSON=$(jq -c -n \
  --arg name "$RULE_NAME" \
  --arg email "$EMAIL" \
  --arg bucket "$S3_BUCKET" \
  --arg prefix "corp/${LP}/" \
  --arg fn "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}" \
  '{
    Name: $name,
    Enabled: true,
    TlsPolicy: "Optional",
    Recipients: [$email],
    Actions: [
      {S3Action: {BucketName: $bucket, ObjectKeyPrefix: $prefix}},
      {LambdaAction: {FunctionArn: $fn, InvocationType: "Event"}}
    ]
  }')

echo "Creating receipt rule for $EMAIL..."
echo "Rule name: $RULE_NAME"

# Use --cli-read-timeout and --cli-connect-timeout to prevent hanging
aws ses create-receipt-rule \
  --rule-set-name "$RULE_SET" \
  --rule "$RULE_JSON" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --cli-read-timeout 10 \
  --cli-connect-timeout 5 \
  2>&1 | head -20

# Verify
sleep 2
if aws ses describe-receipt-rule-set \
  --rule-set-name "$RULE_SET" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --output json 2>/dev/null | jq -e --arg email "$EMAIL" '.Rules[] | select(.Recipients[]? == $email)' >/dev/null 2>&1; then
  echo "✓ Rule created successfully"
else
  echo "⚠ Rule may not have been created. Check manually:"
  echo "aws ses describe-receipt-rule-set --rule-set-name $RULE_SET --profile $AWS_PROFILE --region $AWS_REGION"
fi

