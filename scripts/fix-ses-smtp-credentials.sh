#!/usr/bin/env bash
# Fix existing SES SMTP credentials with correct password derivation algorithm
# Usage: ./fix-ses-smtp-credentials.sh <localpart>
# Example: ./fix-ses-smtp-credentials.sh jlapp

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <localpart>"
  echo "Example: $0 jlapp"
  exit 1
fi

LOCALPART="$1"
EMAIL="${LOCALPART}@biancatechnologies.com"
IAM_USER="ses-smtp-${LOCALPART}"
AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-us-east-2}"
SECRET_NAME="ses/smtp/${LOCALPART}"

echo "=========================================="
echo "Fixing SES SMTP Credentials"
echo "=========================================="
echo "Email: $EMAIL"
echo "IAM User: $IAM_USER"
echo "Secret: $SECRET_NAME"
echo ""

# Check if IAM user exists
if ! aws iam get-user --user-name "$IAM_USER" --profile "$AWS_PROFILE" >/dev/null 2>&1; then
  echo "❌ IAM user $IAM_USER does not exist"
  echo "   Run: ./scripts/corp-email.sh create-smtp $EMAIL"
  exit 1
fi

# Get current access key
echo "1. Getting current access key..."
ACCESS_KEYS=$(aws iam list-access-keys --user-name "$IAM_USER" --profile "$AWS_PROFILE" --output json)
KEY_COUNT=$(echo "$ACCESS_KEYS" | jq '.AccessKeyMetadata | length')

if [ "$KEY_COUNT" -eq 0 ]; then
  echo "❌ No access keys found for $IAM_USER"
  echo "   Creating new access key..."
  aws iam create-access-key --user-name "$IAM_USER" --profile "$AWS_PROFILE" \
    --query '{AccessKeyId:AccessKey.AccessKeyId,SecretAccessKey:AccessKey.SecretAccessKey}' \
    --output json > /tmp/ak.json
else
  # Use the most recent access key
  ACCESS_KEY_ID=$(echo "$ACCESS_KEYS" | jq -r '.AccessKeyMetadata | sort_by(.CreateDate) | .[-1].AccessKeyId')
  echo "   Using access key: $ACCESS_KEY_ID"
  
  # We need the secret - but IAM doesn't store it. We need to create a new key or use existing secret
  echo "   ⚠️  Cannot retrieve secret from existing key. Creating new access key..."
  
  # Delete oldest if we have 2 keys
  if [ "$KEY_COUNT" -ge 2 ]; then
    OLDEST=$(echo "$ACCESS_KEYS" | jq -r '.AccessKeyMetadata | sort_by(.CreateDate) | .[0].AccessKeyId')
    echo "   Deleting oldest key: $OLDEST"
    aws iam delete-access-key --user-name "$IAM_USER" --access-key-id "$OLDEST" --profile "$AWS_PROFILE" >/dev/null
  fi
  
  # Create new access key
  aws iam create-access-key --user-name "$IAM_USER" --profile "$AWS_PROFILE" \
    --query '{AccessKeyId:AccessKey.AccessKeyId,SecretAccessKey:AccessKey.SecretAccessKey}' \
    --output json > /tmp/ak.json
fi

