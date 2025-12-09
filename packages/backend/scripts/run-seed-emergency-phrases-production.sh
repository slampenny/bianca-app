#!/bin/bash
# Script to seed emergency phrases on production EC2 instance
# This can be run via SSH or as part of deployment

set -e

echo "🌱 Seeding Emergency Phrases on Production"
echo "=========================================="
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
echo "🚀 Running emergency phrases seeder..."
$NODE_CMD $SCRIPT_DIR/src/scripts/seedEmergencyPhrasesOnly.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Emergency phrases seeded successfully!"
    echo ""
    echo "💡 The localized emergency detector will now have phrases for all supported languages:"
    echo "   en, es, fr, de, zh, ja, pt, it, ru, ar, hi, zh-cn"
else
    echo ""
    echo "❌ Failed to seed emergency phrases"
    exit 1
fi
