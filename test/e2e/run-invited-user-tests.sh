#!/bin/bash

# Run Invited User Authentication Workflow Tests
# This script runs the comprehensive test suite for invited user authentication issues

set -e

echo "🧪 Running Invited User Authentication Workflow Tests"
echo "=================================================="

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the frontend directory."
    exit 1
fi

echo "📋 Available test options:"
echo "1. Run all invited user tests"
echo "2. Run authentication workflow tests only"
echo "3. Run logout issue tests only"
echo "4. Run token expiration tests only"
echo "5. Run specific test with debug mode"
echo "6. Run tests in headed mode (visual)"
echo ""

read -p "Select option (1-6): " choice

case $choice in
    1)
        echo "🚀 Running all invited user tests..."
        npx playwright test invited-user --reporter=list
        ;;
    2)
        echo "🚀 Running authentication workflow tests..."
        npx playwright test invited-user-auth-workflow --reporter=list
        ;;
    3)
        echo "🚀 Running logout issue tests..."
        npx playwright test invited-user-logout-issues --reporter=list
        ;;
    4)
        echo "🚀 Running token expiration tests..."
        npx playwright test token-expiration-navigation --reporter=list
        ;;
    5)
        echo "🚀 Running tests with debug mode..."
        read -p "Enter test name pattern (or press Enter for all): " test_pattern
        if [ -z "$test_pattern" ]; then
            npx playwright test invited-user --debug
        else
            npx playwright test invited-user --grep="$test_pattern" --debug
        fi
        ;;
    6)
        echo "🚀 Running tests in headed mode..."
        npx playwright test invited-user --headed --reporter=list
        ;;
    *)
        echo "❌ Invalid option. Please run the script again and select 1-6."
        exit 1
        ;;
esac

echo ""
echo "✅ Tests completed!"
echo ""
echo "📊 Test Summary:"
echo "- Authentication workflow tests: Verify invited user signup and login flow"
echo "- Logout issue tests: Check logout button functionality with various token states"
echo "- Token expiration tests: Verify behavior when tokens expire during navigation"
echo ""
echo "🔍 For more detailed output, run with --reporter=html"
echo "🐛 For debugging, run with --debug flag"
echo "👁️  For visual debugging, run with --headed flag"
