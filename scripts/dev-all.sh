#!/bin/bash
# Backend Docker deps + Prometheus/Grafana + API + facility web + admin (full local stack).

bash scripts/check-ports.sh --kill

cleanup() {
  echo ""
  echo "Shutting down dev-all processes..."
  for pid in "$BACKEND_PID" "$WEB_PID" "$ADMIN_PID" "$BACKEND_LOGS_PID"; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  pkill -P $$ 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}

trap cleanup SIGTERM SIGINT EXIT

cd "$(dirname "$0")/.."

echo "Starting Docker services (MongoDB, Redis, Asterisk)…"
yarn workspace @bianca-app/backend docker:dev:services

echo "Starting observability (Prometheus, Grafana)…"
yarn workspace @bianca-app/backend docker:observability || {
  echo "⚠️  Observability stack failed to start (Docker running?). Continuing with API + frontends."
}

echo "Starting backend (nodemon)…"
yarn workspace @bianca-app/backend dev > /tmp/backend-dev.log 2>&1 &
BACKEND_PID=$!

sleep 3

echo "Tailing backend logs…"
tail -f /tmp/backend-dev.log &
BACKEND_LOGS_PID=$!

sleep 1

echo "Starting facility web (Vite)…"
yarn workspace @bianca-app/web dev > /tmp/web-dev.log 2>&1 &
WEB_PID=$!

echo "Starting admin (Vite)…"
yarn workspace @bianca-app/admin dev > /tmp/admin-dev.log 2>&1 &
ADMIN_PID=$!

echo ""
echo "=========================================="
echo "Backend PID:     $BACKEND_PID"
echo "Web PID:         $WEB_PID"
echo "Admin PID:       $ADMIN_PID"
echo "Backend logs:    $BACKEND_LOGS_PID (tailed below)"
echo "=========================================="
echo "API:        http://localhost:3000"
echo "Web UI:     http://localhost:5173"
echo "Admin:      http://localhost:5174"
echo "Grafana:    http://localhost:3333  (admin / admin)"
echo "Prometheus: http://localhost:9090"
echo ""
echo "Other logs: tail -f /tmp/web-dev.log  |  tail -f /tmp/admin-dev.log"
echo "Press Ctrl+C to stop Node/Vite processes (Docker containers keep running)."
echo ""

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null && ! kill -0 "$WEB_PID" 2>/dev/null && ! kill -0 "$ADMIN_PID" 2>/dev/null; then
    echo "All tracked processes have exited"
    break
  fi
  sleep 1
done

wait
