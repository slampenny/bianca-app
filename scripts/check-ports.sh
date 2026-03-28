#!/bin/bash
# Check if ports are in use and optionally kill the processes

PORT_3000_PID=$(lsof -ti :3000 2>/dev/null)
PORT_8084_PID=$(lsof -ti :8084 2>/dev/null)
PORT_5173_PID=$(lsof -ti :5173 2>/dev/null)

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

if [ ! -z "$PORT_8084_PID" ]; then
  echo "⚠️  Port 8084 is in use by PID $PORT_8084_PID"
  if [ "$1" == "--kill" ]; then
    echo "Killing process on port 8084..."
    kill -9 $PORT_8084_PID 2>/dev/null || true
    sleep 1
    echo "✅ Port 8084 is now free"
  else
    echo "   Frontend may already be running. Use --kill to stop it."
  fi
fi

if [ ! -z "$PORT_5173_PID" ]; then
  echo "⚠️  Port 5173 is in use by PID $PORT_5173_PID"
  if [ "$1" == "--kill" ]; then
    echo "Killing process on port 5173..."
    kill -9 $PORT_5173_PID 2>/dev/null || true
    sleep 1
    echo "✅ Port 5173 is now free"
  else
    echo "   Vite (web) may already be running. Use --kill to stop it."
  fi
fi

if [ -z "$PORT_3000_PID" ] && [ -z "$PORT_8084_PID" ] && [ -z "$PORT_5173_PID" ]; then
  echo "✅ Ports 3000, 8084, and 5173 are free"
fi
