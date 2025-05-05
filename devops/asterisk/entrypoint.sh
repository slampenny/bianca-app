#!/bin/sh
echo "Starting entrypoint script..."

# Update ARI password
if [ -n "$ARI_PASSWORD" ]; then
  echo "Setting ARI password..."
  sed -i "s/password = changeme/password = $ARI_PASSWORD/" /etc/asterisk/ari.conf
fi

# Update PJSIP password and external address
if [ -n "$BIANCA_PASSWORD" ]; then
  echo "Setting BIANCA password..."
  sed -i "s/password=your_secure_password_here/password=$BIANCA_PASSWORD/" /etc/asterisk/pjsip.conf
fi

if [ -n "$EXTERNAL_ADDRESS" ]; then
  echo "Setting external addresses..."
  sed -i "s/external_media_address=.*/external_media_address=$EXTERNAL_ADDRESS/" /etc/asterisk/pjsip.conf
  sed -i "s/external_signaling_address=.*/external_signaling_address=$EXTERNAL_ADDRESS/" /etc/asterisk/pjsip.conf
fi

if [ -n "$EXTERNAL_PORT" ]; then
  echo "Setting external port..."
  sed -i "s/external_signaling_port=.*/external_signaling_port=$EXTERNAL_PORT/" /etc/asterisk/pjsip.conf
fi

# Ensure proper file ownership
echo "Ensuring CDR directory exists and has correct permissions..."
mkdir -p /var/log/asterisk/cdr-csv
chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk

echo "Starting Asterisk..."
# Start Asterisk with increased verbosity (0-5, higher is more verbose)
exec /usr/sbin/asterisk -vvvvv -f