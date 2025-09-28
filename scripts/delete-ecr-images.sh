#!/bin/bash

# Simple ECR Image Deletion Script
set -e

echo "🧹 Deleting ECR Untagged Images"
echo "==============================="

# Function to delete images from a repository
delete_repo_images() {
    local repo_name=$1
    echo "🗑️  Processing $repo_name..."
    
    # Get untagged images
    local images=$(aws ecr list-images --repository-name "$repo_name" --filter tagStatus=UNTAGGED --query 'imageIds[*].imageDigest' --output text --profile jordan)
    
    if [ -z "$images" ] || [ "$images" = "None" ]; then
        echo "✅ No untagged images in $repo_name"
        return 0
    fi
    
    local count=0
    echo "$images" | tr '\t' '\n' | while read -r digest; do
        if [ -n "$digest" ]; then
            echo "Deleting: ${digest:0:20}..."
            aws ecr batch-delete-image --repository-name "$repo_name" --image-ids "[{\"imageDigest\":\"$digest\"}]" --profile jordan >/dev/null
            count=$((count + 1))
        fi
    done
    
    local total_count=$(echo "$images" | wc -w)
    echo "✅ Deleted $total_count images from $repo_name"
}

# Delete from both repositories
delete_repo_images "bianca-app-backend"
delete_repo_images "bianca-app-frontend"

echo ""
echo "🎉 ECR cleanup complete!"
