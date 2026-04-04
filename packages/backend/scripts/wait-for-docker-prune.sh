#!/usr/bin/env bash
# Wait until no Docker prune is running (daemon reports "already running" while one is active).
# Then optionally run a final image + builder prune so reclaim is complete before you compact a WSL2 VHDX (see compact-docker-vhdx.md).
#
# Usage (from packages/backend):
#   ./scripts/wait-for-docker-prune.sh           # wait, then final prune + "ready to compact"
#   ./scripts/wait-for-docker-prune.sh --wait-only
#
set -euo pipefail

PROBE_INTERVAL="${PROBE_INTERVAL:-15}"
PROBE_TIMEOUT="${PROBE_TIMEOUT:-20}"

WAIT_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --wait-only) WAIT_ONLY=true ;;
    -h|--help)
      echo "Usage: $0 [--wait-only]"
      echo "  Polls until Docker finishes any in-flight prune, then prints a clear 'ready' message."
      echo "  Default: also runs docker image prune -a -f and docker builder prune -af."
      echo "  --wait-only: do not run those; use if you already pruned manually."
      exit 0
      ;;
  esac
done

echo "Waiting for Docker to finish any prune in progress..."
echo "(Probes every ${PROBE_INTERVAL}s, ${PROBE_TIMEOUT}s timeout per probe.)"
echo ""

while true; do
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  if command -v timeout >/dev/null 2>&1; then
    set +e
    out=$(timeout "$PROBE_TIMEOUT" docker image prune -f 2>&1)
    rc=$?
    set -e
    if [ "$rc" -eq 124 ]; then
      echo "$ts — prune still in progress (probe timed out after ${PROBE_TIMEOUT}s). Waiting ${PROBE_INTERVAL}s..."
      sleep "$PROBE_INTERVAL"
      continue
    fi
  else
    out=$(docker image prune -f 2>&1) || true
  fi

  if echo "$out" | grep -qi 'already running'; then
    echo "$ts — prune still in progress (daemon reports busy). Waiting ${PROBE_INTERVAL}s..."
    sleep "$PROBE_INTERVAL"
    continue
  fi

  [ -n "$out" ] && echo "$out" | tail -8
  break
done

echo ""
echo "$(date '+%Y-%m-%d %H:%M:%S') — no prune lock held; background prune is finished."

if ! $WAIT_ONLY; then
  echo ""
  echo "Running final unused-image and build-cache cleanup (safe for running containers)..."
  docker image prune -a -f || true
  docker builder prune -af 2>/dev/null || true
  docker buildx prune -af 2>/dev/null || true
fi

echo ""
echo "========================================================================"
echo "  Docker cleanup is done. You can compact the drive now."
echo "  Windows + WSL2: compact the right VHDX (Docker Desktop vs distro ext4) —"
echo "  packages/backend/scripts/compact-docker-vhdx.md"
echo "========================================================================"
echo ""
docker system df 2>/dev/null || true
