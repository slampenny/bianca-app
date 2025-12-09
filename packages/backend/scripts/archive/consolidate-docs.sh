#!/bin/bash
# Script to consolidate documentation from root docs/ to bianca-app-backend/docs/

set -e

ROOT_DOCS="docs"
BACKEND_DOCS="bianca-app-backend/docs"
BACKUP_DIR="docs-consolidation-backup-$(date +%Y%m%d)"

echo "=========================================="
echo "Documentation Consolidation"
echo "=========================================="
echo ""

# Create backup
echo "Creating backup..."
mkdir -p "$BACKUP_DIR"

# Function to safely move a file, avoiding duplicates
move_doc_safely() {
    local source="$1"
    local dest="$2"
    local filename=$(basename "$source")
    
    if [ -f "$dest" ]; then
        # File exists in destination, check if identical
        if diff -q "$source" "$dest" >/dev/null 2>&1; then
            echo "  ✓ $filename (identical, skipping)"
            return 0
        else
            # Different versions - keep newer or ask
            echo "  ⚠️  $filename (exists but different)"
            # For now, keep backend version and backup root version
            cp "$source" "$BACKUP_DIR/$filename.backup"
            return 1
        fi
    else
        # Safe to move
        mv "$source" "$dest"
        echo "  → Moved: $filename"
        return 0
    fi
}

echo ""
echo "Step 1: Organizing by category..."
echo ""

# Create category directories in backend docs
mkdir -p "$BACKEND_DOCS/hipaa"
mkdir -p "$BACKEND_DOCS/legal"
mkdir -p "$BACKEND_DOCS/deployment"
mkdir -p "$BACKEND_DOCS/technical"
mkdir -p "$BACKEND_DOCS/testing"
mkdir -p "$BACKEND_DOCS/organization"
mkdir -p "$BACKEND_DOCS/ai-system"

