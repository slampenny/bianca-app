#!/bin/bash
# Git History Migration Script
# Migrates history from packages/backend and packages/frontend into root monorepo
# Preserves main and staging branches only

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo -e "${BLUE}🚀 Starting Git history migration...${NC}"
echo ""

# Step 0: Get repository URLs first (before removing .git directories)
echo -e "${BLUE}Step 0: Getting repository URLs...${NC}"
cd "$ROOT_DIR"

BACKEND_REPO=""
FRONTEND_REPO=""

# Get backend repo URL (check if it's a submodule or has .git)
if [ -f "packages/backend/.git" ]; then
  # It's a submodule - get URL from .gitmodules or .git file
  BACKEND_REPO=$(git config -f .gitmodules --get submodule.packages/backend.url 2>/dev/null || \
    grep "url = " packages/backend/.git 2>/dev/null | sed 's/.*url = //' || echo "")
elif [ -d "packages/backend/.git" ]; then
  # It's a regular git repo
  cd "$ROOT_DIR/packages/backend"
  BACKEND_REPO=$(git remote get-url origin 2>/dev/null || echo "")
  cd "$ROOT_DIR"
fi

# Get frontend repo URL
if [ -f "packages/frontend/.git" ]; then
  # It's a submodule
  FRONTEND_REPO=$(git config -f .gitmodules --get submodule.packages/frontend.url 2>/dev/null || \
    grep "url = " packages/frontend/.git 2>/dev/null | sed 's/.*url = //' || echo "")
elif [ -d "packages/frontend/.git" ]; then
  # It's a regular git repo
  cd "$ROOT_DIR/packages/frontend"
  FRONTEND_REPO=$(git remote get-url origin 2>/dev/null || echo "")
  cd "$ROOT_DIR"
fi

# If we couldn't get URLs from submodules, try to get them from known remotes
if [ -z "$BACKEND_REPO" ]; then
  BACKEND_REPO="https://github.com/slampenny/bianca-backend-app.git"
  echo -e "${YELLOW}  ⚠️  Using default backend URL: $BACKEND_REPO${NC}"
fi

if [ -z "$FRONTEND_REPO" ]; then
  FRONTEND_REPO="git@github.com:slampenny/bianca-app-frontend.git"
  echo -e "${YELLOW}  ⚠️  Using default frontend URL: $FRONTEND_REPO${NC}"
fi

echo -e "${BLUE}Backend repo: ${BACKEND_REPO}${NC}"
echo -e "${BLUE}Frontend repo: ${FRONTEND_REPO}${NC}"
echo ""

# Step 0.5: Clean up submodule references
echo -e "${BLUE}Step 0.5: Cleaning up submodule references...${NC}"

# Remove submodule references if they exist
if [ -f ".gitmodules" ] || [ -f "packages/backend/.git" ] || [ -f "packages/frontend/.git" ]; then
  echo "  → Removing submodule references..."
  git rm --cached packages/backend 2>/dev/null || true
  git rm --cached packages/frontend 2>/dev/null || true
  rm -f .gitmodules
  
  # Remove .git files (submodule pointers)
  rm -f packages/backend/.git
  rm -f packages/frontend/.git
fi

# Remove .git directories if they exist
if [ -d "packages/backend/.git" ]; then
  rm -rf packages/backend/.git
fi

if [ -d "packages/frontend/.git" ]; then
  rm -rf packages/frontend/.git
fi

# Commit the cleanup if there are changes
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  git add -A
  git commit -m "chore: remove submodule references before migration" || true
  echo -e "${GREEN}  ✅ Submodule cleanup committed${NC}"
fi

echo ""

# Step 1: Check for uncommitted changes (only if packages have their own .git)
echo -e "${BLUE}Step 1: Checking for uncommitted changes...${NC}"

cd "$ROOT_DIR"

