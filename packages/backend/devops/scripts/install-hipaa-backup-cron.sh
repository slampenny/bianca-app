#!/bin/bash
# Install daily HIPAA backup cron at noon Pacific (while EC2 is running).
# Usage: install-hipaa-backup-cron.sh /opt/bianca-{staging|production}

set -euo pipefail

DEPLOY_DIR="${1:-}"
if [ -z "$DEPLOY_DIR" ] || [ ! -d "$DEPLOY_DIR" ]; then
  echo "Usage: install-hipaa-backup-cron.sh /opt/bianca-{env}" >&2
  exit 1
fi

case "$DEPLOY_DIR" in
  /opt/bianca-staging) ENV_NAME="staging" ;;
  /opt/bianca-production) ENV_NAME="production" ;;
  *)
    ENV_NAME="${DEPLOY_DIR##*/bianca-}"
    ;;
esac

BACKUP_SCRIPT="${DEPLOY_DIR}/hipaa-backup.sh"
LOG="/var/log/bianca-${ENV_NAME}.log"

if [ ! -x "$BACKUP_SCRIPT" ]; then
  echo "Backup script not found: $BACKUP_SCRIPT" >&2
  exit 1
fi

(
  crontab -u ec2-user -l 2>/dev/null | grep -v hipaa-backup | grep -v 'CRON_TZ=America/Los_Angeles' || true
  echo 'CRON_TZ=America/Los_Angeles'
  echo "0 12 * * * ${BACKUP_SCRIPT} daily >> ${LOG} 2>&1"
) | crontab -u ec2-user -

echo "Installed HIPAA backup cron (noon Pacific) for ${ENV_NAME}"
