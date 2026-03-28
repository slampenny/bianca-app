#!/bin/bash
# Start both backend and mobile (Expo web) dev servers
# This script ensures both processes stay running and handles signals properly

# Kill existing processes on ports
bash scripts/check-ports.sh --kill

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down dev servers..."
  # Kill all child processes
  if [ ! -z "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null || true
  fi
  if [ ! -z "$MOBILE_PID" ]; then
    kill $MOBILE_PID 2>/dev/null || true
  fi
  if [ ! -z "$BACKEND_LOGS_PID" ]; then
    kill $BACKEND_LOGS_PID 2>/dev/null || true
  fi
  # Kill any remaining child processes
  pkill -P $$ 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}

# Trap signals to cleanup
trap cleanup SIGTERM SIGINT EXIT

# Start backend in background
echo "Starting backend..."
cd "$(dirname "$0")/.."
yarn workspace @bianca-app/backend dev > /tmp/backend-dev.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start docker services
sleep 3

# Start tailing backend logs in foreground (this will be the main output)
echo "Tailing backend logs..."
tail -f /tmp/backend-dev.log &
BACKEND_LOGS_PID=$!

# Wait a moment for logs to start
sleep 1

# Start mobile Expo web in background
echo "Starting mobile (Expo web)..."
yarn workspace @bianca-app/mobile web > /tmp/mobile-dev.log 2>&1 &
MOBILE_PID=$!

# Wait for both processes
echo ""
echo "=========================================="
echo "Backend PID: $BACKEND_PID"
echo "Mobile (Expo web) PID: $MOBILE_PID"
echo "Backend logs PID: $BACKEND_LOGS_PID"
echo "=========================================="
echo "Both servers starting... Press Ctrl+C to stop"
echo ""
echo "Backend logs are being tailed above."
echo ""

# Wait for all background jobs (this keeps the script running)
# Use wait without arguments to wait for all background jobs
while true; do
  # Check if processes are still running
  if ! kill -0 $BACKEND_PID 2>/dev/null && ! kill -0 $MOBILE_PID 2>/dev/null; then
    echo "Both processes have exited"
    break
  fi
  sleep 1
done

wait
