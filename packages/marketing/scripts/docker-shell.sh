#!/usr/bin/env bash
# Open a shell inside the WordPress container (edit files under /var/www/html).
# Usage: ./docker-shell.sh
set -e
cd "$(dirname "$0")"
docker compose exec wordpress bash
