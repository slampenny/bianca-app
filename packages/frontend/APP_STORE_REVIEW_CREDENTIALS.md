# App Store Review Test Credentials

## What Apple Needs

When submitting your app for App Store review, Apple requires test credentials so they can:
- Log into your app
- Test core functionality
- Verify the app works as described

## Creating the App Store Review Account

### Automated Setup (Recommended)

#### Option 1: Via Swagger API (Easiest)

1. Go to your Swagger documentation: `https://api.biancawellness.com/v1/docs` (or staging equivalent)
2. Navigate to the **Test** section
3. Find the endpoint: `POST /test/create-app-store-review-account`
4. Click "Try it out"
5. Click "Execute" (requires admin authentication)
6. The response will include the credentials

**⚠️ Important:** The production iOS app connects to the production API (`https://api.biancawellness.com`), so the test account **must** be created in the **production** database. Apple reviewers will be using the production app build, which will authenticate against the production API.

#### Option 2: Via Script

Alternatively, you can run the script directly:

```bash
# From the backend directory
cd packages/backend

# ⚠️ IMPORTANT: Must use PRODUCTION environment
# The production iOS app connects to https://api.biancawellness.com
# So the test account must exist in the production database
NODE_ENV=production node src/scripts/createAppStoreReviewAccount.js
```

This script will create:
- ✅ A dedicated account: `appreview@biancatechnologies.com`
- ✅ An organization with sample data
- ✅ 2 sample patients with conversations and schedules
- ✅ All necessary sample data for Apple to review

### Manual Setup (Alternative)

If you prefer to create the account manually:

1. **Register a new account** via your app or admin panel:
   - Email: `appreview@biancatechnologies.com`
   - Password: Use a strong, memorable password
   - Name: "App Review Tester"
   - Phone: Your test phone number

2. **Populate with sample data** (if needed):
   - Add a test patient (if your app requires patients)
   - Add sample conversations or data
   - Ensure the account has access to main features

3. **Verify the account works**:
   - Test login on staging/production
   - Verify all features are accessible
   - Make sure there's sample data to review

### Option 2: Use Existing Test Account

If you have an existing test account in production/staging:
- Use that account's email and password
- Make sure it has sample data for Apple to review
- Ensure it demonstrates your app's main features

## Default App Store Review Account Credentials

If you used the automated script, the credentials are:

```
Email:    appreview@biancatechnologies.com
Password: (loaded from AWS Secrets Manager as APP_STORE_REVIEW_PASSWORD)
```

**⚠️ Important:** 
- The password is stored in AWS Secrets Manager as `APP_STORE_REVIEW_PASSWORD`
- For staging/production, ensure this secret is configured in AWS Secrets Manager
- For local development, you can set it in your `.env` file
- The default password for dev/test is `[REDACTED - from Secrets Manager]` but should be changed in production

## What to Provide in App Store Connect

In App Store Connect → Your App → App Review Information:

1. **Username/Email**: `appreview@biancatechnologies.com`
2. **Password**: (The password stored in AWS Secrets Manager as `APP_STORE_REVIEW_PASSWORD`)
3. **Notes** (recommended):
   ```
   This test account includes sample patient data and demonstrates the core 
   caregiver coordination features. The account has been verified and is ready 
   for review. All features are accessible without additional setup.
   
   The account includes:
   - 2 sample patients with wellness data
   - Sample conversations and schedules
   - Full access to caregiver coordination features
   ```

## Example App Store Connect Entry

```
Username: appreview@biancatechnologies.com
Password: (from AWS Secrets Manager - APP_STORE_REVIEW_PASSWORD)

Notes:
This test account includes sample patient data and demonstrates the core 
caregiver coordination features. The account has been verified and is ready 
for review. All features are accessible without additional setup.
```

## Important Notes

- ✅ **MUST** use an account in your **production** environment (not staging or local)
  - The production iOS app connects to `https://api.biancawellness.com`
  - Apple reviewers will use the production app build
  - The account must exist in the production database
- ✅ **Password Configuration:**
  - The password is stored in AWS Secrets Manager as `APP_STORE_REVIEW_PASSWORD`
  - Ensure this secret is configured in your production AWS Secrets Manager
  - The secret should be added to `MySecretsManagerSecret` (or your environment-specific secret)
  - For local development, you can set `APP_STORE_REVIEW_PASSWORD` in your `.env` file
- ✅ Ensure the account has sample data for Apple to review
- ✅ Test the login on production before submitting
- ✅ Keep this account active during review
- ⚠️ Don't use your personal account
- ⚠️ Don't use accounts with sensitive real patient data
- ⚠️ Make sure the password meets your app's requirements
- ⚠️ **Security:** The password is no longer hardcoded in the codebase - it must be configured in AWS Secrets Manager

## After Review

Once your app is approved, you can:
- Keep the test account for future updates
- Or delete it if no longer needed
- Update credentials if you change them
