#!/bin/bash
set -e

echo "=== Attempting to List SSO Accounts and Roles ==="
echo ""

# Get the SSO start URL and region from config
SSO_START_URL=$(grep -A 5 "\[profile jordan\]" ~/.aws/config | grep "sso_start_url" | awk '{print $3}')
SSO_REGION=$(grep -A 5 "\[profile jordan\]" ~/.aws/config | grep "sso_region" | awk '{print $3}')

echo "SSO Start URL: $SSO_START_URL"
echo "SSO Region: $SSO_REGION"
echo ""

echo "Attempting to list accounts..."
echo "(This may fail if you don't have permission)"
echo ""

# Try to list accounts - this requires the SSO session to be active
aws sso list-accounts \
    --access-token "$(aws configure get sso_access_token --profile jordan 2>/dev/null || echo '')" \
    --profile jordan 2>&1 || {
    echo ""
    echo "Could not list accounts via CLI. You'll need to check the AWS Console:"
    echo ""
    echo "1. Go to: https://console.aws.amazon.com/singlesignon/"
    echo "2. Click 'AWS accounts' in the left sidebar"
    echo "3. Find account 730335291008"
    echo "4. Click on it to see available roles"
    echo ""
    echo "Or try accessing the SSO portal directly:"
    echo "$SSO_START_URL"
    echo ""
}
