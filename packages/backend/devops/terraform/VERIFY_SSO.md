# Verify SSO Endpoint

## Current SSO Configuration
```
sso_start_url = https://d-9a67701f12.awsapps.com/start
sso_account_id = 730335291008
sso_role_name = bianca-admin
```

## How to Verify

1. **Check if the SSO endpoint is correct:**
   - The SSO URL `d-9a67701f12.awsapps.com` is an AWS SSO portal
   - The account ID `730335291008` should match your infrastructure account
   - If you have access to AWS Console, check which account/organization this SSO portal belongs to

2. **Try listing accounts available through this SSO:**
   ```bash
   aws sso list-accounts --profile jordan
   ```

3. **Check if there are other profiles that might be correct:**
   ```bash
   cat ~/.aws/config | grep -B 2 -A 10 "730335291008"
   ```

4. **Verify the role name is correct:**
   - The role `bianca-admin` needs to exist in account 730335291008
   - It needs permissions for: Route53, EC2, ACM, CodePipeline, CodeBuild, etc.

## If SSO Endpoint is Wrong

If you have a different SSO endpoint for account 730335291008, update `~/.aws/config`:

```ini
[profile jordan]
sso_start_url = https://CORRECT-SSO-ENDPOINT.awsapps.com/start
sso_region = us-east-2
sso_account_id = 730335291008
sso_role_name = bianca-admin  # or whatever the correct role name is
region = us-east-2
output = json
```

Then:
```bash
aws sso login --profile jordan
aws sts get-caller-identity --profile jordan
```
