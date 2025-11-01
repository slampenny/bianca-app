#!/usr/bin/env bash
# Send SMTP credentials via email using SES API (which works reliably)
# Usage: ./send-smtp-credentials.sh <localpart> <forward-email>
# Example: ./send-smtp-credentials.sh vthaker virenthaker@gmail.com

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <localpart> <forward-email>"
  echo "Example: $0 vthaker virenthaker@gmail.com"
  exit 1
fi

LOCALPART="$1"
FORWARD_EMAIL="$2"
EMAIL="${LOCALPART}@biancatechnologies.com"
AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-us-east-2}"
SECRET_NAME="ses/smtp/${LOCALPART}"

echo "Fetching SMTP credentials from Secrets Manager..."
SMTP_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Error: Could not fetch credentials from Secrets Manager"
  echo "   Run: ./scripts/corp-email.sh create-smtp $EMAIL"
  exit 1
fi

SERVER=$(echo "$SMTP_JSON" | jq -r .server)
PORT=$(echo "$SMTP_JSON" | jq -r .port)
USERNAME=$(echo "$SMTP_JSON" | jq -r .username)
PASSWORD=$(echo "$SMTP_JSON" | jq -r .password)

echo ""
echo "=========================================="
echo "SMTP Credentials for $EMAIL"
echo "=========================================="
echo "Server: $SERVER"
echo "Port:   $PORT"
echo "User:   $USERNAME"
echo "Pass:   $PASSWORD"
echo "=========================================="
echo ""

# Compose email
SUBJECT="Your biancatechnologies.com SMTP credentials"
BODY=$(cat <<TXT
Hi,

Your biancatechnologies.com email address has been set up:
  Address: ${EMAIL}
  Forwards to: ${FORWARD_EMAIL}

Gmail "Send mail as" setup:
  1) Gmail → Settings → Accounts and Import → Send mail as → Add another email address
  2) Email: ${EMAIL}; Uncheck "Treat as an alias"
  3) SMTP server: ${SERVER}
     Port: ${PORT} (TLS)
     Username: ${USERNAME}
     Password: ${PASSWORD}
  4) Verify using the code sent to ${EMAIL} (it will arrive in your inbox via forwarding)
  5) In Accounts and Import, set "Reply from the same address the message was sent to"

Notes:
  - This account uses AWS SES; SPF/DKIM/DMARC are configured.
  - Keep these credentials secure. You can rotate them anytime.

Thanks,
Bianca Admin
TXT
)

# Check if SES is in production
PROD=$(aws sesv2 get-account \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query ProductionAccessEnabled \
  --output text 2>/dev/null || echo "False")

if [[ "$PROD" == "True" ]]; then
  echo "Sending credentials email to ${FORWARD_EMAIL}..."
  
  # Build message JSON
  MSG_JSON=$(printf "%s" "$BODY" | jq -Rs --arg s "$SUBJECT" '{
    Subject: {Data: $s, Charset: "UTF-8"},
    Body: {Text: {Data: ., Charset: "UTF-8"}}
  }')
  
  # Send via SES API (which works!)
  RESULT=$(aws ses send-email \
    --from "$EMAIL" \
    --destination "ToAddresses=${FORWARD_EMAIL}" \
    --message "$MSG_JSON" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --output json 2>&1)
  
  if [ $? -eq 0 ]; then
    MESSAGE_ID=$(echo "$RESULT" | jq -r '.MessageId')
    echo "✓ Email sent successfully!"
    echo "  Message ID: $MESSAGE_ID"
    echo "  Check ${FORWARD_EMAIL} inbox"
  else
    echo "✗ Failed to send email: $RESULT"
    echo ""
    echo "Credentials are displayed above - send them manually if needed"
  fi
else
  echo "⚠️  SES is in sandbox mode"
  echo "   Credentials are displayed above - send them manually"
  echo ""
  echo "To send via email, either:"
  echo "  1. Request production access in SES console"
  echo "  2. Verify ${FORWARD_EMAIL} as a recipient first"
fi

