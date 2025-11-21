# Adding Personal Access Token for Frontend Repo

## Step 1: Create a Personal Access Token (PAT)

1. Go to GitHub Settings:
   - Click your profile picture (top right)
   - Click **Settings**
   - Or go directly: https://github.com/settings/tokens

2. Create a new token:
   - Click **Developer settings** (left sidebar)
   - Click **Personal access tokens**
   - Click **Tokens (classic)** or **Fine-grained tokens**
   - Click **Generate new token** → **Generate new token (classic)**

3. Configure the token:
   - **Note**: `GitHub Actions - Frontend Repo Access`
   - **Expiration**: Choose your preference (90 days, 1 year, or no expiration)
   - **Scopes**: Check these boxes:
     - ✅ `repo` (Full control of private repositories)
       - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`

4. Generate and copy:
   - Click **Generate token**
   - **IMPORTANT**: Copy the token immediately! You won't be able to see it again.
   - It will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Add Token as GitHub Secret

1. Go to your repository:
   - https://github.com/slampenny/bianca-app-backend

2. Navigate to Secrets:
   - Click **Settings** (top menu)
   - Click **Secrets and variables** → **Actions** (left sidebar)
   - Or go directly: https://github.com/slampenny/bianca-app-backend/settings/secrets/actions

3. Add the secret:
   - Click **New repository secret**
   - **Name**: `FRONTEND_REPO_TOKEN`
   - **Secret**: Paste your PAT token (the `ghp_...` value)
   - Click **Add secret**

## Step 3: Verify

The workflow is already configured to use this token! It will:
- Try `FRONTEND_REPO_TOKEN` first (if set)
- Fall back to `GITHUB_TOKEN` if not set

## Security Notes

- ✅ The token is stored encrypted in GitHub Secrets
- ✅ It's only visible to GitHub Actions (not in logs)
- ✅ You can revoke it anytime from Settings → Developer settings → Personal access tokens
- ⚠️ Don't share the token or commit it to code

## Testing

After adding the token, the next workflow run should be able to:
- ✅ Checkout the frontend repository
- ✅ Build the frontend Docker image
- ✅ Push it to ECR

## Troubleshooting

If it still fails:
1. Verify the token has `repo` scope
2. Check the token hasn't expired
3. Verify the secret name is exactly `FRONTEND_REPO_TOKEN`
4. Check the frontend repo name is correct: `slampenny/bianca-app-frontend`

