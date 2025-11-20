#!/bin/bash
# Debug SMS delivery issues

echo "🔍 SMS Delivery Debugging"
echo "========================"
echo ""

# Check if phone number provided
if [ -z "$1" ]; then
  echo "Usage: $0 <phone-number>"
  echo "Example: $0 +1234567890"
  exit 1
fi

PHONE=$1
PROFILE=${2:-jordan}
REGION=${3:-us-east-2}

echo "📱 Testing SMS to: $PHONE"
echo ""

# Test 1: Check SMS attributes
echo "1️⃣ Checking SMS account settings..."
aws sns get-sms-attributes \
  --profile $PROFILE \
  --region $REGION \
  --query 'attributes.{DefaultSMSType:DefaultSMSType,MonthlySpendLimit:MonthlySpendLimit}' \
  --output json

echo ""
echo "2️⃣ Checking if phone number has opted out..."
OPTED_OUT=$(aws sns list-phone-numbers-opted-out \
  --profile $PROFILE \
  --region $REGION \
  --output json | jq -r ".phoneNumbers[] | select(. == \"$PHONE\")")

if [ -z "$OPTED_OUT" ]; then
  echo "   ✅ Phone number has NOT opted out"
else
  echo "   ❌ Phone number HAS opted out!"
fi

echo ""
echo "3️⃣ Sending test SMS directly via AWS CLI..."
RESULT=$(aws sns publish \
  --phone-number "$PHONE" \
  --message "Test SMS from AWS CLI - If you receive this, SMS delivery is working. Timestamp: $(date)" \
  --profile $PROFILE \
  --region $REGION \
  --output json 2>&1)

if [ $? -eq 0 ]; then
  MESSAGE_ID=$(echo $RESULT | jq -r '.MessageId')
  echo "   ✅ SMS sent successfully!"
  echo "   Message ID: $MESSAGE_ID"
  echo ""
  echo "💡 If you still don't receive the message:"
  echo "   1. Check your phone's spam/blocked messages"
  echo "   2. Verify the phone number is correct: $PHONE"
  echo "   3. Check if your carrier blocks short codes or unknown numbers"
  echo "   4. Try from a different phone number"
  echo "   5. Check CloudWatch SNS metrics for delivery failures"
else
  echo "   ❌ Failed to send SMS:"
  echo "$RESULT"
fi

echo ""
echo "4️⃣ Checking recent SMS spending..."
aws cloudwatch get-metric-statistics \
  --namespace AWS/SNS \
  --metric-name SMSMonthToDateSpentUSD \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Maximum \
  --profile $PROFILE \
  --region $REGION \
  --output json | jq -r '.Datapoints[0].Maximum // 0' | xargs printf "   Current month spending: $%.2f\n"

