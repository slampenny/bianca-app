#!/bin/bash
# Docker cleanup script - removes unused images, containers, volumes, and build cache
# This script helps free up disk space by cleaning up Docker resources

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for flags
AGGRESSIVE=false
DRY_RUN=false
KEEP_RECENT=false

for arg in "$@"; do
    case $arg in
        --aggressive)
            AGGRESSIVE=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        --keep-recent)
            KEEP_RECENT=true
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --aggressive     Remove ALL unused images (including recently used)"
            echo "  --dry-run        Show what would be cleaned without actually cleaning"
            echo "  --keep-recent    Keep images created in the last 24 hours"
            echo "  --help           Show this help message"
            exit 0
            ;;
    esac
done

echo "🧹 Docker Cleanup Script"
echo "========================"
echo ""

# Show current disk usage
print_status "Current Docker disk usage:"
docker system df
echo ""

if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN MODE - No changes will be made"
    echo ""
fi

# Function to execute command or show what would be executed
execute_or_show() {
    local cmd="$1"
    local description="$2"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "Would run: $description"
        echo "  Command: $cmd"
    else
        eval "$cmd"
    fi
}

# 1. Remove stopped containers
print_status "Step 1: Removing stopped containers..."
if [ "$DRY_RUN" = true ]; then
    STOPPED_COUNT=$(docker ps -a -q -f status=exited | wc -l)
    print_status "Would remove $STOPPED_COUNT stopped containers"
else
    docker container prune -f
fi
echo ""

# 2. Remove unused images
print_status "Step 2: Removing unused images..."
if [ "$KEEP_RECENT" = true ]; then
    print_status "Keeping images created in the last 24 hours..."
    if [ "$DRY_RUN" = true ]; then
        print_status "Would remove images older than 24 hours that are not in use"
    else
        # Remove images older than 24 hours that are not in use
        docker image prune -a -f --filter "until=24h"
    fi
elif [ "$AGGRESSIVE" = true ]; then
    print_status "Aggressive mode: Removing ALL unused images..."
    if [ "$DRY_RUN" = true ]; then
        UNUSED_IMAGES=$(docker images -f "dangling=true" -q | wc -l)
        print_status "Would remove all unused images (including recently used)"
    else
        docker image prune -a -f
    fi
else
    print_status "Removing dangling (untagged) images..."
    if [ "$DRY_RUN" = true ]; then
        DANGLING_IMAGES=$(docker images -f "dangling=true" -q | wc -l)
        print_status "Would remove dangling images"
    else
        docker image prune -f
    fi
fi
echo ""

# 3. Remove unused volumes
print_status "Step 3: Removing unused volumes..."
if [ "$DRY_RUN" = true ]; then
    UNUSED_VOLUMES=$(docker volume ls -q -f dangling=true | wc -l)
    print_status "Would remove $UNUSED_VOLUMES unused volumes"
else
    docker volume prune -f
fi
echo ""

# 4. Remove unused networks
print_status "Step 4: Removing unused networks..."
if [ "$DRY_RUN" = true ]; then
    print_status "Would remove unused networks"
else
    docker network prune -f
fi
echo ""

# 5. Remove build cache (this is often the biggest space saver)
print_status "Step 5: Removing build cache..."
if [ "$DRY_RUN" = true ]; then
    BUILD_CACHE_SIZE=$(docker system df | grep "Build Cache" | awk '{print $4}')
    print_status "Would remove build cache ($BUILD_CACHE_SIZE)"
else
    docker builder prune -a -f
fi
echo ""

# 6. Remove specific untagged images from our ECR repository
print_status "Step 6: Removing untagged ECR images..."
if [ "$DRY_RUN" = true ]; then
    UNTAGGED=$(docker images | grep "730335291008.dkr.ecr.us-east-2.amazonaws.com" | grep "<none>" | wc -l)
    print_status "Would remove $UNTAGGED untagged ECR images"
else
    # Remove untagged images from our ECR
    docker images | grep "730335291008.dkr.ecr.us-east-2.amazonaws.com" | grep "<none>" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
fi
echo ""

