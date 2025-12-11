#!/bin/bash
# Final cleanup of scripts folder - keep only deployment scripts

set -e

SCRIPTS_DIR="bianca-app-backend/scripts"
BACKUP_DIR="bianca-app-backend/scripts-archive-final-$(date +%Y%m%d)"

echo "=========================================="
echo "Final Scripts Cleanup - Keep Only Deploy Scripts"
echo "=========================================="
echo ""

# Scripts to KEEP (deployment only)
SCRIPTS_TO_KEEP=(
    "deploy-production.sh"
    "deploy-staging.sh"
    "staging-control.sh"
)

# All other scripts to archive
echo "Creating backup directory..."
mkdir -p "$BACKUP_DIR"

echo ""
echo "Scripts to KEEP (deployment):"
for script in "${SCRIPTS_TO_KEEP[@]}"; do
    if [ -f "$SCRIPTS_DIR/$script" ]; then
        echo "  ✅ $script"
    fi
done

echo ""
echo "Archiving all other scripts..."

ARCHIVED=0
for file in "$SCRIPTS_DIR"/*.sh "$SCRIPTS_DIR"/*.js "$SCRIPTS_DIR"/*.py "$SCRIPTS_DIR"/README.md; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        # Check if it's in the keep list
        KEEP_IT=false
        for keep_script in "${SCRIPTS_TO_KEEP[@]}"; do
            if [ "$filename" = "$keep_script" ]; then
                KEEP_IT=true
                break
            fi
        done
        
        if [ "$KEEP_IT" = false ]; then
            echo "  Archiving: $filename"
            mv "$file" "$BACKUP_DIR/"
            ARCHIVED=$((ARCHIVED + 1))
        fi
    fi
done

echo ""
echo "✅ Scripts cleanup complete!"
echo ""
echo "Archived $ARCHIVED files to: $BACKUP_DIR"
echo ""
echo "Remaining scripts (deployment only):"
ls -1 "$SCRIPTS_DIR"/*.sh 2>/dev/null | wc -l || echo "0"
echo ""
echo "Kept scripts:"
ls -1 "$SCRIPTS_DIR"/*.sh 2>/dev/null

