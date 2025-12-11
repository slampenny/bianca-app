#!/bin/bash
set -e

echo "=== Testing SSO with Verbose Output ==="
echo ""

echo "1. Setting AWS_PROFILE and clearing any static credentials..."
export AWS_PROFILE=jordan
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY  
unset AWS_SESSION_TOKEN
echo "   ✓ Environment set"
echo ""

echo "2. Testing with debug output..."
AWS_SDK_LOAD_CONFIG=1 aws sts get-caller-identity --profile jordan --debug 2>&1 | grep -i "error\|exception\|forbidden\|access\|role\|account" | head -20 || echo "No relevant errors found in debug output"
echo ""

echo "3. Trying to get role credentials directly..."
# The SSO flow: login -> get access token -> get role credentials
echo "   Checking if we can access the SSO token..."
echo ""

echo "4. Alternative: Try with explicit region..."
aws sts get-caller-identity --profile jordan --region us-east-2 2>&1
echo ""

echo "5. Check if there's a session file..."
if [ -f ~/.aws/cli/cache/*.json ]; then
    echo "   Found CLI cache files:"
    ls -la ~/.aws/cli/cache/ 2>/dev/null || echo "   No CLI cache"
else
    echo "   No CLI cache files found"
fi
