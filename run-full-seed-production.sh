#!/bin/bash
# Script to run the full database seed on production EC2 instance
# This will clear and re-seed ALL database collections
# 
# ⚠️  WARNING: This deletes all existing data!
# Only run this if you're sure no one is using the system

set -e

echo "🌱 Full Database Seed for Production"
echo "====================================="
echo ""
echo "⚠️  WARNING: This will DELETE all existing data and re-seed the database!"
echo ""

# Confirm before proceeding
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Seed cancelled"
    exit 1
fi

echo ""
echo "🚀 Starting full database seed..."
echo ""

# Detect if we're running inside Docker or on the host
if [ -f /.dockerenv ] || [ -n "$DOCKER_CONTAINER" ]; then
    echo "📦 Running inside Docker container"
    NODE_CMD="node"
    SCRIPT_DIR="/usr/src/bianca-app"
else
    echo "🖥️  Running on host system"
    # Try to find the app container
    APP_CONTAINER=$(docker ps --filter "name=production_app" --format "{{.Names}}" | head -1)
    
    if [ -z "$APP_CONTAINER" ]; then
        echo "⚠️  App container not found, trying alternative names..."
        APP_CONTAINER=$(docker ps --filter "name=app" --format "{{.Names}}" | head -1)
    fi
    
    if [ -z "$APP_CONTAINER" ]; then
        echo "❌ Could not find app container"
        echo "   Available containers:"
        docker ps --format "table {{.Names}}\t{{.Image}}" || true
        exit 1
    fi
    
    echo "✅ Found app container: $APP_CONTAINER"
    NODE_CMD="docker exec -i $APP_CONTAINER node"
    SCRIPT_DIR="/usr/src/bianca-app"
fi

echo ""
echo "📊 Running full database seed script..."
echo "   This will:"
echo "   1. Clear all database collections"
echo "   2. Seed emergency phrases (all languages)"
echo "   3. Seed organizations"
echo "   4. Seed caregivers"
echo "   5. Seed patients"
echo "   6. Seed conversations"
echo "   7. Seed schedules"
echo "   8. Seed alerts"
echo "   9. Seed payment methods"
echo "   10. Seed invoices"
echo "   11. Seed sentiment analysis"
echo ""

$NODE_CMD $SCRIPT_DIR/src/scripts/seedDatabase.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Full database seed completed successfully!"
    echo ""
    echo "📋 Database now contains:"
    echo "   - Emergency phrases for all supported languages"
    echo "   - Test organizations"
    echo "   - Test caregivers and patients"
    echo "   - Sample conversations and messages"
    echo "   - Schedules and alerts"
    echo "   - Payment methods and invoices"
    echo ""
    echo "💡 The application is now ready to use!"
else
    echo ""
    echo "❌ Database seed failed!"
    echo "   Check the logs above for errors"
    exit 1
fi
