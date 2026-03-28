# Deployment Guide

## Web Frontend Deployment

### Option 1: Deploy to app.biancawellness.com (Recommended)

1. **Build the web version:**
   ```bash
   cd bianca-app-frontend
   npm run build:web
   ```

2. **Deploy using Vercel:**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

3. **Configure custom domain:**
   - In Vercel dashboard, go to your project settings
   - Add custom domain: `app.biancawellness.com`
   - Update DNS records to point to Vercel

### Option 2: Deploy to subdomain

Deploy to `web.app.biancawellness.com`:
```bash
vercel --prod --name bianca-web
```

## Google Play Store Deployment

### Prerequisites

1. **Google Play Console Account**
   - Create account at [Google Play Console](https://play.google.com/console)
   - Pay one-time $25 registration fee

2. **Google Service Account**
   - Go to Google Cloud Console
   - Create a new project or use existing
   - Enable Google Play Android Developer API
   - Create service account and download JSON key
   - Save as `google-service-account.json` in project root

3. **App Store Listing**
   - App title: "MyPhoneFriend"
   - Short description: "AI-powered wellness check calls"
   - Full description: Use your existing app description
   - Privacy Policy URL: `https://app.biancawellness.com/privacy`
   - Terms of Service URL: `https://app.biancawellness.com/terms`

### Build and Submit

1. **Build for production:**
   ```bash
   eas build --platform android --profile production
   ```

2. **Submit to Google Play Store:**
   ```bash
   eas submit --platform android --profile production
   ```

### Required App Store Information

#### Privacy Policy
- URL: `https://app.biancawellness.com/privacy`
- Already created in `legal/PRIVACY.md`

#### Terms of Service  
- URL: `https://app.biancawellness.com/terms`
- Already created in `legal/TERMS.md`

#### App Permissions
The app requests these permissions:
- `RECORD_AUDIO` - For making phone calls
- `MODIFY_AUDIO_SETTINGS` - For call audio management
- `INTERNET` - For API communication
- `ACCESS_NETWORK_STATE` - For network connectivity

#### Content Rating
- Target audience: Adults (18+)
- Content descriptors: None required
- Rating: 3+ (General)

### Legal Compliance

#### Privacy Policy Requirements
Your privacy policy should include:
- Data collection practices
- How data is used and shared
- User rights (access, deletion, etc.)
- Contact information
- Call recording consent requirements

#### Terms of Service Requirements
Your terms should include:
- Service description
- User responsibilities
- Call recording consent requirements
- Medical disclaimers
- Limitation of liability

### Integration Points

Add the `LegalLinks` component to your app screens:

```tsx
import { LegalLinks } from "app/components/LegalLinks"

// In your registration screen (REQUIRED for Google Play Store)
// Users must be able to read terms before creating account
<LegalLinks showPrivacyPolicy showTermsOfService />

// In your profile/settings screen (RECOMMENDED)
// Users should be able to access legal docs after registration
<LegalLinks showPrivacyPolicy showTermsOfService />
```

**Note**: Legal links are NOT required on the login screen since users aren't agreeing to new terms when logging in.

### Testing Checklist

Before submitting to Google Play Store:

- [ ] App builds successfully with `eas build`
- [ ] All app icons are properly sized
- [ ] Privacy policy and terms links work
- [ ] App permissions are properly declared
- [ ] App handles network errors gracefully
- [ ] No console errors in production build
- [ ] App works on different Android versions
- [ ] Call functionality works with real phone numbers

### Common Issues

1. **Package name conflicts**: Ensure `com.negascout.bianca` is unique
2. **Permission denials**: Test all permissions on real devices
3. **API endpoint issues**: Ensure production API URLs are correct
4. **Privacy policy accessibility**: Verify URLs are publicly accessible

### Post-Submission

1. **Review Process**: Google typically reviews apps within 1-7 days
2. **Rejections**: Common reasons include missing privacy policy, unclear permissions
3. **Updates**: Use `eas submit` for app updates
4. **Monitoring**: Monitor crash reports and user feedback

## Environment Variables

Ensure these are set in your deployment environment:

```bash
# Production API URL
API_URL=https://app.biancawellness.com/v1

# Google Play Store credentials
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json
```

## Support

For deployment issues:
1. Check Expo documentation: https://docs.expo.dev/
2. Check EAS documentation: https://docs.expo.dev/eas/
3. Check Vercel documentation: https://vercel.com/docs 