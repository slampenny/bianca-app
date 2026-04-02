#!/bin/bash

# Test script for local OAuth token exchange endpoint
# This tests that the backend can properly load OAuth secrets and exchange codes

echo "Testing OAuth Configuration..."
echo ""

# Test 1: Check if backend has OAuth config loaded
echo "1. Testing OAuth config endpoint..."
curl -s http://localhost:3000/v1/sso/exchange-code \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "code": "test_code",
    "redirectUri": "http://localhost:8082"
  }' | jq '.'

echo ""
echo "Expected: Should return error about invalid code (means config is loaded)"
echo "If you see 'Google OAuth not configured' - OAuth secrets not loaded properly"
echo ""
echo "To test full flow:"
echo "1. Start backend: cd packages/backend && yarn dev"
echo "2. Start frontend: cd packages/mobile && yarn start"
echo "3. Go to http://localhost:8082 and try 'Sign in with Google'"
echo ""
