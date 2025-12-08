#!/bin/bash
set -e
echo "Starting entrypoint script..."
ASTERISK_CONF_DIR="/etc/asterisk"
LOG_DIR="/var/log/asterisk"

# Fix ownership - attempt but don't fail if not possible due to running as non-root
echo "Fixing permissions for $LOG_DIR..."
if [ "$(id -u)" = "0" ]; then
  # Running as root
  chown -R asterisk:asterisk "$LOG_DIR"
  chmod -R ug+rwX "$LOG_DIR"
  chown -R asterisk:asterisk "$ASTERISK_CONF_DIR"
  chmod -R ug+rwX "$ASTERISK_CONF_DIR"
else
  # Running as non-root (likely asterisk)
  echo "Running as non-root user, skipping permission fixes"
fi

# Ensure template directory exists
if [ ! -d "$ASTERISK_CONF_DIR" ]; then
  echo "Error: Asterisk config directory not found at $ASTERISK_CONF_DIR"
  exit 1
fi

# Debug info
echo "Listing contents of $ASTERISK_CONF_DIR:"
ls -la "$ASTERISK_CONF_DIR"

# Debug environment variables
echo "=== Environment Variables ==="
echo "RTP_START_PORT: $RTP_START_PORT"
echo "RTP_END_PORT: $RTP_END_PORT"
echo "EXTERNAL_ADDRESS: $EXTERNAL_ADDRESS"
echo "PRIVATE_ADDRESS: $PRIVATE_ADDRESS"
echo "=== End Environment Variables ==="

# Templating configs
echo "Templating configuration files..."
# Only substitute specific environment variables to avoid replacing Asterisk variables like ${EXTEN}
ENV_VARS='$EXTERNAL_ADDRESS $PRIVATE_ADDRESS $ARI_PASSWORD $BIANCA_PASSWORD $RTP_START_PORT $RTP_END_PORT'
for template in "$ASTERISK_CONF_DIR"/*.template; do
  [ -e "$template" ] || continue
  conf_file="${template%.template}"
  echo "Processing template: $template -> $conf_file"
  envsubst "$ENV_VARS" < "$template" > "$conf_file"
  
  # Debug: Show the content of rtp.conf if it's being processed
  if [[ "$conf_file" == *"rtp.conf" ]]; then
    echo "=== RTP Configuration Content ==="
    cat "$conf_file"
    echo "=== End RTP Configuration ==="
  fi
done

# Check which critical config files exist
echo "Checking for critical config files..."
CRITICAL_FILES="pjsip.conf extensions.conf modules.conf asterisk.conf http.conf manager.conf ari.conf rtp.conf"
for file in $CRITICAL_FILES; do
  if [ -f "$ASTERISK_CONF_DIR/$file" ]; then
    echo "Found $file"
  else
    echo "Warning: $file not found!"
  fi
done

# Debug the output
echo "Final configuration files:"
ls -la "$ASTERISK_CONF_DIR"

# Test RTP configuration before starting
echo "Testing RTP configuration..."
if [ -f "$ASTERISK_CONF_DIR/rtp.conf" ]; then
  echo "RTP config file exists and contains:"
  cat "$ASTERISK_CONF_DIR/rtp.conf"
else
  echo "ERROR: RTP config file not found!"
fi

# Start Asterisk
echo "Starting Asterisk..."
exec /usr/sbin/asterisk -vvvvv -f -U asterisk -G asterisk