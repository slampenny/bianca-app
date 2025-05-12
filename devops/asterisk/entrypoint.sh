#!/bin/sh
set -e

echo "Starting entrypoint script..."

ASTERISK_CONF_DIR="/etc/asterisk"

# Ensure the configuration directory exists
if [ ! -d "$ASTERISK_CONF_DIR" ]; then
  echo "Error: Asterisk config directory not found at $ASTERISK_CONF_DIR"
  exit 1
fi

# Copy templated config files
echo "Templating configuration files with environment variables..."

for template in "$ASTERISK_CONF_DIR"/*.template; do
  conf_file="${template%.template}"
  echo "Generating $(basename "$conf_file") from $(basename "$template")"
  envsubst < "$template" > "$conf_file"
done

# Ensure proper file permissions
echo "Fixing permissions..."
mkdir -p /var/log/asterisk/cdr-csv
chown -R asterisk:asterisk \
  "$ASTERISK_CONF_DIR" \
  /var/lib/asterisk \
  /var/log/asterisk \
  /var/spool/asterisk

# Start Asterisk
echo "Starting Asterisk..."
exec /usr/sbin/asterisk -vvvvv -f
