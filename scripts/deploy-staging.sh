#!/bin/bash
# Deploy staging via CI/CD (GitHub Actions)
# This script pushes to staging branch and watches the deployment logs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying to Staging via CI/CD${NC}"
echo ""

# Check if we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo -e "${BLUE}📍 Current branch: ${CURRENT_BRANCH}${NC}"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: You have uncommitted changes!${NC}"
    echo "   These will NOT be deployed. Only committed changes will be pushed."
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Deployment cancelled."
        exit 1
    fi
fi

# Determine deployment mode
DEPLOY_FROM_CURRENT_BRANCH=false

if [ "$CURRENT_BRANCH" != "staging" ]; then
    echo -e "${YELLOW}⚠️  You're on '$CURRENT_BRANCH', not 'staging'${NC}"
    echo "   Options:"
    echo "   1. Deploy directly from '$CURRENT_BRANCH' (without merging to staging)"
    echo "   2. Switch to staging branch and merge your changes"
    read -p "   Deploy from current branch? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        DEPLOY_FROM_CURRENT_BRANCH=true
        echo -e "${BLUE}✅ Will deploy from '$CURRENT_BRANCH' branch${NC}"
    else
        # Stash any uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            echo "   Stashing uncommitted changes..."
            git stash
            STASHED=true
        fi
        
        # Switch to staging
        git checkout staging 2>/dev/null || git checkout -b staging
        
        # Merge current branch into staging
        if [ "$CURRENT_BRANCH" != "staging" ]; then
            echo "   Merging $CURRENT_BRANCH into staging..."
            git merge "$CURRENT_BRANCH" --no-edit || {
                echo -e "${RED}❌ Merge conflict! Please resolve manually.${NC}"
                [ "$STASHED" = true ] && git stash pop
                exit 1
            }
        fi
        
        # Restore stashed changes
        [ "$STASHED" = true ] && git stash pop
    fi
fi

# Check GitHub CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) not found!${NC}"
    echo ""
    echo "   Install it:"
    echo "   • Ubuntu/Debian: sudo apt install gh"
    echo "   • Or: https://cli.github.com/"
    exit 1
fi

# Check GitHub CLI version (need 2.0+ for 'gh run' commands)
GH_VERSION=$(gh version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "0.0.0")
if [ -z "$GH_VERSION" ] || [ "$GH_VERSION" = "0.0.0" ]; then
    echo -e "${YELLOW}⚠️  Could not determine GitHub CLI version${NC}"
    echo "   Attempting to use anyway..."
else
    echo -e "${BLUE}📦 GitHub CLI version: $GH_VERSION${NC}"
fi

# Check GitHub CLI authentication
echo -e "${BLUE}🔐 Checking GitHub authentication...${NC}"
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI not authenticated${NC}"
    echo ""
    echo "   Starting authentication process..."
    echo "   (This will open a browser or prompt for token)"
    echo ""
    if gh auth login; then
        echo -e "${GREEN}✅ Authentication successful!${NC}"
    else
        echo -e "${RED}❌ Authentication failed${NC}"
        echo ""
        echo "   You can authenticate manually:"
        echo "   gh auth login"
        echo ""
        echo "   Or use a token:"
        echo "   gh auth login --with-token < token.txt"
        exit 1
    fi
else
    echo -e "${GREEN}✅ GitHub CLI authenticated${NC}"
fi

echo -e "${GREEN}✅ GitHub CLI ready${NC}"
echo ""

# Get remote URL to check repo
REPO=$(git remote get-url origin 2>/dev/null | sed -E 's/.*github.com[:/]([^/]+\/[^/]+)(\.git)?$/\1/')
echo -e "${BLUE}📦 Repository: $REPO${NC}"

# Deploy based on mode
RUN_ID=""
RUN_URL=""

