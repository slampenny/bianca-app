#!/bin/bash
# Master cleanup script - runs both Docker and Ubuntu cleanup
# This is a convenience script that runs all cleanup operations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🧹 Running Complete System Cleanup"
echo "==================================="
echo ""

# Check for flags
AGGRESSIVE=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --aggressive)
            AGGRESSIVE=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --aggressive     Run aggressive cleanup (removes more data)"
            echo "  --dry-run        Show what would be cleaned without actually cleaning"
            echo "  --help           Show this help message"
            exit 0
            ;;
    esac
done

# Build flags string
FLAGS=""
if [ "$AGGRESSIVE" = true ]; then
    FLAGS="$FLAGS --aggressive"
fi
if [ "$DRY_RUN" = true ]; then
    FLAGS="$FLAGS --dry-run"
fi

# Run Docker cleanup
echo "🐳 Step 1: Docker Cleanup"
echo "-------------------------"
"$SCRIPT_DIR/cleanup-docker.sh" $FLAGS
echo ""

# Run Ubuntu cleanup
echo "🐧 Step 2: Ubuntu System Cleanup"
echo "---------------------------------"
"$SCRIPT_DIR/cleanup-ubuntu.sh" $FLAGS
echo ""

echo "✅ Complete system cleanup finished!"
echo ""
echo "💡 To see disk space freed:"
echo "   df -h"
echo "   docker system df"




