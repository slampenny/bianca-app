#!/bin/bash
# Diagnostic script to find where Docker is actually using disk space
# This helps identify the discrepancy between docker system df and actual disk usage

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 Docker Disk Space Diagnostic"
echo "================================"
echo ""

# 1. What docker system df reports
echo -e "${BLUE}[1] Docker System DF Report${NC}"
echo "----------------------------"
docker system df
echo ""

# 2. Check Docker root directory size
echo -e "${BLUE}[2] Docker Root Directory Size${NC}"
echo "-----------------------------------"
DOCKER_ROOT=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $4}' || echo "")
if [ -z "$DOCKER_ROOT" ]; then
    # Try common locations
    if [ -d "/var/lib/docker" ]; then
        DOCKER_ROOT="/var/lib/docker"
    elif [ -d "$HOME/.docker" ]; then
        DOCKER_ROOT="$HOME/.docker"
    elif [ -d "/mnt/wsl/docker-desktop-data" ]; then
        DOCKER_ROOT="/mnt/wsl/docker-desktop-data"
    fi
fi

if [ -n "$DOCKER_ROOT" ] && [ -d "$DOCKER_ROOT" ]; then
    echo "Docker Root: $DOCKER_ROOT"
    echo "Total size:"
    sudo du -sh "$DOCKER_ROOT" 2>/dev/null || du -sh "$DOCKER_ROOT" 2>/dev/null || echo "  (Cannot access - may need sudo)"
    echo ""
    echo "Breakdown by subdirectory:"
    sudo du -sh "$DOCKER_ROOT"/* 2>/dev/null | sort -h | tail -20 || du -sh "$DOCKER_ROOT"/* 2>/dev/null | sort -h | tail -20 || echo "  (Cannot access - may need sudo)"
else
    echo "Could not determine Docker root directory"
fi
echo ""

# 3. Check Docker Desktop data (WSL2)
echo -e "${BLUE}[3] Docker Desktop WSL2 Data${NC}"
echo "----------------------------"
if [ -d "/mnt/wsl/docker-desktop-data" ]; then
    echo "Docker Desktop data directory found:"
    sudo du -sh /mnt/wsl/docker-desktop-data 2>/dev/null || echo "  (Cannot access - may need sudo)"
    echo ""
    echo "Breakdown:"
    sudo du -sh /mnt/wsl/docker-desktop-data/* 2>/dev/null | sort -h | tail -10 || echo "  (Cannot access - may need sudo)"
else
    echo "Docker Desktop data directory not found (may be using Docker Engine)"
fi
echo ""

# 4. Check container logs
echo -e "${BLUE}[4] Container Logs Size${NC}"
echo "----------------------"
CONTAINER_LOGS_DIR=""
if [ -n "$DOCKER_ROOT" ] && [ -d "$DOCKER_ROOT/containers" ]; then
    CONTAINER_LOGS_DIR="$DOCKER_ROOT/containers"
elif [ -d "/var/lib/docker/containers" ]; then
    CONTAINER_LOGS_DIR="/var/lib/docker/containers"
fi

if [ -n "$CONTAINER_LOGS_DIR" ] && [ -d "$CONTAINER_LOGS_DIR" ]; then
    echo "Container logs directory: $CONTAINER_LOGS_DIR"
    echo "Total logs size:"
    sudo du -sh "$CONTAINER_LOGS_DIR" 2>/dev/null || du -sh "$CONTAINER_LOGS_DIR" 2>/dev/null || echo "  (Cannot access)"
    echo ""
    echo "Top 10 largest log files:"
    sudo find "$CONTAINER_LOGS_DIR" -name "*-json.log" -type f -exec du -h {} \; 2>/dev/null | sort -h | tail -10 || \
    find "$CONTAINER_LOGS_DIR" -name "*-json.log" -type f -exec du -h {} \; 2>/dev/null | sort -h | tail -10 || echo "  (Cannot access)"
else
    echo "Container logs directory not found"
fi
echo ""

# 5. Check overlay2 (filesystem layers)
echo -e "${BLUE}[5] Overlay2 Filesystem Size${NC}"
echo "---------------------------"
OVERLAY_DIR=""
if [ -n "$DOCKER_ROOT" ] && [ -d "$DOCKER_ROOT/overlay2" ]; then
    OVERLAY_DIR="$DOCKER_ROOT/overlay2"
elif [ -d "/var/lib/docker/overlay2" ]; then
    OVERLAY_DIR="/var/lib/docker/overlay2"
fi

if [ -n "$OVERLAY_DIR" ] && [ -d "$OVERLAY_DIR" ]; then
    echo "Overlay2 directory: $OVERLAY_DIR"
    echo "Total size:"
    sudo du -sh "$OVERLAY_DIR" 2>/dev/null || du -sh "$OVERLAY_DIR" 2>/dev/null || echo "  (Cannot access)"
    echo ""
    echo "Number of layers:"
    sudo find "$OVERLAY_DIR" -maxdepth 1 -type d | wc -l 2>/dev/null || find "$OVERLAY_DIR" -maxdepth 1 -type d | wc -l 2>/dev/null || echo "  (Cannot access)"
else
    echo "Overlay2 directory not found"
fi
echo ""

# 6. Check buildkit cache
echo -e "${BLUE}[6] BuildKit Cache Size${NC}"
echo "---------------------"
BUILDKIT_DIR=""
if [ -n "$DOCKER_ROOT" ] && [ -d "$DOCKER_ROOT/buildkit" ]; then
    BUILDKIT_DIR="$DOCKER_ROOT/buildkit"
elif [ -d "/var/lib/docker/buildkit" ]; then
    BUILDKIT_DIR="/var/lib/docker/buildkit"
fi

if [ -n "$BUILDKIT_DIR" ] && [ -d "$BUILDKIT_DIR" ]; then
    echo "BuildKit directory: $BUILDKIT_DIR"
    echo "Total size:"
    sudo du -sh "$BUILDKIT_DIR" 2>/dev/null || du -sh "$BUILDKIT_DIR" 2>/dev/null || echo "  (Cannot access)"
    echo ""
    echo "Breakdown:"
    sudo du -sh "$BUILDKIT_DIR"/* 2>/dev/null | sort -h | tail -10 || du -sh "$BUILDKIT_DIR"/* 2>/dev/null | sort -h | tail -10 || echo "  (Cannot access)"
else
    echo "BuildKit directory not found"
fi
echo ""

# 7. Check image storage
echo -e "${BLUE}[7] Image Storage Size${NC}"
echo "-------------------"
IMAGE_DIR=""
if [ -n "$DOCKER_ROOT" ] && [ -d "$DOCKER_ROOT/image" ]; then
    IMAGE_DIR="$DOCKER_ROOT/image"
elif [ -d "/var/lib/docker/image" ]; then
    IMAGE_DIR="/var/lib/docker/image"
fi

if [ -n "$IMAGE_DIR" ] && [ -d "$IMAGE_DIR" ]; then
    echo "Image directory: $IMAGE_DIR"
    echo "Total size:"
    sudo du -sh "$IMAGE_DIR" 2>/dev/null || du -sh "$IMAGE_DIR" 2>/dev/null || echo "  (Cannot access)"
else
    echo "Image directory not found"
fi
echo ""

# 8. Check volumes
echo -e "${BLUE}[8] Volume Storage Size${NC}"
echo "---------------------"
VOLUME_DIR=""
if [ -n "$DOCKER_ROOT" ] && [ -d "$DOCKER_ROOT/volumes" ]; then
    VOLUME_DIR="$DOCKER_ROOT/volumes"
elif [ -d "/var/lib/docker/volumes" ]; then
    VOLUME_DIR="/var/lib/docker/volumes"
fi

if [ -n "$VOLUME_DIR" ] && [ -d "$VOLUME_DIR" ]; then
    echo "Volumes directory: $VOLUME_DIR"
    echo "Total size:"
    sudo du -sh "$VOLUME_DIR" 2>/dev/null || du -sh "$VOLUME_DIR" 2>/dev/null || echo "  (Cannot access)"
    echo ""
    echo "Largest volumes:"
    sudo du -sh "$VOLUME_DIR"/* 2>/dev/null | sort -h | tail -10 || du -sh "$VOLUME_DIR"/* 2>/dev/null | sort -h | tail -10 || echo "  (Cannot access)"
else
    echo "Volumes directory not found"
fi
echo ""

# 9. Check Docker Desktop VHDX file (WSL2)
echo -e "${BLUE}[9] Docker Desktop VHDX File (WSL2)${NC}"
echo "-----------------------------------"
VHDX_PATH=""
if [ -d "/mnt/c/Users" ]; then
    # Try to find the VHDX file
    for user_dir in /mnt/c/Users/*/AppData/Local/Docker/wsl/disk/docker_data.vhdx; do
        if [ -f "$user_dir" ]; then
            VHDX_PATH="$user_dir"
            break
        fi
    done
