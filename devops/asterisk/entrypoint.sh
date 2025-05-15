#!/bin/sh
set -e

echo "Starting entrypoint script..."

ASTERISK_CONF_DIR="/etc/asterisk"
LOG_DIR="/var/log/asterisk"

# Fix ownership if volume is mounted with wrong perms
echo "Fixing permissions for $LOG_DIR..."
chown -R asterisk:asterisk "$LOG_DIR" || true
chmod -R ug+rwX "$LOG_DIR" || true

# Ensure template directory exists
if [ ! -d "$ASTERISK_CONF_DIR" ]; then
  echo "Error: Asterisk config directory not found at $ASTERISK_CONF_DIR"
  exit 1
fi

# Templating configs
echo "Templating configuration files..."
for template in "$ASTERISK_CONF_DIR"/*.template; do
  [ -e "$template" ] || continue
  conf_file="${template%.template}"
  envsubst < "$template" > "$conf_file"
done

# Start Asterisk
echo "Starting Asterisk..."
exec /usr/sbin/asterisk -vvvvv -f -U asterisk -G asterisk
