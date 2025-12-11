#!/bin/bash
# Script to remove credentials/google.api.json from git history

set -e

echo "🔒 Removing credentials/google.api.json from git history..."
echo ""

# Check if git-filter-repo is installed
GIT_FILTER_REPO=""
if command -v git-filter-repo &> /dev/null; then
  GIT_FILTER_REPO="git-filter-repo"
elif python3 -m git_filter_repo &> /dev/null; then
  GIT_FILTER_REPO="python3 -m git_filter_repo"
elif [ -f ~/.local/bin/git-filter-repo ]; then
  GIT_FILTER_REPO="$HOME/.local/bin/git-filter-repo"
else
  echo "⚠️  git-filter-repo not found. Installing..."
  pip3 install --user git-filter-repo || {
    echo "❌ Failed to install git-filter-repo"
    echo "Please install it manually: pip3 install --user git-filter-repo"
    exit 1
  }
  if [ -f ~/.local/bin/git-filter-repo ]; then
    GIT_FILTER_REPO="$HOME/.local/bin/git-filter-repo"
  elif command -v git-filter-repo &> /dev/null; then
    GIT_FILTER_REPO="git-filter-repo"
  else
    GIT_FILTER_REPO="python3 -m git_filter_repo"
  fi
fi

echo "✅ Using: $GIT_FILTER_REPO"
echo ""

# Create backup branch
BACKUP_BRANCH="backup-before-remove-google-creds-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
echo "✅ Created backup branch: $BACKUP_BRANCH"
echo ""

# Remove the file from all commits
echo "Removing credentials/google.api.json from history..."
$GIT_FILTER_REPO --path credentials/google.api.json --invert-paths --force

echo ""
echo "✅ File removed from history"
echo ""
echo "⚠️  IMPORTANT: You must force push to update remote:"
echo "   git push --force-with-lease origin staging"
echo "   git push --force-with-lease origin main"
echo ""
echo "⚠️  Also: Rotate the service account key in Google Cloud Console!"
echo "   The key has been disabled by Google, so you need to create a new one."

