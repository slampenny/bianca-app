#!/bin/bash
# Script to test the SMS route on staging
# Requires authentication token

STAGING_API="https://staging-api.myphonefriend.com"
ENDPOINT="/v1/test/send-sms-patient-0"

if [ -z "$1" ]; then
  echo "Usage: $0 <auth-token>"
  echo ""
  echo "To get an auth token:"
  echo "1. Login to staging frontend: https://staging.myphonefriend.com"
  echo "2. Open browser dev tools → Application → Local Storage"
  echo "3. Find 'auth' key and copy the access token"
  echo "4. Or use: curl -X POST $STAGING_API/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"your-email\",\"password\":\"your-password\"}'"
  exit 1
fi

TOKEN=$1

echo "🧪 Testing SMS route on staging..."
echo "Endpoint: $STAGING_API$ENDPOINT"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$STAGING_API$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SMS sent successfully!"
  echo "Check your phone (+16045624263) for the test message"
  echo ""
  echo "To check logs:"
  echo "aws logs tail /bianca/staging/app --profile jordan --region us-east-2 --since 1m --format short | grep -i sms"
else
  echo "❌ Request failed with status $HTTP_CODE"
  if [ "$HTTP_CODE" = "401" ]; then
    echo "Authentication failed - check your token"
  fi
fi

