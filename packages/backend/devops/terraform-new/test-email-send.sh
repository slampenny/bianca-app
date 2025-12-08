#!/bin/bash
# Script to send a test email via SES to test the forwarding system
# Usage: ./test-email-send.sh [from-email] [to-email]

set -e

FROM_EMAIL=${1:-"negascout@gmail.com"}
TO_EMAIL=${2:-"jlapp@biancatechnologies.com"}

echo "=== Sending Test Email via SES ==="
echo "From: $FROM_EMAIL"
echo "To: $TO_EMAIL"
echo ""

# Check if sender email is verified (required in sandbox mode)
echo "Checking if sender email is verified..."
VERIFIED=$(aws ses get-identity-verification-attributes \
  --identities "$FROM_EMAIL" \
  --query "VerificationAttributes.\"$FROM_EMAIL\".VerificationStatus" \
  --output text 2>/dev/null || echo "NotVerified")

if [ "$VERIFIED" != "Success" ]; then
  echo "⚠️  Sender email not verified. Verifying now..."
  aws ses verify-email-identity --email-address "$FROM_EMAIL"
  echo "✅ Verification email sent to $FROM_EMAIL"
  echo "   Please check your email and click the verification link before sending."
  echo "   Then run this script again."
  exit 0
fi

# Create the email
EMAIL_FILE=$(mktemp)
cat > "$EMAIL_FILE" << EOF
From: $FROM_EMAIL
To: $TO_EMAIL
Subject: Test Email - Email Forwarding System
Date: $(date -R)
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

This is a test email to verify the corporate email forwarding system.

Sent at: $(date)
From: $FROM_EMAIL
To: $TO_EMAIL

If you receive this at the forwarded address, the system is working! ✅
EOF

# Send via SES
echo "Sending email via SES..."
MESSAGE_ID=$(aws ses send-raw-email \
  --raw-message "Data=$(base64 -w 0 < "$EMAIL_FILE")" \
  --from "$FROM_EMAIL" \
  --destinations "$TO_EMAIL" \
  --query 'MessageId' \
  --output text 2>&1)

if [ $? -eq 0 ]; then
  echo "✅ Email sent successfully!"
  echo "   Message ID: $MESSAGE_ID"
  echo ""
  echo "Monitor Lambda logs:"
  echo "  aws logs tail /aws/lambda/bianca-corp-email-forwarder --follow"
  echo ""
  echo "Check destination inbox in a few minutes."
else
  echo "❌ Failed to send email"
  echo "   Error: $MESSAGE_ID"
fi

rm "$EMAIL_FILE"





