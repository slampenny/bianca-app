#!/bin/bash
# Start backend (Docker services + API) and the Vite web app — same backend path as yarn dev.

bash scripts/check-ports.sh --kill

cleanup() {
  echo ""
  echo "Shutting down dev servers..."
  if [ ! -z "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null || true
  fi
  if [ ! -z "$WEB_PID" ]; then
    kill $WEB_PID 2>/dev/null || true
  fi
  if [ ! -z "$BACKEND_LOGS_PID" ]; then
    kill $BACKEND_LOGS_PID 2>/dev/null || true
  fi
  pkill -P $$ 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}

trap cleanup SIGTERM SIGINT EXIT

echo "Starting backend (Docker services + nodemon)..."
cd "$(dirname "$0")/.."
yarn workspace @bianca-app/backend dev > /tmp/backend-dev.log 2>&1 &
BACKEND_PID=$!

sleep 3

echo "Tailing backend logs..."
tail -f /tmp/backend-dev.log &
BACKEND_LOGS_PID=$!

sleep 1

echo "Starting web (Vite)..."
yarn workspace @bianca-app/web dev > /tmp/web-dev.log 2>&1 &
WEB_PID=$!

echo ""
echo "=========================================="
echo "Backend PID: $BACKEND_PID"
echo "Web (Vite) PID: $WEB_PID"
echo "Backend logs PID: $BACKEND_LOGS_PID"
echo "=========================================="
echo "API:    http://localhost:3000 (default)"
echo "Web UI: http://localhost:5173"
echo ""
echo "Backend logs are tailed above; web logs: tail -f /tmp/web-dev.log"
echo "Press Ctrl+C to stop backend and web."
echo ""

while true; do
  if ! kill -0 $BACKEND_PID 2>/dev/null && ! kill -0 $WEB_PID 2>/dev/null; then
    echo "Both processes have exited"
    break
  fi
  sleep 1
done

wait
