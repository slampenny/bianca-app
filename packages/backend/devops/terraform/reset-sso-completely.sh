#!/bin/bash
set -e

echo "=== Complete SSO Reset ==="
echo ""

echo "1. Clearing ALL SSO cache..."
rm -rf ~/.aws/sso/cache/*
echo "   ✓ Cache cleared"
echo ""

echo "2. Checking for credential_process or credential_source in config..."
if grep -q "credential_process\|credential_source" ~/.aws/config; then
    echo "   ⚠ Found credential_process or credential_source - this might interfere"
    grep "credential_process\|credential_source" ~/.aws/config
else
    echo "   ✓ No credential_process or credential_source found"
fi
echo ""

echo "3. Verifying profile jordan config..."
cat ~/.aws/config | grep -A 6 "\[profile jordan\]"
echo ""

echo "4. Logging into SSO (this will open browser)..."
aws sso login --profile jordan
echo ""

echo "5. Waiting 10 seconds for session to fully propagate..."
sleep 10
echo ""

echo "6. Testing with explicit profile..."
aws sts get-caller-identity --profile jordan 2>&1
echo ""

echo "7. Testing with AWS_PROFILE env var..."
export AWS_PROFILE=jordan
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SESSION_TOKEN
aws sts get-caller-identity 2>&1
echo ""

echo "8. If still failing, checking SSO cache contents..."
if [ -d ~/.aws/sso/cache ]; then
    echo "   Cache files:"
    ls -la ~/.aws/sso/cache/
    echo ""
    echo "   Latest cache file (first 500 chars):"
    ls -t ~/.aws/sso/cache/*.json 2>/dev/null | head -1 | xargs head -c 500 2>/dev/null || echo "   Could not read cache"
fi
