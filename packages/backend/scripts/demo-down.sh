#!/bin/bash
# Script to stop demo environment

set -e

echo "🛑 Stopping demo environment..."

# Stop Docker services
echo "📦 Stopping Docker services..."
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.dev.yml stop mongodb redis asterisk 2>/dev/null || true

echo "✅ Demo environment stopped."
echo ""
echo "💡 To start the demo environment again, run: yarn demo:up"
