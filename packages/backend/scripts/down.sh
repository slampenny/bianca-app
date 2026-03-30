#!/bin/bash
# Script to stop all development services

set -e

echo "Stopping all services..."

# Stop Docker services
echo "Stopping Docker services..."
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.dev.yml down 2>/dev/null || true

# Kill backend processes
echo "Stopping backend processes..."
pkill -f 'nodemon.*src/index.js' 2>/dev/null || true
pkill -f 'node.*src/index.js' 2>/dev/null || true
pkill -f 'cross-env.*nodemon' 2>/dev/null || true

# Kill frontend processes
echo "Stopping frontend processes..."
pkill -f 'expo start' 2>/dev/null || true
pkill -f 'npx expo' 2>/dev/null || true

# Kill processes on common ports
echo "Freeing up ports..."
for port in 3000 3333 9090 8082 8084 8085 9229; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ ! -z "$pid" ]; then
    echo "  Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
  fi
done

echo "All services stopped."


