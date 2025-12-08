# SSO Role Access Issue

## The Problem
AWS SSO is rejecting the request for role `bianca-admin` in account `730335291008` with "No access".

The debug output shows:
```
GET /federation/credentials?role_name=bianca-admin&account_id=730335291008
Response: {"message":"No access","__type":"com.amazonaws.switchboard.portal#ForbiddenException"}
```

## What This Means
- The SSO login is working (you authenticated successfully)
- But AWS SSO says you don't have access to role `bianca-admin` in account `730335291008`
- This could mean:
  1. The role name changed
  2. Your SSO permissions were modified
  3. The role was removed from your assignment

## How to Fix

### Step 1: Check Available Roles in AWS Console

1. Go to: https://console.aws.amazon.com/singlesignon/
2. Click **"AWS accounts"** in the left sidebar
3. Find account **730335291008** and click on it
4. You should see a list of **Permission sets** (these are the roles you can assume)
5. Note the exact name(s) you see

### Step 2: Check Your User Assignment

1. In IAM Identity Center, click **"Users"** or **"Groups"** in the left sidebar
2. Find your user/group
3. Click on it and go to **"AWS accounts"** tab
4. Check if account `730335291008` is assigned
5. Check which permission set (role) is assigned to you for that account

### Step 3: Update Your Config

Once you find the correct role name, update `~/.aws/config`:

```ini
[profile jordan]
sso_start_url = https://d-9a67701f12.awsapps.com/start
sso_region = us-east-2
sso_account_id = 730335291008
sso_role_name = <CORRECT-ROLE-NAME>  # Update this line
region = us-east-2
output = json
```

### Step 4: Test Again

```bash
aws sso login --profile jordan
aws sts get-caller-identity --profile jordan
```

## Common Permission Set Names
- `AdministratorAccess`
- `PowerUserAccess`
- `ReadOnlyAccess`
- Custom names like `admin`, `terraform-admin`, etc.

## If You Can't Access the Console
Ask your AWS administrator to:
1. Verify your SSO assignment includes account `730335291008`
2. Tell you the exact permission set (role) name assigned to you
3. Verify the permission set exists and is active
