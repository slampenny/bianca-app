#!/bin/bash
# Script to run all retry-related unit tests

echo "Running retry functionality unit tests..."
echo ""

# Set test environment
export NODE_ENV=test
export NODE_NO_IOURING=1

# Run tests one by one
echo "1. Testing Org Model Retry Settings..."
yarn test tests/unit/models/org.retry.test.js --no-coverage

echo ""
echo "2. Testing Conversation Model Retry Fields..."
yarn test tests/unit/models/conversation.retry.test.js --no-coverage

echo ""
echo "3. Testing Org Service Retry Settings..."
yarn test tests/unit/services/org.service.retry.test.js --no-coverage

echo ""
echo "4. Testing Twilio Call Service Retry Functionality..."
yarn test tests/unit/services/twilioCall.service.retry.test.js --no-coverage

echo ""
echo "5. Testing Agenda Retry Job..."
yarn test tests/unit/config/agenda.retry.test.js --no-coverage

echo ""
echo "All retry tests completed!"