if [ "$DEPLOY_FROM_CURRENT_BRANCH" = true ]; then
    # Deploy from current branch using workflow_dispatch
    echo ""
    echo -e "${BLUE}📤 Pushing '$CURRENT_BRANCH' branch to remote...${NC}"
    if ! git push origin "$CURRENT_BRANCH" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Branch '$CURRENT_BRANCH' not on remote yet, pushing...${NC}"
        git push -u origin "$CURRENT_BRANCH" || {
            echo -e "${RED}❌ Push failed!${NC}"
            exit 1
        }
    fi
    echo -e "${GREEN}✅ Push successful!${NC}"
    
    echo ""
    echo -e "${BLUE}🚀 Triggering workflow for branch '$CURRENT_BRANCH'...${NC}"
    
    # Trigger workflow with branch parameter
    if gh workflow run deploy-staging.yml --ref "$CURRENT_BRANCH" -f branch="$CURRENT_BRANCH" 2>/dev/null; then
        echo -e "${GREEN}✅ Workflow triggered!${NC}"
    else
        echo -e "${RED}❌ Failed to trigger workflow${NC}"
        echo "   Make sure you have permission to trigger workflows"
        exit 1
    fi
    
    # Wait a moment for workflow to start
    echo ""
    echo -e "${BLUE}⏳ Waiting for workflow to start...${NC}"
    sleep 5
    
    # Get the latest workflow run
    echo ""
    echo -e "${BLUE}🔍 Finding workflow run...${NC}"
    
    if gh run list --workflow=deploy-staging.yml --help &> /dev/null; then
        MAX_WAIT=30
        WAIT_COUNT=0
        
        while [ -z "$RUN_ID" ] && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
            RUN_ID=$(gh run list --workflow=deploy-staging.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")
            if [ -z "$RUN_ID" ]; then
                sleep 2
                WAIT_COUNT=$((WAIT_COUNT + 2))
                echo -n "."
            fi
        done
        echo ""
    fi
else
    # Traditional deployment: push to staging branch
    echo ""
    echo -e "${BLUE}📤 Pushing to staging branch...${NC}"
    if git push origin staging; then
        echo -e "${GREEN}✅ Push successful!${NC}"
    else
        echo -e "${RED}❌ Push failed!${NC}"
        exit 1
    fi
    
    # Wait a moment for GitHub to register the push
    echo ""
    echo -e "${BLUE}⏳ Waiting for workflow to start...${NC}"
    sleep 5
    
    # Get the latest workflow run
    echo ""
    echo -e "${BLUE}🔍 Finding workflow run...${NC}"
    
    if gh run list --workflow=deploy-staging.yml --help &> /dev/null; then
        MAX_WAIT=30
        WAIT_COUNT=0
        
        while [ -z "$RUN_ID" ] && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
            RUN_ID=$(gh run list --workflow=deploy-staging.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")
            if [ -z "$RUN_ID" ]; then
                sleep 2
                WAIT_COUNT=$((WAIT_COUNT + 2))
                echo -n "."
            fi
        done
        echo ""
    fi
fi

# Watch the workflow run
if [ -n "$RUN_ID" ]; then
    RUN_URL="https://github.com/$REPO/actions/runs/$RUN_ID"
    echo -e "${GREEN}✅ Found workflow run: $RUN_ID${NC}"
    echo ""
    echo -e "${BLUE}📊 Watching deployment logs...${NC}"
    echo -e "${BLUE}   (Press Ctrl+C to stop watching, but deployment will continue)${NC}"
    echo ""
    
    # Try to watch the logs
    if gh run watch "$RUN_ID" 2>/dev/null; then
        # Successfully watched
        :
    else
        echo ""
        echo -e "${YELLOW}⚠️  Could not watch logs in real-time${NC}"
        echo "   View logs at: $RUN_URL"
    fi
else
    echo -e "${YELLOW}⚠️  Could not find workflow run automatically${NC}"
    RUN_URL="https://github.com/$REPO/actions"
fi

# Get final status
echo ""
echo -e "${BLUE}📋 Checking final status...${NC}"

if [ -n "$RUN_ID" ] && gh run view --help &> /dev/null; then
    STATUS=$(gh run view "$RUN_ID" --json conclusion --jq '.conclusion' 2>/dev/null || echo "unknown")
else
    STATUS="unknown"
    echo -e "${YELLOW}⚠️  Could not check status automatically${NC}"
    echo "   Please check manually at: $RUN_URL"
fi

if [ "$STATUS" = "success" ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo -e "${GREEN}🌐 Staging API: https://staging-api.myphonefriend.com${NC}"
    echo -e "${GREEN}🌐 Staging Frontend: https://staging.myphonefriend.com${NC}"
    echo -e "${GREEN}📊 PostHog Analytics: https://staging-analytics.myphonefriend.com${NC}"
    if [ -n "$RUN_URL" ]; then
        echo -e "${BLUE}📋 Workflow logs: $RUN_URL${NC}"
    fi
    exit 0
elif [ "$STATUS" = "failure" ] || [ "$STATUS" = "cancelled" ]; then
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo ""
    if [ -n "$RUN_URL" ]; then
        echo "   View full logs: $RUN_URL"
    else
        echo "   View full logs: https://github.com/$REPO/actions"
    fi
    if [ -n "$RUN_ID" ] && gh run view --help &> /dev/null; then
        echo "   Or run: gh run view $RUN_ID --log"
    fi
    exit 1
else
    echo -e "${YELLOW}⚠️  Deployment status: $STATUS${NC}"
    if [ -n "$RUN_URL" ]; then
        echo "   View logs: $RUN_URL"
    else
        echo "   View logs: https://github.com/$REPO/actions"
    fi
    echo ""
    echo -e "${BLUE}💡 Tip: Check the workflow status in your browser${NC}"
    echo "   $RUN_URL"
    exit 0
fi