# Derive SMTP password using CORRECT algorithm
echo ""
echo "2. Deriving SMTP password (using correct AWS SES algorithm)..."
SMTP_JSON=$(python3 <<PYTHON
import json, sys, hmac, hashlib, base64

# Read access key from file
with open('/tmp/ak.json') as f:
    data = json.load(f)

region = "${AWS_REGION}"

# AWS SES SMTP Constants - DO NOT CHANGE
DATE = "11111111"  # Fixed date for SMTP (not actual date!)
SERVICE = "ses"
MESSAGE = "SendRawEmail"
VERSION = 0x04

sk = data['SecretAccessKey']

# Step 1: Create signing key using HMAC-SHA256 chain
k_secret = ("AWS4" + sk).encode('utf-8')
k_date = hmac.new(k_secret, DATE.encode('utf-8'), hashlib.sha256).digest()
k_region = hmac.new(k_date, region.encode('utf-8'), hashlib.sha256).digest()
k_service = hmac.new(k_region, SERVICE.encode('utf-8'), hashlib.sha256).digest()
k_signing = hmac.new(k_service, "aws4_request".encode('utf-8'), hashlib.sha256).digest()

# Step 2: Sign the message "SendRawEmail"
signature = hmac.new(k_signing, MESSAGE.encode('utf-8'), hashlib.sha256).digest()

# Step 3: Prepend version byte (0x04) and base64 encode
signature_and_version = bytes([VERSION]) + signature
smtp_password = base64.b64encode(signature_and_version).decode('utf-8')

result = {
    'SMTPUsername': data['AccessKeyId'],
    'SMTPPassword': smtp_password
}
print(json.dumps(result))
PYTHON
)

SMTP_USER=$(echo "$SMTP_JSON" | jq -r .SMTPUsername)
SMTP_PASS=$(echo "$SMTP_JSON" | jq -r .SMTPPassword)

echo "   ✓ Username: $SMTP_USER"
echo "   ✓ Password: ${SMTP_PASS:0:20}..."

# Test SMTP connection
echo ""
echo "3. Testing SMTP authentication..."
python3 <<PYTHON
import smtplib
import sys

server = "email-smtp.${AWS_REGION}.amazonaws.com"
port = 587
username = "${SMTP_USER}"
password = "${SMTP_PASS}"

try:
    print(f"   Connecting to {server}:{port}...")
    smtp = smtplib.SMTP(server, port, timeout=10)
    smtp.set_debuglevel(0)
    
    print("   Starting TLS...")
    smtp.starttls()
    
    print("   Authenticating...")
    smtp.login(username, password)
    print("   ✓ SMTP authentication successful!")
    
    smtp.quit()
    sys.exit(0)
except smtplib.SMTPAuthenticationError as e:
    print(f"   ✗ Authentication failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"   ✗ Error: {e}")
    sys.exit(1)
PYTHON

TEST_RESULT=$?

if [ $TEST_RESULT -ne 0 ]; then
  echo ""
  echo "❌ SMTP authentication test failed!"
  echo "   This might indicate IAM permission issues."
  exit 1
fi

# Update Secrets Manager
echo ""
echo "4. Updating Secrets Manager..."
SMTP_CONFIG=$(jq -n \
  --arg server "email-smtp.${AWS_REGION}.amazonaws.com" \
  --arg port "587" \
  --arg username "$SMTP_USER" \
  --arg password "$SMTP_PASS" \
  '{server: $server, port: ($port | tonumber), username: $username, password: $password}')

if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws secretsmanager update-secret \
    --secret-id "$SECRET_NAME" \
    --secret-string "$SMTP_CONFIG" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    >/dev/null
  echo "   ✓ Secret updated"
else
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --secret-string "$SMTP_CONFIG" \
    --description "SES SMTP credentials for $EMAIL (fixed with correct algorithm)" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    >/dev/null
  echo "   ✓ Secret created"
fi

# Display summary
echo ""
echo "=========================================="
echo "✓ SUCCESS! Credentials Fixed"
echo "=========================================="
echo ""
echo "Gmail Configuration:"
echo "  SMTP Server: email-smtp.${AWS_REGION}.amazonaws.com"
echo "  Port: 587"
echo "  Encryption: TLS"
echo "  Username: ${SMTP_USER}"
echo "  Password: ${SMTP_PASS}"
echo ""
echo "Next Steps:"
echo "1. Go to Gmail → Settings → Accounts and Import"
echo "2. Click 'Add another email address'"
echo "3. Enter: $EMAIL"
echo "4. Use SMTP settings above"
echo "5. Select 'Secured connection using TLS'"
echo "6. Verify via email (will arrive via your forwarding setup)"
echo ""
echo "Test the connection:"
echo "  ./scripts/test-smtp-connection.sh $EMAIL"