# Only check backend if it has its own .git (not a submodule)
if [ -d "packages/backend/.git" ] && [ ! -f "packages/backend/.git" ]; then
  cd "$ROOT_DIR/packages/backend"
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  Backend has uncommitted changes${NC}"
    echo "   Please commit or stash them before proceeding."
    echo "   Current changes:"
    git status --short
    echo ""
    read -p "Commit these changes now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      git add -A
      git commit -m "chore: commit changes before monorepo migration"
      echo -e "${GREEN}✅ Backend changes committed${NC}"
    else
      echo -e "${RED}❌ Please commit or stash backend changes first${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✅ Backend is clean${NC}"
  fi
  cd "$ROOT_DIR"
else
  echo -e "${GREEN}✅ Backend is clean (no separate git repo)${NC}"
fi

# Only check frontend if it has its own .git (not a submodule)
if [ -d "packages/frontend/.git" ] && [ ! -f "packages/frontend/.git" ]; then
  cd "$ROOT_DIR/packages/frontend"
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  Frontend has uncommitted changes${NC}"
    echo "   Please commit or stash them before proceeding."
    echo "   Current changes:"
    git status --short
    echo ""
    read -p "Commit these changes now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      git add -A
      git commit -m "chore: commit changes before monorepo migration"
      echo -e "${GREEN}✅ Frontend changes committed${NC}"
    else
      echo -e "${RED}❌ Please commit or stash frontend changes first${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✅ Frontend is clean${NC}"
  fi
  cd "$ROOT_DIR"
else
  echo -e "${GREEN}✅ Frontend is clean (no separate git repo)${NC}"
fi

echo ""

# Step 2: Repository URLs already obtained in Step 0


# Step 3: Check if root is a git repo
cd "$ROOT_DIR"
if [ -d ".git" ]; then
  echo -e "${YELLOW}⚠️  Root directory is already a git repository${NC}"
  read -p "Continue with migration? This will add history to existing repo. (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Migration cancelled${NC}"
    exit 1
  fi
  USE_EXISTING=true
else
  echo -e "${BLUE}Step 3: Initializing root git repository...${NC}"
  git init
  git commit --allow-empty -m "chore: initial monorepo structure"
  USE_EXISTING=false
fi

# Step 4: Create migration branch
MIGRATION_BRANCH="monorepo-git-migration-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$MIGRATION_BRANCH" 2>/dev/null || git checkout "$MIGRATION_BRANCH"
echo -e "${GREEN}✅ Created migration branch: $MIGRATION_BRANCH${NC}"
echo ""

# Step 5: Add remotes
echo -e "${BLUE}Step 5: Adding repository remotes...${NC}"
if git remote | grep -q "^backend-orig$"; then
  git remote set-url backend-orig "$BACKEND_REPO"
else
  git remote add backend-orig "$BACKEND_REPO"
fi

if git remote | grep -q "^frontend-orig$"; then
  git remote set-url frontend-orig "$FRONTEND_REPO"
else
  git remote add frontend-orig "$FRONTEND_REPO"
fi
echo -e "${GREEN}✅ Remotes added${NC}"
echo ""

# Step 6: Fetch branches
echo -e "${BLUE}Step 6: Fetching main and staging branches...${NC}"
git fetch backend-orig main:backend-main 2>/dev/null || \
  git fetch backend-orig master:backend-main 2>/dev/null || \
  echo -e "${YELLOW}⚠️  Could not fetch backend main/master${NC}"

git fetch backend-orig staging:backend-staging 2>/dev/null || \
  echo -e "${YELLOW}⚠️  Backend staging branch not found (this is okay)${NC}"

git fetch frontend-orig main:frontend-main 2>/dev/null || \
  git fetch frontend-orig master:frontend-main 2>/dev/null || \
  echo -e "${YELLOW}⚠️  Could not fetch frontend main/master${NC}"

git fetch frontend-orig staging:frontend-staging 2>/dev/null || \
  echo -e "${YELLOW}⚠️  Frontend staging branch not found (this is okay)${NC}"

