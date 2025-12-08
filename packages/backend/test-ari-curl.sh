#!/bin/bash

# Test ARI connectivity using curl
echo "=== Testing ARI Connectivity with curl ==="

# Get environment variables or use defaults
ARI_URL=${ASTERISK_URL:-"http://172.31.100.198:8088"}
USERNAME=${ASTERISK_USERNAME:-"myphonefriend"}
PASSWORD=${ASTERISK_PASSWORD:-"your-password-here"}

echo "ARI URL: $ARI_URL"
echo "Username: $USERNAME"
echo "Password configured: ${PASSWORD:0:3}***"
echo ""

# Test 1: Basic connectivity
echo "--- Testing basic connectivity ---"
if curl -s --connect-timeout 5 --max-time 10 "$ARI_URL" > /dev/null 2>&1; then
    echo "✅ Basic HTTP connectivity works"
else
    echo "❌ Basic HTTP connectivity failed"
    echo "   This suggests a network or firewall issue"
    exit 1
fi

# Test 2: ARI endpoint without auth
echo ""
echo "--- Testing ARI endpoint without authentication ---"
RESPONSE=$(curl -s -w "%{http_code}" --connect-timeout 5 --max-time 10 "$ARI_URL/ari/api-docs/resources.json")
HTTP_CODE="${RESPONSE: -3}"
if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ Authentication required (expected)"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "⚠️  No authentication required (security issue!)"
else
    echo "❌ Unexpected response: HTTP $HTTP_CODE"
fi

# Test 3: ARI endpoint with auth
echo ""
echo "--- Testing ARI endpoint with authentication ---"
RESPONSE=$(curl -s -w "%{http_code}" --connect-timeout 5 --max-time 10 \
    -H "Authorization: Basic $(echo -n "$USERNAME:$PASSWORD" | base64)" \
    "$ARI_URL/ari/api-docs/resources.json")
HTTP_CODE="${RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ ARI authentication successful"
    echo "   Response length: ${#RESPONSE} characters"
elif [ "$HTTP_CODE" = "401" ]; then
    echo "❌ Authentication failed - check username/password"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ ARI endpoint not found - check if ARI is enabled"
else
    echo "❌ Unexpected response: HTTP $HTTP_CODE"
fi

# Test 4: Try different endpoints
echo ""
echo "--- Testing different endpoints ---"
ENDPOINTS=(
    "/ari/asterisk/info"
    "/ari/applications"
    "/ari/endpoints"
    "/"
)

for endpoint in "${ENDPOINTS[@]}"; do
    RESPONSE=$(curl -s -w "%{http_code}" --connect-timeout 5 --max-time 10 \
        -H "Authorization: Basic $(echo -n "$USERNAME:$PASSWORD" | base64)" \
        "$ARI_URL$endpoint")
    HTTP_CODE="${RESPONSE: -3}"
    echo "$endpoint: HTTP $HTTP_CODE"
done

echo ""
echo "=== Test complete ===" 