#!/bin/bash
# BeforeInstall hook - Clean up old deployment artifacts

set -e

echo "🧹 BeforeInstall: Cleaning up old deployment artifacts..."

# Clean up old deployment directory if it exists
if [ -d "/opt/bianca-staging-deploy" ]; then
  echo "   Removing old deployment directory..."
  rm -rf /opt/bianca-staging-deploy
fi

# Ensure deployment directory exists
mkdir -p /opt/bianca-staging-deploy

echo "✅ BeforeInstall completed"

