#!/bin/bash
# Local mobile dev: ensure backend is up, seed test data, start Expo web.
set -e

cd "$(dirname "$0")/.."

wait_for_backend() {
  for _ in $(seq 1 45); do
    if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! curl -sf http://localhost:3000/health >/dev/null 2>&1; then
  echo "Starting backend (Docker services + nodemon)..."
  yarn dev:backend > /tmp/backend-dev.log 2>&1 &
  BACKEND_PID=$!
  if ! wait_for_backend; then
    echo "Backend did not become ready. Check /tmp/backend-dev.log" >&2
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
  fi
  echo "Backend ready (PID $BACKEND_PID). Logs: tail -f /tmp/backend-dev.log"
fi

echo "Seeding local database..."
if curl -sf -X POST http://localhost:3000/v1/test/seed >/dev/null; then
  echo "Seeded via POST /v1/test/seed"
else
  echo "Seed API unavailable — running yarn seed..."
  yarn seed
fi

echo ""
echo "Mobile B2C dev login: parent@example.org / Password1"
echo "Facility staff (web): fake@example.org / Password1"
echo ""

exec yarn dev:mobile