fi

if [ -n "$VHDX_PATH" ] && [ -f "$VHDX_PATH" ]; then
    echo "Found Docker Desktop VHDX file:"
    echo "  Path: $VHDX_PATH"
    VHDX_SIZE=$(ls -lh "$VHDX_PATH" | awk '{print $5}')
    echo "  Size: $VHDX_SIZE"
    echo ""
    
    # Get docker system df total
    DOCKER_DF_TOTAL=$(docker system df 2>/dev/null | tail -1 | awk '{print $3}' || echo "unknown")
    echo "  Docker reports: $DOCKER_DF_TOTAL (actual data)"
    echo ""
    
    if [ -n "$VHDX_SIZE" ]; then
        echo -e "${YELLOW}⚠️  VHDX FILE IS LARGER THAN REPORTED DATA${NC}"
        echo ""
        echo "This is normal for Docker Desktop on WSL2. The VHDX file grows but"
        echo "doesn't automatically shrink when you delete images/containers."
        echo ""
        echo "To reclaim the space, you need to COMPACT the VHDX file:"
        echo "  1. Stop Docker Desktop completely"
        echo "  2. Run (from Windows PowerShell as Admin):"
        echo "     Optimize-VHD -Path \"\$env:LOCALAPPDATA\\Docker\\wsl\\disk\\docker_data.vhdx\" -Mode Full"
        echo "  3. Restart Docker Desktop"
        echo ""
        echo "See: compact-docker-vhdx.md for detailed instructions"
    fi
else
    echo "Docker Desktop VHDX file not found (may be using Docker Engine directly)"
fi
echo ""

# 10. Summary
echo -e "${YELLOW}Summary${NC}"
echo "-------"
echo "The discrepancy between 'docker system df' and actual disk usage is often due to:"
echo "  1. Docker Desktop VHDX file (doesn't shrink automatically) - ${RED}MOST COMMON${NC}"
echo "  2. Container logs (can grow very large if not rotated)"
echo "  3. Overlay2 filesystem layers (orphaned layers)"
echo "  4. BuildKit cache (separate from build cache)"
echo "  5. Image metadata and databases"
echo ""
echo "To clean up additional space:"
if [ -n "$VHDX_PATH" ]; then
    echo -e "  ${YELLOW}→ COMPACT VHDX FILE (see compact-docker-vhdx.md)${NC} - This will free the most space!"
fi
echo "  - Container logs: Configure log rotation or truncate large logs"
echo "  - Overlay2: Run 'docker system prune -a' (already in cleanup script)"
echo "  - BuildKit: May need manual cleanup"
echo "  - Docker Desktop: Compact VHDX file (see compact-docker-vhdx.md)"

