#!/bin/bash

# Simple ECR Cleanup Script
# Uses AWS CLI's built-in capabilities

set -e

echo "🧹 Simple ECR Cleanup"
echo "===================="

# Function to clean up a repository
cleanup_repo() {
    local repo_name=$1
    echo "Cleaning up $repo_name..."
    
    # Get untagged images and delete them directly
    local untagged_images=$(aws ecr list-images --repository-name "$repo_name" --filter tagStatus=UNTAGGED --query 'imageIds[*].imageDigest' --output text --profile jordan)
    
    if [ -z "$untagged_images" ] || [ "$untagged_images" = "None" ]; then
        echo "✅ No untagged images found in $repo_name"
        return 0
    fi
    
    # Count images
    local count=$(echo "$untagged_images" | wc -w)
    echo "🗑️  Found $count untagged images in $repo_name"
    
    # Delete all untagged images using AWS CLI's batch delete with file input
    echo "$untagged_images" | tr ' ' '\n' | while read -r digest; do
        if [ -n "$digest" ]; then
            echo "{\"imageDigest\":\"$digest\"}"
        fi
    done > /tmp/ecr_images.json
    
    # Use AWS CLI to batch delete
    aws ecr batch-delete-image \
        --repository-name "$repo_name" \
        --image-ids file:///tmp/ecr_images.json \
        --profile jordan
    
    # Clean up temp file
    rm -f /tmp/ecr_images.json
    
    echo "✅ Successfully deleted $count images from $repo_name"
}

# Clean up both repositories
cleanup_repo "bianca-app-backend"
cleanup_repo "bianca-app-frontend"

echo ""
echo "🎉 ECR cleanup complete!"
