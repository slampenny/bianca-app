#!/usr/bin/env bash
# Free Docker disk space without touching named volumes used by running containers.
# Safe for "I'm almost out of disk" situations. Re-pull images on next build/pull.
#
# Usage (from packages/backend):
#   ./scripts/docker-low-disk.sh
#   ./scripts/docker-low-disk.sh --dry-run
#
set -euo pipefail

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      echo "Removes: stopped containers, build cache, Buildx cache, unused images (not referenced by any container)."
      echo "Does NOT: docker system prune --volumes (avoids accidental DB volume removal)."
      exit 0
      ;;
  esac
done

run() {
  if $DRY_RUN; then echo "[dry-run] $*"; else eval "$@"; fi
}

echo "=== Disk (host) ==="
df -h / 2>/dev/null || true
echo ""

echo "=== Docker (before) ==="
docker system df 2>/dev/null || true
echo ""

echo "=== 1. Stopped containers ==="
run docker container prune -f

echo "=== 2. Build cache (docker builder) — often 10–30+ GB; can take a few minutes ==="
run docker builder prune -af

echo "=== 3. Buildx cache ==="
run docker buildx prune -af 2>/dev/null || true

echo "=== 4. Images not used by ANY container (running or stopped) ==="
echo "    (Keeps images for existing containers; removes old Node/ECR layers you can re-pull)"
run docker image prune -a -f

echo "=== 5. Dangling networks ==="
run docker network prune -f

echo ""
echo "=== Docker (after) ==="
docker system df 2>/dev/null || true
echo ""
echo "Done. If Windows still shows little free space after Docker cleanup, compact the right WSL2 VHDX:"
echo "  Docker Desktop → docker_data.vhdx | Docker-in-WSL only → distro ext4.vhdx"
echo "  See packages/backend/scripts/compact-docker-vhdx.md"
