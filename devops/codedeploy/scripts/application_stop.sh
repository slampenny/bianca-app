#!/bin/bash
# ApplicationStop hook - Stop old containers gracefully
# Always exit 0 - don't block deployment

cd /opt/bianca-staging 2>/dev/null || exit 0

# Stop containers with timeout - use timeout command to prevent hangs
CONTAINERS="staging_app staging_frontend staging_nginx staging_mongodb staging_asterisk staging_posthog staging_posthog_db staging_posthog_redis"

for container in $CONTAINERS; do
  timeout 5 docker stop $container 2>/dev/null || timeout 2 docker kill $container 2>/dev/null || true
  timeout 2 docker rm $container 2>/dev/null || true
done

exit 0

