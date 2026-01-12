#!/bin/bash
# Check if ports are in use and optionally kill the processes

PORT_3000_PID=$(lsof -ti :3000 2>/dev/null)
PORT_8082_PID=$(lsof -ti :8082 2>/dev/null)

if [ ! -z "$PORT_3000_PID" ]; then
  echo "⚠️  Port 3000 is in use by PID $PORT_3000_PID"
  if [ "$1" == "--kill" ]; then
    echo "Killing process on port 3000..."
    kill -9 $PORT_3000_PID 2>/dev/null || true
    sleep 1
    echo "✅ Port 3000 is now free"
  else
    echo "   Backend may already be running. Use --kill to stop it."
  fi
fi

if [ ! -z "$PORT_8082_PID" ]; then
  echo "⚠️  Port 8082 is in use by PID $PORT_8082_PID"
  if [ "$1" == "--kill" ]; then
    echo "Killing process on port 8082..."
    kill -9 $PORT_8082_PID 2>/dev/null || true
    sleep 1
    echo "✅ Port 8082 is now free"
  else
    echo "   Frontend may already be running. Use --kill to stop it."
  fi
fi

if [ -z "$PORT_3000_PID" ] && [ -z "$PORT_8082_PID" ]; then
  echo "✅ Ports 3000 and 8082 are free"
fi