echo -e "${GREEN}✅ Branches fetched${NC}"
echo ""

# Step 7: Add existing files to git first
echo -e "${BLUE}Step 7: Adding existing files to git...${NC}"
git add -A
git commit -m "chore: add current monorepo state before history import" || echo -e "${YELLOW}  ⚠️  No changes to commit${NC}"
echo -e "${GREEN}  ✅ Current files committed${NC}"
echo ""

# Step 8: Import backend history using subtree merge (PRESERVES ALL EXISTING FILES)
echo -e "${BLUE}Step 8: Importing backend history (preserving all existing files)...${NC}"

if git show-ref --verify --quiet refs/heads/backend-main; then
  echo "  → Importing backend main branch history..."
  # Use subtree merge strategy - this preserves existing files
  git merge -s ours --no-commit --allow-unrelated-histories backend-main 2>/dev/null || true
  git read-tree --prefix=packages/backend -u backend-main 2>/dev/null || true
  
  # Keep existing files (ours strategy for conflicts)
  git checkout --ours packages/backend/ 2>/dev/null || true
  git add packages/backend/ 2>/dev/null || true
  
  git commit -m "chore: import backend main branch history into monorepo

This commit imports the complete history from bianca-backend-app
into packages/backend, preserving all commits, authors, and dates.
Existing files in packages/backend are preserved.

Original repository: $BACKEND_REPO
Migration date: $(date +%Y-%m-%d)" || echo -e "${YELLOW}  ⚠️  No changes to commit${NC}"
  echo -e "${GREEN}  ✅ Backend main imported (existing files preserved)${NC}"
fi

if git show-ref --verify --quiet refs/heads/backend-staging; then
  echo "  → Importing backend staging branch history..."
  git merge -s ours --no-commit --allow-unrelated-histories backend-staging 2>/dev/null || true
  git read-tree --prefix=packages/backend -u backend-staging 2>/dev/null || true
  
  git checkout --ours packages/backend/ 2>/dev/null || true
  git add packages/backend/ 2>/dev/null || true
  
  git commit -m "chore: import backend staging branch history into monorepo

Original repository: $BACKEND_REPO
Migration date: $(date +%Y-%m-%d)" || echo -e "${YELLOW}  ⚠️  No changes to commit${NC}"
  echo -e "${GREEN}  ✅ Backend staging imported (existing files preserved)${NC}"
fi

echo ""

# Step 9: Import frontend history using subtree merge (PRESERVES ALL EXISTING FILES)
echo -e "${BLUE}Step 9: Importing frontend history (preserving all existing files)...${NC}"

if git show-ref --verify --quiet refs/heads/frontend-main; then
  echo "  → Importing frontend main branch history..."
  git merge -s ours --no-commit --allow-unrelated-histories frontend-main 2>/dev/null || true
  git read-tree --prefix=packages/frontend -u frontend-main 2>/dev/null || true
  
  # Keep existing files (ours strategy)
  git checkout --ours packages/frontend/ 2>/dev/null || true
  git add packages/frontend/ 2>/dev/null || true
  
  git commit -m "chore: import frontend main branch history into monorepo

This commit imports the complete history from bianca-app-frontend
into packages/frontend, preserving all commits, authors, and dates.
Existing files in packages/frontend are preserved.

Original repository: $FRONTEND_REPO
Migration date: $(date +%Y-%m-%d)" || echo -e "${YELLOW}  ⚠️  No changes to commit${NC}"
  echo -e "${GREEN}  ✅ Frontend main imported (existing files preserved)${NC}"
fi

if git show-ref --verify --quiet refs/heads/frontend-staging; then
  echo "  → Importing frontend staging branch history..."
  git merge -s ours --no-commit --allow-unrelated-histories frontend-staging 2>/dev/null || true
  git read-tree --prefix=packages/frontend -u frontend-staging 2>/dev/null || true
  
  git checkout --ours packages/frontend/ 2>/dev/null || true
  git add packages/frontend/ 2>/dev/null || true
  
  git commit -m "chore: import frontend staging branch history into monorepo

