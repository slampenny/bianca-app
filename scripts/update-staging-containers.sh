#!/bin/bash
# Quick script to update staging containers without rebuilding images
# This skips the build/push steps and just updates running containers

echo "🔄 Updating staging containers with existing images..."

# Get staging instance ID and IP
echo "⏳ Getting staging instance information..."
STAGING_INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-staging" --query 'Reservations[0].Instances[0].InstanceId' --output text --profile jordan --region us-east-2)

if [ -z "$STAGING_INSTANCE_ID" ] || [ "$STAGING_INSTANCE_ID" == "None" ]; then
    echo "❌ Staging instance not found. Please check Terraform deployment."
    exit 1
fi

echo "Found staging instance: $STAGING_INSTANCE_ID"

# Check instance state and start if stopped
INSTANCE_STATE=$(aws ec2 describe-instances --instance-ids "$STAGING_INSTANCE_ID" --query 'Reservations[0].Instances[0].State.Name' --output text --profile jordan --region us-east-2)
echo "Instance state: $INSTANCE_STATE"

if [ "$INSTANCE_STATE" == "stopped" ]; then
    echo "🔄 Starting stopped instance..."
    aws ec2 start-instances --instance-ids "$STAGING_INSTANCE_ID" --profile jordan --region us-east-2
    echo "⏳ Waiting for instance to start..."
    aws ec2 wait instance-running --instance-ids "$STAGING_INSTANCE_ID" --profile jordan --region us-east-2
    echo "✅ Instance started"
fi

# Wait for instance to be running
if [ "$INSTANCE_STATE" != "running" ]; then
    echo "Waiting for instance to reach running state..."
    aws ec2 wait instance-running --instance-ids "$STAGING_INSTANCE_ID" --profile jordan --region us-east-2 || true
fi

# Wait a bit more for public IP to be assigned
echo "Waiting for public IP assignment..."
sleep 10

