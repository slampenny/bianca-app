# How to Find Your SSO Endpoint in AWS Console

## Steps to Find the Correct SSO Start URL

1. **Log into AWS Console** (make sure you're in account 730335291008)

2. **Navigate to IAM Identity Center** (formerly AWS SSO):
   - In the AWS Console search bar, type "IAM Identity Center" or "SSO"
   - Click on "IAM Identity Center" service

3. **Find the Settings page:**
   - In the left sidebar, click **"Settings"**
   - Look for the **"AWS access portal URL"** or **"Start URL"**
   - It will look like: `https://d-XXXXXXXXXX.awsapps.com/start`

4. **Verify the account:**
   - The account ID should be visible in the top-right corner of the console
   - Make sure it shows `730335291008`

5. **Check the role name:**
   - Go to **"AWS accounts"** in the left sidebar
   - Find account `730335291008`
   - Click on it to see available roles
   - Verify that `bianca-admin` (or the correct role) exists

## Alternative: Check via AWS CLI (if you can access the console)

If you're already logged into the console, you can also check:
- The SSO endpoint is usually shown in the IAM Identity Center dashboard
- It's the URL you use to access the AWS access portal

## What to Do Next

Once you have the correct SSO start URL:

1. **Update `~/.aws/config`:**
   ```ini
   [profile jordan]
   sso_start_url = https://CORRECT-ENDPOINT.awsapps.com/start
   sso_region = us-east-2
   sso_account_id = 730335291008
   sso_role_name = bianca-admin  # or the correct role name
   region = us-east-2
   output = json
   ```

2. **Re-authenticate:**
   ```bash
   aws sso login --profile jordan
   aws sts get-caller-identity --profile jordan
   ```

3. **Verify you're in the right account:**
   - The output should show account `730335291008`
   - Not `243621520607`
