#!/bin/bash

# ECR Image Cleanup Script
# This script removes untagged images from ECR repositories to save storage costs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check for dry-run flag
DRY_RUN=false
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            echo "🔍 DRY RUN MODE - No images will be deleted"
            ;;
        --help)
            echo "Usage: $0 [--dry-run]"
            echo "  --dry-run: Show what would be deleted without actually deleting"
            exit 0
            ;;
    esac
done

echo "🧹 ECR Image Cleanup Script"
echo "=========================="

# Check AWS credentials
if ! aws sts get-caller-identity --profile jordan >/dev/null 2>&1; then
    print_error "AWS credentials not valid or expired. Please run 'aws configure' or 'aws sso login'"
    exit 1
fi

print_success "AWS credentials are valid"

# Function to clean up untagged images for a repository
cleanup_repository() {
    local repo_name=$1
    print_status "Cleaning up repository: $repo_name"
    
    # Get list of untagged images
    local untagged_images=$(aws ecr list-images --repository-name "$repo_name" --filter tagStatus=UNTAGGED --query 'imageIds[*].imageDigest' --output text --profile jordan)
    
    if [ -z "$untagged_images" ]; then
        print_success "No untagged images found in $repo_name"
        return 0
    fi
    
    # Count images
    local image_count=$(echo "$untagged_images" | wc -w)
    print_warning "Found $image_count untagged images in $repo_name"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "DRY RUN: Would delete $image_count images from $repo_name"
        echo "$untagged_images" | tr ' ' '\n' | head -5 | while read -r digest; do
            if [ -n "$digest" ]; then
                echo "  - $digest"
            fi
        done
        if [ "$image_count" -gt 5 ]; then
            echo "  ... and $((image_count - 5)) more"
        fi
    else
        # Delete untagged images
        print_status "Deleting $image_count untagged images from $repo_name..."
        
        # Delete images in batches of 10 to avoid API limits
        local batch_size=10
        local deleted_count=0
        
        echo "$untagged_images" | tr ' ' '\n' | while read -r digest; do
            if [ -n "$digest" ]; then
                echo "{\"imageDigest\":\"$digest\"}"
            fi
        done > /tmp/ecr_images.json
        
        # Process in batches
        local batch_num=0
        while [ $((batch_num * batch_size)) -lt $image_count ]; do
            local start_idx=$((batch_num * batch_size))
            local end_idx=$((start_idx + batch_size))
            if [ $end_idx -gt $image_count ]; then
                end_idx=$image_count
            fi
            
            # Extract batch of images
            local batch_json=$(sed -n "${start_idx},${end_idx}p" /tmp/ecr_images.json | paste -sd ',' | sed 's/^/[/;s/$/]/')
            
            if [ -n "$batch_json" ] && [ "$batch_json" != "[]" ]; then
                print_status "Deleting batch $((batch_num + 1)) ($((end_idx - start_idx)) images)..."
                
                if aws ecr batch-delete-image --repository-name "$repo_name" --image-ids "$batch_json" --profile jordan >/dev/null 2>&1; then
                    deleted_count=$((deleted_count + end_idx - start_idx))
                else
                    print_error "Failed to delete batch $((batch_num + 1))"
                fi
            fi
            
            batch_num=$((batch_num + 1))
        done
        
        # Clean up temp file
        rm -f /tmp/ecr_images.json
        
        print_success "Successfully deleted $deleted_count images from $repo_name"
    fi
}

# Clean up both repositories
print_status "Starting cleanup of ECR repositories..."

cleanup_repository "bianca-app-backend"
cleanup_repository "bianca-app-frontend"

if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN COMPLETE - No images were actually deleted"
    echo ""
    echo "To actually delete the images, run:"
    echo "  $0"
else
    print_success "ECR cleanup complete!"
fi

echo ""
echo "💡 Tips:"
echo "  - Run with --dry-run first to see what would be deleted"
echo "  - This script only removes untagged images (safe to run)"
echo "  - Tagged images (staging, production, latest) are preserved"
echo "  - Consider running this monthly to keep costs down"
