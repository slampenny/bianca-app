#!/bin/bash
# Sync local repo to staging EC2 and run backend (nodemon) + frontend (Vite) with hot reload.
#
# Usage:
#   ./staging-live-sync.sh          # one-time sync + enable live-dev
#   ./staging-live-sync.sh --watch  # sync on file changes (default after enable)
#   ./staging-live-sync.sh --sync   # rsync only, no container changes
#   ./staging-live-sync.sh --off    # disable live-dev, restore ECR containers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=staging-live-common.sh
source "$SCRIPT_DIR/staging-live-common.sh"

WATCH=false
SYNC_ONLY=false
DISABLE=false

for arg in "$@"; do
  case "$arg" in
    --watch) WATCH=true ;;
    --sync) SYNC_ONLY=true ;;
    --off) DISABLE=true ;;
    -h|--help)
      echo "Usage: $0 [--watch | --sync | --off]"
      exit 0
      ;;
  esac
done

echo "Staging live-dev — local edits sync to EC2 with nodemon (backend) and Vite (frontend)."
echo ""

staging_live_ensure_running || exit 1
echo "Instance: $STAGING_INSTANCE_ID ($STAGING_INSTANCE_IP)"

if [ "$DISABLE" = true ]; then
  echo "Disabling live-dev on staging..."
  staging_live_remote "bash -s" < "$SCRIPT_DIR/staging-live-remote-stop.sh"
  exit 0
fi

staging_live_enable_always_on

echo "Preparing remote directories..."
staging_live_remote "sudo mkdir -p '$REMOTE_SRC_DIR' && sudo chown -R ${STAGING_SSH_USER}:${STAGING_SSH_USER} '$REMOTE_SRC_DIR' '$REMOTE_DEPLOY_DIR'"

echo "Copying live-dev compose overlay..."
staging_live_scp \
  "$REPO_ROOT/packages/backend/docker/docker-compose.staging-live.yml" \
  "${STAGING_SSH_USER}@${STAGING_INSTANCE_IP}:${REMOTE_DEPLOY_DIR}/"

echo "Initial rsync..."
staging_live_rsync_once

if [ "$SYNC_ONLY" = true ]; then
  echo "Sync complete (--sync)."
  exit 0
fi

echo "Bootstrapping staging (compose, MongoDB, infra) if needed..."
staging_live_remote "bash -s" < "$SCRIPT_DIR/staging-live-remote-bootstrap.sh"

echo "Enabling live-dev containers on staging..."
staging_live_remote "bash -s" < "$SCRIPT_DIR/staging-live-remote-start.sh"

echo ""
echo "Staging URLs (unchanged):"
echo "  https://staging-api.biancawellness.com"
echo "  https://staging.biancawellness.com"
echo ""
echo "Backend restarts via nodemon on .js changes under packages/backend/src."
echo "Frontend hot-reloads via Vite (packages/web, shared, ui)."
echo ""

if [ "$WATCH" = false ] && [ -t 0 ]; then
  read -r -p "Start watching for local file changes? [Y/n] " reply
  if [[ ! "$reply" =~ ^[Nn]$ ]]; then
    WATCH=true
  fi
fi

if [ "$WATCH" = false ]; then
  echo "Run with --watch to keep syncing: yarn staging:live:watch"
  exit 0
fi

echo "Watching for changes (Ctrl+C to stop sync; staging stays in live-dev mode)..."
echo ""

last_sync=0
debounce_ms=800

do_sync() {
  local now ms_since
  now=$(date +%s%3N 2>/dev/null || echo $(($(date +%s) * 1000)))
  ms_since=$((now - last_sync))
  if [ "$ms_since" -lt "$debounce_ms" ]; then
    return
  fi
  last_sync=$now
  echo "[$(date +%H:%M:%S)] Syncing..."
  if staging_live_rsync_once; then
    echo "[$(date +%H:%M:%S)] Sync done."
  else
    echo "[$(date +%H:%M:%S)] Sync failed." >&2
  fi
}

if command -v fswatch >/dev/null 2>&1; then
  fswatch -o \
    "$REPO_ROOT/packages/backend/src" \
    "$REPO_ROOT/packages/web/src" \
    "$REPO_ROOT/packages/shared/src" \
    "$REPO_ROOT/packages/ui/src" \
    | while read -r _; do do_sync; done
elif command -v inotifywait >/dev/null 2>&1; then
  while inotifywait -r -e modify,create,delete,move \
    "$REPO_ROOT/packages/backend/src" \
    "$REPO_ROOT/packages/web/src" \
    "$REPO_ROOT/packages/shared/src" \
    "$REPO_ROOT/packages/ui/src" 2>/dev/null; do
    do_sync
  done
else
  echo "Install fswatch or inotify-tools for efficient watching; falling back to 2s polling."
  while true; do
    sleep 2
    do_sync
  done
fi
