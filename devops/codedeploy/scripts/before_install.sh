#!/bin/bash
# BeforeInstall hook - Clean up old deployment artifacts

set -e

echo "🧹 BeforeInstall: Cleaning up old deployment artifacts..."

# Ensure deployment directory exists (appspec.yml destination)
mkdir -p /opt/bianca-staging

# Ensure docker-compose.yml exists (it should be created by userdata, but verify)
if [ ! -f "/opt/bianca-staging/docker-compose.yml" ]; then
  echo "⚠️  docker-compose.yml not found, but continuing (will be created by userdata if needed)"
fi

echo "✅ BeforeInstall completed"