# 7. Clean up container logs (often a hidden space hog)
print_status "Step 7: Checking container logs..."
if [ "$DRY_RUN" = true ]; then
    # Try to find container logs directory
    DOCKER_ROOT=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $4}' || echo "")
    if [ -z "$DOCKER_ROOT" ]; then
        if [ -d "/var/lib/docker/containers" ]; then
            DOCKER_ROOT="/var/lib/docker"
        fi
    fi
    if [ -n "$DOCKER_ROOT" ] && [ -d "$DOCKER_ROOT/containers" ]; then
        LOG_SIZE=$(sudo du -sh "$DOCKER_ROOT/containers" 2>/dev/null | awk '{print $1}' || echo "unknown")
        print_status "Container logs size: $LOG_SIZE (would truncate logs > 100MB)"
    else
        print_status "Would clean up large container logs"
    fi
else
    # Truncate container logs larger than 100MB
    print_status "Truncating large container logs (>100MB)..."
    DOCKER_ROOT=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $4}' || echo "")
    if [ -z "$DOCKER_ROOT" ]; then
        if [ -d "/var/lib/docker/containers" ]; then
            DOCKER_ROOT="/var/lib/docker"
        fi
    fi
    if [ -n "$DOCKER_ROOT" ] && [ -d "$DOCKER_ROOT/containers" ]; then
        sudo find "$DOCKER_ROOT/containers" -name "*-json.log" -type f -size +100M -exec truncate -s 0 {} \; 2>/dev/null || true
        print_success "Large container logs truncated"
    else
        print_warning "Could not find container logs directory"
    fi
fi
echo ""

# 8. Clean BuildKit cache (separate from regular build cache)
print_status "Step 8: Cleaning BuildKit cache..."
if [ "$DRY_RUN" = true ]; then
    print_status "Would run: docker buildx prune -a -f"
else
    # BuildKit has its own cache that's separate from builder prune
    docker buildx prune -a -f 2>/dev/null || print_warning "BuildKit not available or already clean"
fi
echo ""

# 9. Full system prune (if aggressive)
if [ "$AGGRESSIVE" = true ]; then
    print_status "Step 9: Full system prune..."
    if [ "$DRY_RUN" = true ]; then
        print_status "Would run: docker system prune -a -f --volumes"
    else
        print_warning "Running aggressive system prune (this may take a while)..."
        docker system prune -a -f --volumes
    fi
    echo ""
fi

if [ "$DRY_RUN" = false ]; then
    print_success "Cleanup complete!"
    echo ""
    print_status "Updated Docker disk usage:"
    docker system df
    echo ""
    print_status "Note: 'docker system df' may not show all disk usage."
    print_status "Run './diagnose-docker-space.sh' to see detailed breakdown."
    echo ""
    
    # Check if Docker Desktop VHDX exists and suggest compacting
    VHDX_PATH=""
    if [ -d "/mnt/c/Users" ]; then
        for user_dir in /mnt/c/Users/*/AppData/Local/Docker/wsl/disk/docker_data.vhdx; do
            if [ -f "$user_dir" ]; then
                VHDX_PATH="$user_dir"
                break
            fi
        done
    fi
    
    if [ -n "$VHDX_PATH" ]; then
        VHDX_SIZE=$(ls -lh "$VHDX_PATH" | awk '{print $5}')
        print_warning "Docker Desktop VHDX file size: $VHDX_SIZE"
        echo ""
        print_status "⚠️  IMPORTANT: The VHDX file doesn't shrink automatically!"
        print_status "After cleaning Docker data, you need to COMPACT the VHDX file"
        print_status "to actually free up the disk space on Windows."
        echo ""
        print_status "Next step: Compact the VHDX file (see compact-docker-vhdx.md)"
        print_status "  From Windows PowerShell (as Admin):"
        print_status "  Optimize-VHD -Path \"\$env:LOCALAPPDATA\\Docker\\wsl\\disk\\docker_data.vhdx\" -Mode Full"
    fi
else
    print_status "Dry run complete - no changes were made"
fi

echo ""
print_status "To free up more space, you can also:"
echo "  - Run with --aggressive flag to remove ALL unused images"
echo "  - Run './diagnose-docker-space.sh' to find hidden space usage"
if [ -n "$VHDX_PATH" ]; then
    echo "  - Compact VHDX file after cleanup (see compact-docker-vhdx.md)"
fi
echo "  - Manually remove specific images: docker rmi <image-id>"
echo "  - Clean up Ubuntu: sudo apt clean && sudo apt autoremove"

