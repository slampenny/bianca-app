#!/bin/bash
# Script to start demo environment with services and seed demo data

set -e

echo "🚀 Starting demo environment..."

# Start Docker services (mongodb, redis, asterisk)
echo "📦 Starting Docker services..."
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d mongodb redis asterisk

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
  # Check if MongoDB container is running and responding
  if docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.dev.yml ps mongodb | grep -q "Up" > /dev/null 2>&1; then
    # Try to connect to MongoDB
    if docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.dev.yml exec -T mongodb mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
      echo "✅ MongoDB is ready!"
      break
    fi
  fi
  attempt=$((attempt + 1))
  if [ $((attempt % 5)) -eq 0 ]; then
    echo "  Attempt $attempt/$max_attempts - waiting for MongoDB..."
  fi
  sleep 1
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ MongoDB failed to start after $max_attempts attempts"
  echo "   Check MongoDB logs: docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml logs mongodb"
  exit 1
fi

# Wait a bit more for MongoDB to fully initialize
echo "⏳ Waiting for MongoDB to fully initialize..."
sleep 2

# Run the demo seeder
echo "🌱 Seeding demo database..."
yarn demo

echo "✅ Demo environment is up and ready!"
echo ""
echo "📊 Services running:"
echo "  - MongoDB: localhost:27017"
echo "  - Redis: localhost:6379"
echo "  - Asterisk: localhost:5060 (SIP), localhost:8088 (ARI)"
echo ""
echo "💡 To stop the demo environment, run: yarn demo:down"
