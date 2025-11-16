#!/bin/bash
# ApplicationStop hook - Stop old containers gracefully

set -e

echo "🛑 ApplicationStop: Stopping old containers..."

# Navigate to staging directory
cd /opt/bianca-staging || {
  echo "⚠️  /opt/bianca-staging not found, skipping stop"
  exit 0
}

# Stop containers with timeout to prevent hangs
if [ -f "docker-compose.yml" ]; then
  echo "   Stopping containers (1 min timeout)..."
  timeout 60 docker-compose down 2>/dev/null || {
    echo "⚠️  Container stop had issues, but continuing..."
  }
else
  echo "   No docker-compose.yml found, skipping stop (containers may not be running yet)"
fi

echo "✅ ApplicationStop completed"

