#!/bin/bash
# Ubuntu system cleanup script - removes apt cache, logs, and other temporary files
# This script helps free up disk space by cleaning up Ubuntu system files

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
DRY_RUN=false
AGGRESSIVE=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --aggressive)
            AGGRESSIVE=true
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run        Show what would be cleaned without actually cleaning"
            echo "  --aggressive     Also clean old logs and journal files"
            echo "  --help           Show this help message"
            exit 0
            ;;
    esac
done

echo "🧹 Ubuntu System Cleanup Script"
echo "=============================="
echo ""

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

# Check if running as root for some operations
NEED_SUDO=false
if [ "$EUID" -ne 0 ]; then
    NEED_SUDO=true
    print_warning "Some operations require sudo privileges"
fi

# 1. Clean apt cache
print_status "Step 1: Cleaning apt cache..."
if [ "$DRY_RUN" = true ]; then
    if [ "$NEED_SUDO" = true ]; then
        APT_CACHE_SIZE=$(sudo du -sh /var/cache/apt/archives 2>/dev/null | cut -f1 || echo "unknown")
        print_status "Would clean apt cache (current size: $APT_CACHE_SIZE)"
    else
        APT_CACHE_SIZE=$(du -sh /var/cache/apt/archives 2>/dev/null | cut -f1 || echo "unknown")
        print_status "Would clean apt cache (current size: $APT_CACHE_SIZE)"
    fi
else
    if [ "$NEED_SUDO" = true ]; then
        sudo apt clean
        sudo apt autoclean
    else
        apt clean
        apt autoclean
    fi
    print_success "Apt cache cleaned"
fi
echo ""

# 2. Remove unused packages
print_status "Step 2: Removing unused packages..."
if [ "$DRY_RUN" = true ]; then
    print_status "Would run: apt autoremove -y"
else
    if [ "$NEED_SUDO" = true ]; then
        sudo apt autoremove -y
    else
        apt autoremove -y
    fi
    print_success "Unused packages removed"
fi
echo ""

# 3. Clean user cache directories
print_status "Step 3: Cleaning user cache directories..."
CACHE_DIRS=(
    "$HOME/.cache"
    "$HOME/.npm"
    "$HOME/.yarn"
    "$HOME/.gradle"
    "$HOME/.m2"
    "$HOME/.cache/pip"
)

for cache_dir in "${CACHE_DIRS[@]}"; do
    if [ -d "$cache_dir" ]; then
        if [ "$DRY_RUN" = true ]; then
            CACHE_SIZE=$(du -sh "$cache_dir" 2>/dev/null | cut -f1 || echo "unknown")
            print_status "Would clean: $cache_dir (size: $CACHE_SIZE)"
        else
            CACHE_SIZE=$(du -sh "$cache_dir" 2>/dev/null | cut -f1 || echo "unknown")
            print_status "Cleaning: $cache_dir (size: $CACHE_SIZE)"
            # Be careful with .cache - only remove specific subdirectories
            if [ "$cache_dir" = "$HOME/.cache" ]; then
                # Remove common cache subdirectories but keep important ones
                find "$cache_dir" -type d -name "pip" -exec rm -rf {} + 2>/dev/null || true
                find "$cache_dir" -type d -name "yarn" -exec rm -rf {} + 2>/dev/null || true
                find "$cache_dir" -type d -name "npm" -exec rm -rf {} + 2>/dev/null || true
            else
                rm -rf "$cache_dir"/* 2>/dev/null || true
            fi
        fi
    fi
done
echo ""

# 4. Clean old logs (if aggressive)
if [ "$AGGRESSIVE" = true ]; then
    print_status "Step 4: Cleaning old log files..."
    if [ "$DRY_RUN" = true ]; then
        if [ "$NEED_SUDO" = true ]; then
            LOG_SIZE=$(sudo du -sh /var/log 2>/dev/null | cut -f1 || echo "unknown")
            print_status "Would clean old logs in /var/log (current size: $LOG_SIZE)"
        else
            LOG_SIZE=$(du -sh /var/log 2>/dev/null | cut -f1 || echo "unknown")
            print_status "Would clean old logs in /var/log (current size: $LOG_SIZE)"
        fi
    else
        if [ "$NEED_SUDO" = true ]; then
            # Clean journal logs older than 7 days
            sudo journalctl --vacuum-time=7d 2>/dev/null || true
            # Clean old system logs
            sudo find /var/log -type f -name "*.log" -mtime +30 -delete 2>/dev/null || true
            sudo find /var/log -type f -name "*.gz" -mtime +30 -delete 2>/dev/null || true
        else
            journalctl --vacuum-time=7d 2>/dev/null || true
            find /var/log -type f -name "*.log" -mtime +30 -delete 2>/dev/null || true
            find /var/log -type f -name "*.gz" -mtime +30 -delete 2>/dev/null || true
        fi
        print_success "Old logs cleaned"
    fi
    echo ""
fi

# 5. Clean temporary files
print_status "Step 5: Cleaning temporary files..."
if [ "$DRY_RUN" = true ]; then
    TMP_SIZE=$(du -sh /tmp 2>/dev/null | cut -f1 || echo "unknown")
    print_status "Would clean /tmp (current size: $TMP_SIZE)"
else
    if [ "$NEED_SUDO" = true ]; then
        sudo find /tmp -type f -atime +7 -delete 2>/dev/null || true
    else
        find /tmp -type f -atime +7 -delete 2>/dev/null || true
    fi
    print_success "Temporary files cleaned"
fi
echo ""

if [ "$DRY_RUN" = false ]; then
    print_success "Ubuntu cleanup complete!"
    echo ""
    print_status "Disk space freed. Check with: df -h"
else
    print_status "Dry run complete - no changes were made"
fi

echo ""
print_status "To see disk usage:"
echo "  df -h                    # Overall disk usage"
echo "  du -sh ~/.cache           # User cache size"
echo "  sudo du -sh /var/cache/apt # Apt cache size"



