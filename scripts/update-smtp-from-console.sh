#!/usr/bin/env bash
# Script to update Secrets Manager with SMTP credentials from AWS Console
# Usage: ./update-smtp-from-console.sh <localpart> <access-key-id> <smtp-password>
# Example: ./update-smtp-from-console.sh jlapp AKIA2UC3AE2ABCDEFG "ABC123xyz..."

set -euo pipefail

if [ $# -ne 3 ]; then
  echo "Usage: $0 <localpart> <access-key-id> <smtp-password>"
  echo "Example: $0 jlapp AKIA2UC3AE2ABCDEFG \"ABC123xyz...\""
  echo ""
  echo "Get these from AWS Console:"
  echo "1. Go to: https://console.aws.amazon.com/ses/home?region=us-east-2#/smtp"
  echo "2. Create SMTP credentials for IAM user: ses-smtp-<localpart>"
  echo "3. Copy the Username (Access Key ID) and Password shown"
  exit 1
fi

LOCALPART="$1"
ACCESS_KEY_ID="$2"
SMTP_PASSWORD="$3"
AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-us-east-2}"

SECRET_NAME="ses/smtp/${LOCALPART}"

echo "Updating SMTP credentials for ${LOCALPART}@biancatechnologies.com..."
echo "Access Key ID: ${ACCESS_KEY_ID}"
echo "Secret: ${SECRET_NAME}"
echo ""

# Create the secret JSON
SMTP_JSON=$(jq -n \
  --arg server "email-smtp.${AWS_REGION}.amazonaws.com" \
  --arg port "587" \
  --arg username "$ACCESS_KEY_ID" \
  --arg password "$SMTP_PASSWORD" \
  '{server: $server, port: ($port | tonumber), username: $username, password: $password}')

# Update or create the secret
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Updating existing secret..."
  aws secretsmanager update-secret \
    --secret-id "$SECRET_NAME" \
    --secret-string "$SMTP_JSON" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    >/dev/null
else
  echo "Creating new secret..."
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --secret-string "$SMTP_JSON" \
    --description "SES SMTP credentials for ${LOCALPART}@biancatechnologies.com (generated via AWS Console)" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    >/dev/null
fi

echo "✓ Credentials stored successfully!"
echo ""
echo "Test the connection:"
echo "  ./scripts/test-smtp-connection.sh ${LOCALPART}@biancatechnologies.com"

