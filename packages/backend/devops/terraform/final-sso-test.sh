#!/bin/bash
set -e

echo "=== Final SSO Test ==="
echo ""

echo "1. Verifying config..."
cat ~/.aws/config | grep -A 6 "\[profile jordan\]"
echo ""

echo "2. Clearing SSO cache..."
rm -rf ~/.aws/sso/cache/*
echo "   ✓ Cache cleared"
echo ""

echo "3. Logging into SSO with updated role name..."
aws sso login --profile jordan
echo ""

echo "4. Waiting 5 seconds for credentials to propagate..."
sleep 5
echo ""

echo "5. Testing identity..."
aws sts get-caller-identity --profile jordan
echo ""

echo "6. Verifying account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --profile jordan --query Account --output text 2>/dev/null || echo "FAILED")
echo "   Account ID: $ACCOUNT_ID"

if [ "$ACCOUNT_ID" = "730335291008" ]; then
    echo ""
    echo "   ✓✓✓ SUCCESS! You're authenticated to the correct account! ✓✓✓"
    echo ""
    echo "   You can now run:"
    echo "   cd /home/jordanlapp/code/bianca-app/packages/backend/devops/terraform"
    echo "   terraform init"
    echo "   terraform plan"
else
    echo ""
    echo "   ✗ Still having issues. Account ID is: $ACCOUNT_ID"
fi
