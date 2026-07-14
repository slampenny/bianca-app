#!/bin/bash
# BeforeInstall hook - Create docker-compose.yml and nginx.conf

# Don't use set -e - we want to capture and report errors properly
set +e

echo "🧹 BeforeInstall: Setting up docker-compose.yml and nginx.conf..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/resolve-aws-region.sh"
echo "   Using AWS region: $AWS_REGION"

# Enable maintenance mode at the start of deployment
if [ -f "/opt/bianca-deployment/devops/maintenance/enable-maintenance.sh" ]; then
    echo "   Enabling maintenance mode..."
    bash /opt/bianca-deployment/devops/maintenance/enable-maintenance.sh || {
        echo "   ⚠️  Could not enable maintenance mode, continuing anyway..."
    }
fi

# Detect environment - check environment variables first, then directories, then instance tags

echo "   Detecting environment..."

# Method 1: Check /etc/environment file first (set by userdata)
# CodeDeploy scripts don't automatically source /etc/environment, so read it directly
if [ -f "/etc/environment" ]; then
  ENV_FROM_FILE=$(grep "^ENVIRONMENT=" /etc/environment 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
  # Normalize to lowercase for comparison, but preserve original for use
  ENV_FROM_FILE_LOWER=$(echo "$ENV_FROM_FILE" | tr '[:upper:]' '[:lower:]')
  if [ -n "$ENV_FROM_FILE" ]; then
    echo "   ✅ Found ENVIRONMENT in /etc/environment: $ENV_FROM_FILE"
    # Use lowercase for detection logic
    DETECTED_ENV="$ENV_FROM_FILE_LOWER"
  fi
fi

# Method 2: Check environment variables (if not already set from /etc/environment)
# These can be set via userdata, /etc/environment, or manually
if [ -z "$DETECTED_ENV" ]; then
  if [ -n "$ENVIRONMENT" ]; then
    echo "   ✅ Found ENVIRONMENT variable: $ENVIRONMENT"
    DETECTED_ENV="$ENVIRONMENT"
  elif [ -n "$DEPLOYMENT_ENVIRONMENT" ]; then
    echo "   ✅ Found DEPLOYMENT_ENVIRONMENT variable: $DEPLOYMENT_ENVIRONMENT"
    DETECTED_ENV="$DEPLOYMENT_ENVIRONMENT"
  elif [ -n "$NODE_ENV" ] && [ "$NODE_ENV" != "test" ]; then
    # NODE_ENV can indicate environment, but ignore "test" as that's for test runs
    echo "   ✅ Found NODE_ENV variable: $NODE_ENV"
    DETECTED_ENV="$NODE_ENV"
  fi
fi

# If we detected an environment from variables, use it
# Normalize DETECTED_ENV to lowercase for comparison
if [ -n "$DETECTED_ENV" ]; then
  DETECTED_ENV_LOWER=$(echo "$DETECTED_ENV" | tr '[:upper:]' '[:lower:]')
  if [ "$DETECTED_ENV_LOWER" = "production" ]; then
    ENVIRONMENT="production"
    DEPLOY_DIR="/opt/bianca-production"
    CONTAINER_PREFIX="production"
    IMAGE_TAG="production"
    NODE_ENV="production"
    API_BASE_URL="https://api.biancawellness.com"
    WEBSOCKET_URL="wss://api.biancawellness.com"
    FRONTEND_URL="https://app.biancawellness.com"
    SERVER_NAME_FRONTEND="app.biancawellness.com"
    SERVER_NAME_API="api.biancawellness.com"
    YARN_COMMAND="yarn start"
    CLOUDWATCH_LOG_PREFIX="/bianca/production"
  elif [ "$DETECTED_ENV_LOWER" = "staging" ]; then
    ENVIRONMENT="staging"
    DEPLOY_DIR="/opt/bianca-staging"
    CONTAINER_PREFIX="staging"
    IMAGE_TAG="staging"
    NODE_ENV="staging"
    API_BASE_URL="https://staging-api.biancawellness.com"
    WEBSOCKET_URL="wss://staging-api.biancawellness.com"
    FRONTEND_URL="https://staging.biancawellness.com"
    SERVER_NAME_FRONTEND="staging.biancawellness.com"
    SERVER_NAME_API="staging-api.biancawellness.com"
    YARN_COMMAND="yarn start"
    CLOUDWATCH_LOG_PREFIX="/bianca/staging"
  elif [ "$DETECTED_ENV_LOWER" = "demo" ]; then
    ENVIRONMENT="demo"
    DEPLOY_DIR="/opt/bianca-demo"
    CONTAINER_PREFIX="demo"
    IMAGE_TAG="production"  # Demo uses production images
    NODE_ENV="production"  # Demo uses production mode
    API_BASE_URL="https://demo.biancawellness.com/v1"
    WEBSOCKET_URL="wss://demo.biancawellness.com/v1"
    FRONTEND_URL="https://demo.biancawellness.com"
    SERVER_NAME_FRONTEND="demo.biancawellness.com"
    SERVER_NAME_API="demo.biancawellness.com"
    YARN_COMMAND="yarn start"  # Demo uses production mode
    CLOUDWATCH_LOG_PREFIX="/bianca/demo"
  else
    echo "   ⚠️  Unknown environment from variables: $DETECTED_ENV, falling back to other methods..."
    DETECTED_ENV=""
  fi
fi

# Method 2: Check which deployment directory exists (if not already set from env vars)
if [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-production" ]; then
  echo "   ✅ Found /opt/bianca-production directory - using production"
  ENVIRONMENT="production"
  DEPLOY_DIR="/opt/bianca-production"
  CONTAINER_PREFIX="production"
  IMAGE_TAG="production"
  NODE_ENV="production"
  API_BASE_URL="https://api.biancawellness.com"
  WEBSOCKET_URL="wss://api.biancawellness.com"
  FRONTEND_URL="https://app.biancawellness.com"
  SERVER_NAME_FRONTEND="app.biancawellness.com"
  SERVER_NAME_API="api.biancawellness.com"
  YARN_COMMAND="yarn start"
  CLOUDWATCH_LOG_PREFIX="/bianca/production"
elif [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-staging" ]; then
  echo "   ✅ Found /opt/bianca-staging directory - using staging"
  ENVIRONMENT="staging"
  DEPLOY_DIR="/opt/bianca-staging"
  CONTAINER_PREFIX="staging"
  IMAGE_TAG="staging"
  # CRITICAL: Set NODE_ENV=staging for staging deployment (NOT test!)
  # Tests run with NODE_ENV=test in the RunTests CodeBuild stage
  NODE_ENV="staging"
  API_BASE_URL="https://staging-api.biancawellness.com"
  WEBSOCKET_URL="wss://staging-api.biancawellness.com"
  FRONTEND_URL="https://staging.biancawellness.com"
  SERVER_NAME_FRONTEND="staging.biancawellness.com"
  SERVER_NAME_API="staging-api.biancawellness.com"
  YARN_COMMAND="yarn start"
  CLOUDWATCH_LOG_PREFIX="/bianca/staging"
elif [ -z "$DETECTED_ENV" ] && [ -d "/opt/bianca-demo" ]; then
  echo "   ✅ Found /opt/bianca-demo directory - using demo"
  ENVIRONMENT="demo"
  DEPLOY_DIR="/opt/bianca-demo"
  CONTAINER_PREFIX="demo"
  IMAGE_TAG="production"  # Demo uses production images
  NODE_ENV="production"  # Demo uses production mode
  API_BASE_URL="https://demo.biancawellness.com/v1"
  WEBSOCKET_URL="wss://demo.biancawellness.com/v1"
  FRONTEND_URL="https://demo.biancawellness.com"
  SERVER_NAME_FRONTEND="demo.biancawellness.com"
  SERVER_NAME_API="demo.biancawellness.com"
  YARN_COMMAND="yarn start"  # Demo uses production mode
  CLOUDWATCH_LOG_PREFIX="/bianca/demo"
elif [ -z "$DETECTED_ENV" ]; then
  # Fallback: Try to get instance tags (may fail due to permissions)
  echo "   ⚠️  No deployment directory found, trying instance tags..."
  INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")
  
  # Try to get tags using instance metadata (more reliable than AWS CLI)
  # First try instance metadata tags endpoint (available on newer instances)
  INSTANCE_NAME=""
  ENVIRONMENT_TAG=""
  
  # Try instance metadata tags endpoint (preferred method)
  # Filter out HTML error responses (404 pages)
  if [ -n "$INSTANCE_ID" ]; then
    INSTANCE_NAME_RAW=$(curl -s http://169.254.169.254/latest/meta-data/tags/instance/Name 2>/dev/null || echo "")
    ENVIRONMENT_TAG_RAW=$(curl -s http://169.254.169.254/latest/meta-data/tags/instance/Environment 2>/dev/null || echo "")
    
    # Filter out HTML responses (check if response contains HTML tags)
    if [ -n "$INSTANCE_NAME_RAW" ] && ! echo "$INSTANCE_NAME_RAW" | grep -q "<html\|<!DOCTYPE"; then
      INSTANCE_NAME="$INSTANCE_NAME_RAW"
    fi
    if [ -n "$ENVIRONMENT_TAG_RAW" ] && ! echo "$ENVIRONMENT_TAG_RAW" | grep -q "<html\|<!DOCTYPE"; then
      ENVIRONMENT_TAG="$ENVIRONMENT_TAG_RAW"
    fi
  fi
  
  # Fallback to AWS CLI if metadata tags not available
  if [ -z "$INSTANCE_NAME" ] && [ -z "$ENVIRONMENT_TAG" ] && [ -n "$INSTANCE_ID" ]; then
    INSTANCE_NAME=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "")
    ENVIRONMENT_TAG=$(aws ec2 describe-instances --region $AWS_REGION --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].Tags[?Key==`Environment`].Value' --output text 2>/dev/null || echo "")
  fi
  
  echo "   Instance ID: $INSTANCE_ID"
  if [ -n "$INSTANCE_NAME" ]; then
    echo "   Instance Name tag: $INSTANCE_NAME"
  else
    echo "   Instance Name tag: (not available)"
  fi
  if [ -n "$ENVIRONMENT_TAG" ]; then
    echo "   Environment tag: $ENVIRONMENT_TAG"
  else
    echo "   Environment tag: (not available)"
  fi
  
  if [ "$ENVIRONMENT_TAG" = "production" ] || echo "$INSTANCE_NAME" | grep -qi "production"; then
    echo "   ✅ Detected production from tags"
    ENVIRONMENT="production"
    DEPLOY_DIR="/opt/bianca-production"
    CONTAINER_PREFIX="production"
    IMAGE_TAG="production"
    NODE_ENV="production"
    API_BASE_URL="https://api.biancawellness.com"
    WEBSOCKET_URL="wss://api.biancawellness.com"
    FRONTEND_URL="https://app.biancawellness.com"
    SERVER_NAME_FRONTEND="app.biancawellness.com"
    SERVER_NAME_API="api.biancawellness.com"
    YARN_COMMAND="yarn start"
    CLOUDWATCH_LOG_PREFIX="/bianca/production"
  elif [ "$ENVIRONMENT_TAG" = "staging" ] || echo "$INSTANCE_NAME" | grep -qi "staging"; then
    echo "   ✅ Detected staging from tags"
    ENVIRONMENT="staging"
    DEPLOY_DIR="/opt/bianca-staging"
    CONTAINER_PREFIX="staging"
    IMAGE_TAG="staging"
    NODE_ENV="staging"
    API_BASE_URL="https://staging-api.biancawellness.com"
    WEBSOCKET_URL="wss://staging-api.biancawellness.com"
    FRONTEND_URL="https://staging.biancawellness.com"
    SERVER_NAME_FRONTEND="staging.biancawellness.com"
    SERVER_NAME_API="staging-api.biancawellness.com"
    YARN_COMMAND="yarn start"
    CLOUDWATCH_LOG_PREFIX="/bianca/staging"
  elif [ "$ENVIRONMENT_TAG" = "demo" ] || echo "$INSTANCE_NAME" | grep -qi "demo"; then
    echo "   ✅ Detected demo from tags"
    ENVIRONMENT="demo"
    DEPLOY_DIR="/opt/bianca-demo"
    CONTAINER_PREFIX="demo"
    IMAGE_TAG="production"  # Demo uses production images
    NODE_ENV="production"  # Demo uses production mode
    API_BASE_URL="https://demo.biancawellness.com/v1"
    WEBSOCKET_URL="wss://demo.biancawellness.com/v1"
    FRONTEND_URL="https://demo.biancawellness.com"
    SERVER_NAME_FRONTEND="demo.biancawellness.com"
    SERVER_NAME_API="demo.biancawellness.com"
    YARN_COMMAND="yarn start"  # Demo uses production mode
    CLOUDWATCH_LOG_PREFIX="/bianca/demo"
  else
    echo "   ❌ CRITICAL ERROR: Cannot determine environment"
    echo "   Environment variables, deployment directories, and instance tags all unavailable"
    echo ""
    echo "   Debug information:"
    echo "   - Instance ID: ${INSTANCE_ID:-not available}"
    echo "   - Instance Name tag: ${INSTANCE_NAME:-not available}"
    echo "   - Environment Tag: ${ENVIRONMENT_TAG:-not available}"
    echo "   - ENVIRONMENT variable: ${ENVIRONMENT:-not set}"
    echo "   - DEPLOYMENT_ENVIRONMENT variable: ${DEPLOYMENT_ENVIRONMENT:-not set}"
    echo "   - NODE_ENV variable: ${NODE_ENV:-not set}"
    if [ -f "/etc/environment" ]; then
      echo "   - /etc/environment exists, contents:"
      grep -i environment /etc/environment 2>/dev/null || echo "      (no ENVIRONMENT found in /etc/environment)"
    else
      echo "   - /etc/environment: (file does not exist)"
    fi
    echo "   - Deployment directories:"
    [ -d "/opt/bianca-production" ] && echo "     ✅ /opt/bianca-production exists" || echo "     ❌ /opt/bianca-production does not exist"
    [ -d "/opt/bianca-staging" ] && echo "     ✅ /opt/bianca-staging exists" || echo "     ❌ /opt/bianca-staging does not exist"
    echo ""
    echo "   This deployment will FAIL to prevent misconfiguration."
    echo "   Please ensure one of the following:"
    echo "   1. /etc/environment contains ENVIRONMENT=staging or ENVIRONMENT=production (set by userdata)"
    echo "   2. Set ENVIRONMENT, DEPLOYMENT_ENVIRONMENT, or NODE_ENV environment variable"
    echo "   3. The deployment directory (/opt/bianca-production or /opt/bianca-staging) exists"
    echo "   4. Instance tags (Name and Environment) are properly set"
    echo "   5. The instance has IAM permissions to read its own tags"
    echo ""
    echo "   For staging: /opt/bianca-staging should exist or ENVIRONMENT=staging in /etc/environment"
    echo "   For production: /opt/bianca-production should exist or ENVIRONMENT=production in /etc/environment"
    exit 1
  fi
fi

# Final safety check - ensure ENVIRONMENT is set
if [ -z "$ENVIRONMENT" ]; then
  echo "   ❌ CRITICAL ERROR: Environment detection failed - ENVIRONMENT is not set"
  echo "   This should not happen - all detection methods failed"
  exit 1
fi

echo "   ✅ Detected environment: $ENVIRONMENT"
echo "   ✅ Deployment directory: $DEPLOY_DIR"
echo "   ✅ Container prefix: $CONTAINER_PREFIX"
echo "   ✅ Image tag: $IMAGE_TAG"


# Shared secrets + compose + nginx generation (also used by yarn staging:deploy via SSM)
REGEN=""
for candidate in \
  "$SCRIPT_DIR/regenerate-host-stack.sh" \
  "$SCRIPT_DIR/../../scripts/regenerate-host-stack.sh" \
  "/opt/bianca-deployment/scripts/regenerate-host-stack.sh"; do
  if [ -f "$candidate" ]; then
    REGEN="$candidate"
    break
  fi
done

if [ -z "$REGEN" ]; then
  echo "❌ ERROR: regenerate-host-stack.sh not found next to before_install or under devops/scripts" >&2
  exit 1
fi

echo "   Running shared regenerate-host-stack.sh from $REGEN"
export ENVIRONMENT
export AWS_REGION
export DEPLOY_GIT_SHA="${DEPLOY_GIT_SHA:-}"
if ! bash "$REGEN"; then
  echo "❌ ERROR: regenerate-host-stack.sh failed" >&2
  exit 1
fi

echo "✅ BeforeInstall completed"