echo "Step 2: Moving HIPAA documentation..."
if [ -d "$ROOT_DOCS/hipaa" ]; then
    find "$ROOT_DOCS/hipaa" -name "*.md" -type f | while read file; do
        rel_path=${file#$ROOT_DOCS/hipaa/}
        dest_dir="$BACKEND_DOCS/hipaa/$(dirname "$rel_path")"
        mkdir -p "$dest_dir"
        dest="$BACKEND_DOCS/hipaa/$rel_path"
        
        if [ ! -f "$dest" ]; then
            mv "$file" "$dest"
            echo "  → Moved: hipaa/$rel_path"
        else
            echo "  ✓ hipaa/$rel_path (already exists)"
        fi
    done
fi

echo ""
echo "Step 3: Moving legal documentation..."
if [ -d "$ROOT_DOCS/legal" ]; then
    find "$ROOT_DOCS/legal" -name "*.md" -type f | while read file; do
        filename=$(basename "$file")
        dest="$BACKEND_DOCS/legal/$filename"
        
        if [ ! -f "$dest" ]; then
            mv "$file" "$dest"
            echo "  → Moved: legal/$filename"
        else
            echo "  ✓ legal/$filename (already exists)"
        fi
    done
fi

echo ""
echo "Step 4: Moving deployment documentation..."
if [ -d "$ROOT_DOCS/deployment" ]; then
    find "$ROOT_DOCS/deployment" -name "*.md" -type f | while read file; do
        filename=$(basename "$file")
        dest="$BACKEND_DOCS/deployment/$filename"
        
        if [ ! -f "$dest" ]; then
            mv "$file" "$dest"
            echo "  → Moved: deployment/$filename"
        else
            echo "  ✓ deployment/$filename (already exists)"
        fi
    done
fi

echo ""
echo "Step 5: Moving technical documentation (checking for duplicates)..."
if [ -d "$ROOT_DOCS/technical" ]; then
    find "$ROOT_DOCS/technical" -name "*.md" -type f | while read file; do
        filename=$(basename "$file")
        dest="$BACKEND_DOCS/technical/$filename"
        root_dest="$BACKEND_DOCS/$filename"
        
        # Check if already in backend docs root
        if [ -f "$root_dest" ]; then
            if diff -q "$file" "$root_dest" >/dev/null 2>&1; then
                echo "  ✓ $filename (identical, skipping)"
                rm "$file"
            else
                echo "  ⚠️  $filename (different version, keeping both)"
                mv "$file" "$dest"
            fi
        elif [ ! -f "$dest" ]; then
            mv "$file" "$dest"
            echo "  → Moved: technical/$filename"
        else
            echo "  ✓ technical/$filename (already exists)"
        fi
    done
fi

echo ""
echo "Step 6: Moving testing documentation..."
if [ -d "$ROOT_DOCS/testing" ]; then
    find "$ROOT_DOCS/testing" -name "*.md" -type f | while read file; do
        filename=$(basename "$file")
        dest="$BACKEND_DOCS/testing/$filename"
        root_dest="$BACKEND_DOCS/$filename"
        
        # Check if already in backend docs root
        if [ -f "$root_dest" ]; then
            if diff -q "$file" "$root_dest" >/dev/null 2>&1; then
                echo "  ✓ $filename (identical, skipping)"
                rm "$file"
            else
                echo "  ⚠️  $filename (different version, keeping both)"
                mv "$file" "$dest"
            fi
        elif [ ! -f "$dest" ]; then
            mv "$file" "$dest"
            echo "  → Moved: testing/$filename"
        else
            echo "  ✓ testing/$filename (already exists)"
        fi
    done
fi

echo ""
echo "Step 7: Moving organization documentation..."
if [ -d "$ROOT_DOCS/organization" ]; then
    find "$ROOT_DOCS/organization" -name "*.md" -type f | while read file; do
        rel_path=${file#$ROOT_DOCS/organization/}
        dest_dir="$BACKEND_DOCS/organization/$(dirname "$rel_path")"
        mkdir -p "$dest_dir"
        dest="$BACKEND_DOCS/organization/$rel_path"
        
        if [ ! -f "$dest" ]; then
            mv "$file" "$dest"
            echo "  → Moved: organization/$rel_path"
        else
            echo "  ✓ organization/$rel_path (already exists)"
        fi
    done
fi

echo ""
echo "Step 8: Moving AI system documentation..."
if [ -d "$ROOT_DOCS/ai-system" ]; then
    find "$ROOT_DOCS/ai-system" -name "*.md" -type f | while read file; do
        rel_path=${file#$ROOT_DOCS/ai-system/}
        dest_dir="$BACKEND_DOCS/ai-system/$(dirname "$rel_path")"
        mkdir -p "$dest_dir"
        dest="$BACKEND_DOCS/ai-system/$rel_path"
        
        if [ ! -f "$dest" ]; then
            mv "$file" "$dest"
            echo "  → Moved: ai-system/$rel_path"
        else
            echo "  ✓ ai-system/$rel_path (already exists)"
        fi
    done
fi

echo ""
echo "Step 9: Moving root README if different..."
if [ -f "$ROOT_DOCS/README.md" ]; then
    if [ -f "$BACKEND_DOCS/README.md" ]; then
        if ! diff -q "$ROOT_DOCS/README.md" "$BACKEND_DOCS/README.md" >/dev/null 2>&1; then
            echo "  ⚠️  README.md (different versions, keeping backend version)"
            cp "$ROOT_DOCS/README.md" "$BACKUP_DIR/README.md.backup"
        else
            echo "  ✓ README.md (identical)"
        fi
        rm "$ROOT_DOCS/README.md"
    else
        mv "$ROOT_DOCS/README.md" "$BACKEND_DOCS/README_ROOT.md"
        echo "  → Moved: README.md → README_ROOT.md"
    fi
fi

echo ""
echo "Step 10: Cleaning up empty directories..."
find "$ROOT_DOCS" -type d -empty -delete 2>/dev/null || true

echo ""
echo "✅ Consolidation complete!"
echo ""
echo "Summary:"
echo "  - All documentation moved to: $BACKEND_DOCS"
echo "  - Organized by category (hipaa, legal, deployment, etc.)"
echo "  - Backup created: $BACKUP_DIR"
echo ""
echo "Final structure:"
tree -L 2 "$BACKEND_DOCS" 2>/dev/null || find "$BACKEND_DOCS" -type f -name "*.md" | head -20

