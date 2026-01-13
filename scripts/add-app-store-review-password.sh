#!/bin/bash
# Script to add APP_STORE_REVIEW_PASSWORD to AWS Secrets Manager
# Usage: ./scripts/add-app-store-review-password.sh [password]
# If password is not provided, will prompt for it

set -e

REGION="us-east-2"
STAGING_SECRET="MySecretsManagerSecret-Staging"
PRODUCTION_SECRET="MySecretsManagerSecret"

# Get password from argument or prompt
if [ -z "$1" ]; then
    echo "Enter the App Store Review password:"
    read -s PASSWORD
    echo ""
    if [ -z "$PASSWORD" ]; then
        echo "Error: Password cannot be empty"
        exit 1
    fi
else
    PASSWORD="$1"
fi

echo "Adding APP_STORE_REVIEW_PASSWORD to AWS Secrets Manager..."
echo ""

# Function to update a secret
update_secret() {
    local SECRET_NAME=$1
    local ENV_NAME=$2
    
    echo "Updating $ENV_NAME secret: $SECRET_NAME"
    
    # Get current secret value
    CURRENT_SECRET=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$REGION" \
        --query SecretString \
        --output text 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to get current secret value for $SECRET_NAME"
        echo "$CURRENT_SECRET"
        return 1
    fi
    
    # Parse JSON and add/update APP_STORE_REVIEW_PASSWORD
    # Use jq if available, otherwise use Python
    if command -v jq &> /dev/null; then
        UPDATED_SECRET=$(echo "$CURRENT_SECRET" | jq --arg pwd "$PASSWORD" '. + {APP_STORE_REVIEW_PASSWORD: $pwd}')
    elif command -v python3 &> /dev/null; then
        UPDATED_SECRET=$(echo "$CURRENT_SECRET" | python3 -c "
import json
import sys
secret = json.load(sys.stdin)
secret['APP_STORE_REVIEW_PASSWORD'] = sys.argv[1]
print(json.dumps(secret, separators=(',', ':')))
" "$PASSWORD")
    else
        echo "Error: Neither jq nor python3 is available. Please install one of them."
        return 1
    fi
    
    # Update the secret
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --region "$REGION" \
        --secret-string "$UPDATED_SECRET" \
        --output text > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully updated $ENV_NAME secret"
    else
        echo "❌ Failed to update $ENV_NAME secret"
        return 1
    fi
}

# Update staging secret
update_secret "$STAGING_SECRET" "Staging"

echo ""

# Update production secret
update_secret "$PRODUCTION_SECRET" "Production"

echo ""
echo "✅ Done! APP_STORE_REVIEW_PASSWORD has been added to both secrets."
echo ""
echo "Note: The password will be available after the next deployment that includes"
echo "      the code changes to read from Secrets Manager."