Original repository: $FRONTEND_REPO
Migration date: $(date +%Y-%m-%d)" || echo -e "${YELLOW}  ⚠️  No changes to commit${NC}"
  echo -e "${GREEN}  ✅ Frontend staging imported (existing files preserved)${NC}"
fi

echo ""

# Step 10: Create/update main and staging branches
echo -e "${BLUE}Step 10: Creating main and staging branches...${NC}"

if git show-ref --verify --quiet refs/heads/main; then
  echo -e "${YELLOW}  ⚠️  Main branch already exists, updating...${NC}"
  git branch -f main "$MIGRATION_BRANCH"
else
  git checkout -b main "$MIGRATION_BRANCH"
  echo -e "${GREEN}  ✅ Main branch created${NC}"
fi

if git show-ref --verify --quiet refs/heads/staging; then
  echo -e "${YELLOW}  ⚠️  Staging branch already exists, updating...${NC}"
  git branch -f staging "$MIGRATION_BRANCH"
else
  git checkout -b staging "$MIGRATION_BRANCH"
  echo -e "${GREEN}  ✅ Staging branch created${NC}"
fi

git checkout "$MIGRATION_BRANCH" 2>/dev/null || true
echo ""

# Step 11: Remove individual .git directories
echo -e "${BLUE}Step 11: Removing individual package .git directories...${NC}"
read -p "Remove .git directories from packages/backend and packages/frontend? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf "$ROOT_DIR/packages/backend/.git"
  rm -rf "$ROOT_DIR/packages/frontend/.git"
  echo -e "${GREEN}✅ Individual .git directories removed${NC}"
  echo -e "${YELLOW}⚠️  Packages are now part of the monorepo git repository${NC}"
else
  echo -e "${YELLOW}⚠️  Keeping individual .git directories (you may want to remove them later)${NC}"
fi
echo ""

# Step 12: Clean up temporary branches
echo -e "${BLUE}Step 12: Cleaning up temporary branches...${NC}"
git branch -D backend-main 2>/dev/null || true
git branch -D backend-staging 2>/dev/null || true
git branch -D frontend-main 2>/dev/null || true
git branch -D frontend-staging 2>/dev/null || true
echo -e "${GREEN}✅ Temporary branches removed${NC}"
echo ""

# Step 13: Summary
echo -e "${GREEN}🎉 Git migration complete!${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  Migration branch: $MIGRATION_BRANCH"
echo "  Main branch: main"
echo "  Staging branch: staging"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review the migration:"
echo "     git log --oneline --graph --all | head -30"
echo ""
echo "  2. Check history is preserved:"
echo "     git log packages/backend --oneline | head -10"
echo "     git log packages/frontend --oneline | head -10"
echo ""
echo "  3. If everything looks good:"
echo "     git checkout main"
echo "     git merge $MIGRATION_BRANCH"
echo ""
echo "     git checkout staging"
echo "     git merge $MIGRATION_BRANCH"
echo ""
echo "  4. Set up remote (choose one):"
echo "     # Option A: Use backend repo as monorepo"
echo "     git remote set-url origin $BACKEND_REPO"
echo ""
echo "     # Option B: Use frontend repo as monorepo"
echo "     git remote set-url origin $FRONTEND_REPO"
echo ""
echo "     # Option C: Create new monorepo repo and set URL"
echo "     git remote set-url origin <new-monorepo-url>"
echo ""
echo "  5. Push to remote:"
echo "     git push -u origin main"
echo "     git push -u origin staging"
echo ""
echo -e "${YELLOW}⚠️  Note: Old remotes (backend-orig, frontend-orig) are kept for reference.${NC}"
echo "   You can remove them later with:"
echo "   git remote remove backend-orig"
echo "   git remote remove frontend-orig"
echo ""
