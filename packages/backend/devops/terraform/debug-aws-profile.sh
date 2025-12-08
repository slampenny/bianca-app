#!/bin/bash
set -e

echo "=== AWS Profile Debug ==="
echo ""

echo "1. Environment Variables:"
env | grep -i aws | sort
echo ""

echo "2. Current AWS Identity (with profile jordan):"
aws sts get-caller-identity --profile jordan 2>&1 || echo "ERROR: Failed to get identity"
echo ""

echo "3. Current AWS Identity (using AWS_PROFILE env):"
export AWS_PROFILE=jordan
aws sts get-caller-identity 2>&1 || echo "ERROR: Failed to get identity"
echo ""

echo "4. Checking for credentials file:"
if [ -f ~/.aws/credentials ]; then
    echo "Found ~/.aws/credentials:"
    cat ~/.aws/credentials | grep -E "^\[|aws_access_key_id|aws_secret_access_key" | head -20
else
    echo "No ~/.aws/credentials file found"
fi
echo ""

echo "5. SSO Cache files:"
if [ -d ~/.aws/sso/cache ]; then
    echo "SSO cache directory exists:"
    ls -la ~/.aws/sso/cache/ | head -10
else
    echo "No SSO cache directory found"
fi
echo ""

echo "6. AWS Config for profile jordan:"
cat ~/.aws/config | grep -A 10 "\[profile jordan\]" || echo "Profile jordan not found in config"
echo ""

echo "7. Testing SSO login:"
echo "Running: aws sso login --profile jordan"
echo "(This will open a browser if needed)"
echo ""