# Get the public IP
STAGING_IP=$(aws ec2 describe-instances --instance-ids "$STAGING_INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan --region us-east-2)

# Retry if IP is not yet assigned
MAX_RETRIES=6
RETRY_COUNT=0
while [ -z "$STAGING_IP" ] || [ "$STAGING_IP" == "None" ] || [ "$STAGING_IP" == "null" ]; do
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Timeout waiting for staging instance IP"
        exit 1
    fi
    echo "Waiting for public IP... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep 10
    STAGING_IP=$(aws ec2 describe-instances --instance-ids "$STAGING_INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --profile jordan --region us-east-2)
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

# Skip SSH and use SSM directly (SSH port 22 is blocked on public WiFi)
echo "🔄 Using AWS Systems Manager (SSM) to execute commands..."
echo "   SSM works over HTTPS (port 443) which is rarely blocked"

# Check if SSM is available
SSM_STATUS=$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$STAGING_INSTANCE_ID" --profile jordan --region us-east-2 --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null)

if [ "$SSM_STATUS" == "Online" ]; then
    echo "✅ SSM is available - using SSM to execute commands"
    USE_SSM=true
else
    echo "❌ SSM is not available for this instance (Status: $SSM_STATUS)"
    echo "💡 Waiting a bit for SSM agent to come online..."
    sleep 10
    
    # Retry SSM check
    SSM_STATUS=$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$STAGING_INSTANCE_ID" --profile jordan --region us-east-2 --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null)
    
    if [ "$SSM_STATUS" == "Online" ]; then
        echo "✅ SSM is now available"
        USE_SSM=true
    else
        echo "❌ SSM is still not available"
        echo "💡 Possible issues:"
        echo "   1. SSM agent may not be running on the instance"
        echo "   2. Instance IAM role may not have SSM permissions"
        echo "   3. Instance may still be initializing"
        echo ""
        echo "   To check SSM status:"
        echo "   aws ssm describe-instance-information --filters \"Key=InstanceIds,Values=$STAGING_INSTANCE_ID\" --profile jordan --region us-east-2"
        echo ""
        echo "   To use SSM Session Manager:"
        echo "   aws ssm start-session --target $STAGING_INSTANCE_ID --profile jordan --region us-east-2"
        exit 1
    fi
fi

if [ -n "$STAGING_IP" ] && [ "$STAGING_IP" != "None" ] && [ "$STAGING_IP" != "null" ]; then
    echo "Updating containers on staging instance: $STAGING_IP"
    
    echo "ℹ️  Using docker-compose.yml created by instance userdata (contains AWS secrets)"
    
    # Prepare the commands to run
    DEPLOY_COMMANDS="
      cd /opt/bianca-staging
      
      # Login to ECR
      aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 730335291008.dkr.ecr.us-east-2.amazonaws.com
      
      # Create MongoDB data directory
      sudo mkdir -p /opt/mongodb-data && sudo chown 999:999 /opt/mongodb-data
      
      # Pull latest images (use only the userdata-created docker-compose.yml)
      docker-compose pull
      
      echo 'Stopping and removing application containers (preserving MongoDB)...'
      
      # Stop and remove only the application containers (not MongoDB)
      docker-compose stop app asterisk frontend nginx || true
      docker-compose rm -f app asterisk frontend nginx || true
      
      # Remove any orphaned containers with our project names (force remove by name)
      for container_name in staging_app staging_asterisk staging_frontend staging_nginx staging_bianca-app; do
        docker rm -f \$container_name 2>/dev/null || true
      done
      
      # Ensure MongoDB container name is free (in case of conflicts)
      if docker ps -a --filter 'name=staging_mongodb' --filter 'status=exited' | grep -q staging_mongodb; then
        echo 'Removing stopped MongoDB container to avoid name conflicts...'
        docker rm -f staging_mongodb 2>/dev/null || true
      fi
      
      # Also remove by filter pattern (in case names are slightly different)
      docker rm -f \$(docker ps -aq --filter 'name=staging_app') 2>/dev/null || true
      docker rm -f \$(docker ps -aq --filter 'name=staging_asterisk') 2>/dev/null || true
      docker rm -f \$(docker ps -aq --filter 'name=staging_frontend') 2>/dev/null || true
      docker rm -f \$(docker ps -aq --filter 'name=staging_nginx') 2>/dev/null || true
      docker rm -f \$(docker ps -aq --filter 'name=staging_bianca-app') 2>/dev/null || true
      docker rm -f \$(docker ps -aq --filter 'name=bianca-app') 2>/dev/null || true

      # Remove network if it exists (will be recreated)
      docker network rm bianca-staging_bianca-network 2>/dev/null || true

      # Show remaining staging containers for debugging
      echo 'Remaining staging containers (if any):'
      docker ps -a --format '{{.Names}}' | grep -E '^staging_' || true
      
      # Clean up unused images and networks
      docker image prune -f
      docker network prune -f
      
      echo 'Starting new containers...'
      
      # Check if MongoDB container already exists (running or stopped)
      if docker ps -aq --filter 'name=staging_mongodb' | grep -q .; then
        echo 'MongoDB container already exists...'
        docker rm -f staging_mongodb 2>/dev/null || true
        EXISTING_MONGODB=\$(docker ps -aq --filter 'name=staging_mongodb' | head -1)
        if [ -n \"\$EXISTING_MONGODB\" ]; then
          docker rm -f \"\$EXISTING_MONGODB\" 2>/dev/null || true
        fi
        echo 'Starting all containers (MongoDB will be recreated)...'
        docker-compose up -d
      else
        echo 'Starting all containers (including MongoDB)...'
        docker-compose up -d
      fi
      
      # Wait for MongoDB to be ready (up to 30 seconds)
      echo 'Waiting for MongoDB to be ready...'
      MAX_WAIT=30
      WAIT_COUNT=0
      while [ \$WAIT_COUNT -lt \$MAX_WAIT ]; do
        if docker exec staging_mongodb mongosh --eval 'db.adminCommand(\"ping\")' --quiet >/dev/null 2>&1; then
          echo '✅ MongoDB is ready'
          break
        fi
        NEXT_COUNT=\$((WAIT_COUNT + 1))
        echo \"Waiting for MongoDB... (\$NEXT_COUNT/\$MAX_WAIT seconds)\"
        sleep 2
        WAIT_COUNT=\$((WAIT_COUNT + 2))
      done
      
      if [ \$WAIT_COUNT -ge \$MAX_WAIT ]; then
        echo '⚠️  MongoDB may not be ready yet. Checking status...'
        docker ps | grep mongodb || echo 'MongoDB container not found in running containers'
        docker logs staging_mongodb --tail 30 2>/dev/null || echo 'Could not get MongoDB logs'
      fi
      
      # Show container status
      echo 'Container status:'
      docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'staging_|NAMES' || true
    "
    
    if [ "$USE_SSM" = true ]; then
        # For SSM, write the script to a file on the instance, then execute it
        # This avoids complex escaping issues
        echo "📤 Sending commands via SSM..."
        
        # First, write the script to a file on the instance
        SCRIPT_FILE="/tmp/deploy-$(date +%s).sh"
        echo "$DEPLOY_COMMANDS" > /tmp/local-deploy-script.sh
        
        # Upload the script using SSM (base64 encode and decode)
        SCRIPT_CONTENT=$(base64 -w 0 /tmp/local-deploy-script.sh)
        
        # Create a command that writes the script and executes it
        UPLOAD_AND_RUN="
          echo '$SCRIPT_CONTENT' | base64 -d > $SCRIPT_FILE
          chmod +x $SCRIPT_FILE
          bash $SCRIPT_FILE
          rm -f $SCRIPT_FILE
        "
        
        # Escape for JSON
        UPLOAD_AND_RUN_ESCAPED=$(echo "$UPLOAD_AND_RUN" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
        
        COMMAND_ID=$(aws ssm send-command \
            --instance-ids "$STAGING_INSTANCE_ID" \
            --document-name "AWS-RunShellScript" \
            --parameters "{\"commands\":[\"$UPLOAD_AND_RUN_ESCAPED\"]}" \
            --profile jordan \
            --region us-east-2 \
            --query 'Command.CommandId' \
            --output text 2>&1)
        
        rm -f /tmp/local-deploy-script.sh
        
        if [ -z "$COMMAND_ID" ] || echo "$COMMAND_ID" | grep -qi "error"; then
            echo "❌ Failed to send SSM command"
            echo "   Error: $COMMAND_ID"
            echo ""
            echo "💡 Alternative: Use SSM Session Manager to deploy manually:"
            echo "   aws ssm start-session --target $STAGING_INSTANCE_ID --profile jordan --region us-east-2"
            exit 1
        fi
        
        echo "⏳ Waiting for SSM command to complete (Command ID: $COMMAND_ID)..."
        # Wait for command to complete
        aws ssm wait command-executed \
            --command-id "$COMMAND_ID" \
            --instance-id "$STAGING_INSTANCE_ID" \
            --profile jordan \
            --region us-east-2
        
        # Get command output
        echo "📋 Command output:"
        aws ssm get-command-invocation \
            --command-id "$COMMAND_ID" \
            --instance-id "$STAGING_INSTANCE_ID" \
            --profile jordan \
            --region us-east-2 \
            --query '[StandardOutputContent, StandardErrorContent]' \
            --output text
        
        # Check exit status
        STATUS=$(aws ssm get-command-invocation \
            --command-id "$COMMAND_ID" \
            --instance-id "$STAGING_INSTANCE_ID" \
            --profile jordan \
            --region us-east-2 \
            --query 'Status' \
            --output text)
        
        if [ "$STATUS" != "Success" ]; then
            echo "❌ SSM command failed with status: $STATUS"
            exit 1
        fi
    else
        # Use SSH
        ssh $SSH_OPTS ec2-user@$STAGING_IP "$DEPLOY_COMMANDS"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Staging containers updated successfully!"
    else
        echo "❌ Failed to update staging containers"
        exit 1
    fi
else
    echo "❌ Could not get staging instance IP"
    exit 1
fi

