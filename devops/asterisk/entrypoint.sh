#!/bin/sh
set -e

echo "Starting entrypoint script..."

ASTERISK_CONF_DIR="/etc/asterisk"

# Ensure the configuration directory exists
if [ ! -d "$ASTERISK_CONF_DIR" ]; then
  echo "Error: Asterisk config directory not found at $ASTERISK_CONF_DIR"
  exit 1
fi

# Template any .template config files
echo "Templating configuration files with environment variables..."
for template in "$ASTERISK_CONF_DIR"/*.template; do
  conf_file="${template%.template}"
  echo "Generating $(basename "$conf_file") from $(basename "$template")"
  envsubst < "$template" > "$conf_file"
done

echo "Starting Asterisk in background for health pre-check..."
/usr/sbin/asterisk -vvvvv -f &

AST_PID=$!

# Wait for Asterisk to become responsive
for i in $(seq 1 10); do
  if asterisk -rx 'core show uptime' >/dev/null 2>&1; then
    echo "Asterisk is responsive after $i seconds"
    break
  fi
  echo "Waiting for Asterisk to be ready... ($i/10)"
  sleep 1
done

# If it never became responsive, exit early
if ! asterisk -rx 'core show uptime' >/dev/null 2>&1; then
  echo "Asterisk failed to respond after 10 seconds. Exiting."
  kill $AST_PID || true
  exit 1
fi

# Hand off to foreground Asterisk for container lifecycle
echo "Restarting Asterisk in foreground..."
kill $AST_PID || true
exec /usr/sbin/asterisk -vvvvv -f
