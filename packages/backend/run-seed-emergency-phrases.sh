#!/bin/bash
# Script to seed emergency phrases only (for production)
# This script can be run on production without affecting other data

set -e

echo "🌱 Seeding Emergency Phrases for Production"
echo "==========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    yarn install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "   Make sure environment variables are set"
fi

# Run the seed script
echo "🚀 Running emergency phrases seeder..."
NODE_ENV=production node src/scripts/seedEmergencyPhrasesOnly.js

echo ""
echo "✅ Emergency phrases seeding complete!"
