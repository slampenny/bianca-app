#!/bin/bash
set -e

echo "=== Checking Available SSO Roles ==="
echo ""

echo "1. Getting SSO access token..."
# First, we need to get an access token from the SSO cache
TOKEN_FILE=$(ls -t ~/.aws/sso/cache/*.json 2>/dev/null | head -1)

if [ -z "$TOKEN_FILE" ]; then
    echo "   ✗ No SSO token found. Please run: aws sso login --profile jordan"
    exit 1
fi

echo "   ✓ Found token file: $TOKEN_FILE"
echo ""

echo "2. Attempting to list accounts (this may fail if permissions are insufficient)..."
echo "   Note: This requires the SSO access token to be valid"
echo ""

# Try to use the AWS CLI to list accounts
# But first, let's check what's in the config
echo "3. Current profile configuration:"
cat ~/.aws/config | grep -A 5 "\[profile jordan\]"
echo ""

echo "4. To check available roles, you need to:"
echo "   a) Go to AWS Console → IAM Identity Center"
echo "   b) Click 'AWS accounts' in the left sidebar"
echo "   c) Find account 730335291008"
echo "   d) Click on it to see available roles"
echo "   e) The role name should match 'sso_role_name' in your config"
echo ""

echo "5. Common role names to check:"
echo "   - AdministratorAccess"
echo "   - PowerUserAccess"
echo "   - ReadOnlyAccess"
echo "   - bianca-admin (current)"
echo "   - Admin"
echo ""
