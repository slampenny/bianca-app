#!/bin/sh
set -e

# Simple approach: If running as root, fix permissions and switch to node user
if [ "$(id -u)" = "0" ]; then
  # Fix permissions on everything from bind mount
  chown -R node:node /usr/src/bianca-app 2>/dev/null || true
  # Ensure directories exist
  mkdir -p .yarn/releases .yarn/cache node_modules
  chown -R node:node .yarn node_modules 2>/dev/null || true
  # Switch to node user
  exec gosu node "$0" "$@"
fi

# Running as node user - just ensure directories exist
mkdir -p .yarn/releases .yarn/cache node_modules

# Run the command
exec "$@"

