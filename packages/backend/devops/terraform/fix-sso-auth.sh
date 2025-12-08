#!/bin/bash
set -e

echo "=== Fixing AWS SSO Authentication ==="
echo ""

echo "1. Clearing SSO cache..."
rm -rf ~/.aws/sso/cache/*
echo "   ✓ Cache cleared"
echo ""

echo "2. Logging into SSO with profile jordan..."
echo "   (This will open a browser)"
aws sso login --profile jordan
echo ""

echo "3. Waiting 5 seconds for credentials to propagate..."
sleep 5
echo ""

echo "4. Testing identity..."
aws sts get-caller-identity --profile jordan
echo ""

echo "5. Verifying account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --profile jordan --query Account --output text)
echo "   Account ID: $ACCOUNT_ID"

if [ "$ACCOUNT_ID" = "730335291008" ]; then
    echo "   ✓ SUCCESS! You're authenticated to the correct account"
else
    echo "   ✗ WARNING: Account ID is $ACCOUNT_ID, expected 730335291008"
    echo ""
    echo "   If this is still wrong, check:"
    echo "   - The role 'bianca-admin' exists in account 730335291008"
    echo "   - You have permission to assume that role"
    echo "   - The SSO endpoint is correct for this account"
fi
