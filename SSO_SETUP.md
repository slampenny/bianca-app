# SSO (Single Sign-On) Setup Guide

This guide will help you set up Google and Microsoft SSO authentication for your Bianca app.

## Prerequisites

- Google Cloud Console account
- Microsoft Azure account
- Backend API running with SSO endpoints

## 1. Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - For development: `https://auth.expo.io/@your-expo-username/bianca`
     - For production: `https://auth.expo.io/@your-expo-username/bianca`
5. Copy the Client ID

### Step 2: Configure Frontend

Add your Google Client ID to your environment variables:

```bash
# In your .env file or environment
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here
```

## 2. Microsoft OAuth Setup

### Step 1: Register App in Azure

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Fill in the details:
   - Name: "Bianca App"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Platform "Web", URI: `https://auth.expo.io/@your-expo-username/bianca`
5. After creation, note down:
   - Application (client) ID
   - Directory (tenant) ID

### Step 2: Configure API Permissions

1. Go to "API permissions" in your app registration
2. Add the following Microsoft Graph permissions:
   - `openid` (Sign users in)
   - `profile` (View users' basic profile)
   - `email` (View users' email address)
3. Grant admin consent for these permissions

### Step 3: Configure Frontend

Add your Microsoft credentials to your environment variables:

```bash
# In your .env file or environment
EXPO_PUBLIC_MICROSOFT_CLIENT_ID=your-microsoft-client-id-here
EXPO_PUBLIC_MICROSOFT_TENANT_ID=your-tenant-id-or-common
```

## 3. Backend Configuration

The backend SSO endpoints are already configured. Make sure your backend has:

1. **JWT secrets** configured:
   ```bash
   JWT_SECRET=your-jwt-secret
   JWT_REFRESH_SECRET=your-jwt-refresh-secret
   ```

2. **Database** with updated Caregiver model supporting SSO fields

3. **SSO routes** available at `/v1/sso/login` and `/v1/sso/verify`

## 4. Testing SSO

### Frontend Testing

1. Start your development server:
   ```bash
   yarn start
   ```

2. Navigate to the login screen
3. You should see "Google" and "Microsoft" buttons below the regular login form
4. Test both SSO providers

### Backend Testing

Test the SSO endpoint directly:

```bash
curl -X POST https://api.myphonefriend.com/v1/sso/login \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "email": "test@example.com",
    "name": "Test User",
    "id": "google-user-id",
    "picture": "https://example.com/photo.jpg"
  }'
```

## 5. Production Deployment

### Frontend

1. Update your production environment variables
2. Rebuild and deploy your app
3. Update OAuth redirect URIs in Google/Microsoft consoles to match production URLs

### Backend

1. Ensure SSO routes are deployed
2. Test SSO endpoints in production
3. Monitor logs for any SSO-related errors

## 6. Troubleshooting

### Common Issues

1. **"Invalid redirect URI" error**:
   - Check that redirect URIs in OAuth providers match your app configuration
   - For Expo, use the format: `https://auth.expo.io/@username/app-slug`

2. **"Client ID not found" error**:
   - Verify environment variables are set correctly
   - Check that the client ID is copied correctly

3. **Backend authentication fails**:
   - Check backend logs for errors
   - Verify JWT secrets are configured
   - Ensure database is accessible

4. **"SSO login not yet implemented" message**:
   - This indicates the frontend is working but backend integration needs completion
   - Check that the backend SSO endpoint is responding correctly

### Debug Mode

Enable debug logging by adding this to your app:

```typescript
// In your app config or environment
EXPO_PUBLIC_DEBUG_SSO=true
```

## 7. Security Considerations

1. **Environment Variables**: Never commit OAuth credentials to version control
2. **HTTPS**: Always use HTTPS in production for OAuth redirects
3. **Token Validation**: The backend validates OAuth tokens before creating user sessions
4. **User Data**: Only store necessary user information from OAuth providers

## 8. User Experience

- SSO users are automatically created as organization admins
- Their email is pre-verified
- They get a default organization created
- Profile pictures are automatically set from OAuth providers

## Support

If you encounter issues:

1. Check the browser console for frontend errors
2. Check backend logs for server errors
3. Verify OAuth provider configurations
4. Test with different user accounts

For additional help, refer to:
- [Expo AuthSession Documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Graph Documentation](https://docs.microsoft.com/en-us/graph/)
