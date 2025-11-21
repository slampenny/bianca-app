# Google Play Store Submission Checklist

## Pre-Submission Requirements

### ✅ Account Setup
- [ ] Google Play Console account created ($25 registration fee paid)
- [ ] Google Cloud Project created
- [ ] Google Play Android Developer API enabled
- [ ] Service account created and JSON key downloaded
- [ ] Service account JSON saved as `google-service-account.json`

### ✅ App Configuration
- [ ] Package name updated to `com.negascout.bianca`
- [ ] App name updated to "MyPhoneFriend"
- [ ] Version number set to 1.0.0
- [ ] App icons properly sized (512x512, 192x192, etc.)
- [ ] Adaptive icons configured for Android
- [ ] Permissions properly declared in app.json

### ✅ Legal Documents
- [ ] Privacy Policy created and accessible at `https://app.biancawellness.com/privacy`
- [ ] Terms of Service created and accessible at `https://app.biancawellness.com/terms`
- [ ] Legal links component added to app screens
- [ ] Privacy policy covers call recording consent
- [ ] Terms include medical disclaimers

### ✅ App Store Listing
- [ ] App title: "MyPhoneFriend"
- [ ] Short description (80 characters max)
- [ ] Full description (4000 characters max)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots for different device sizes
- [ ] Content rating questionnaire completed
- [ ] Target audience: Adults (18+)

## Build and Testing

### ✅ Local Testing
- [ ] App builds successfully with `eas build --platform android --profile production`
- [ ] App installs and runs on physical Android device
- [ ] All permissions work correctly
- [ ] Call functionality tested with real phone numbers
- [ ] Privacy policy and terms links work
- [ ] No console errors in production build

### ✅ API Configuration
- [ ] Production API URL configured: `https://app.biancawellness.com/v1`
- [ ] WebSocket URL configured for production
- [ ] All environment variables set correctly
- [ ] API endpoints tested in production environment

## Submission Process

### ✅ Build Submission
```bash
# Build for production
eas build --platform android --profile production

# Submit to Google Play Store
eas submit --platform android --profile production
```

### ✅ Google Play Console Setup
- [ ] App created in Google Play Console
- [ ] Store listing information filled out
- [ ] Content rating questionnaire completed
- [ ] App access: Production track selected
- [ ] Release type: Production release
- [ ] Release notes added

### ✅ Privacy and Security
- [ ] Privacy policy URL added to store listing
- [ ] Data safety section completed
- [ ] App permissions explained
- [ ] Data collection practices disclosed
- [ ] User consent mechanisms implemented

## Post-Submission

### ✅ Review Process
- [ ] App submitted for review
- [ ] Review typically takes 1-7 days
- [ ] Monitor for any rejection emails
- [ ] Be prepared to address any issues

### ✅ Common Rejection Reasons
- [ ] Missing or inadequate privacy policy
- [ ] Unclear permission usage
- [ ] App crashes or doesn't function
- [ ] Inappropriate content
- [ ] Misleading app description

### ✅ After Approval
- [ ] App will be available on Google Play Store
- [ ] Monitor user reviews and feedback
- [ ] Set up crash reporting (optional)
- [ ] Plan for future updates

## Technical Requirements

### ✅ Android Permissions
```json
{
  "permissions": [
    "android.permission.RECORD_AUDIO",
    "android.permission.MODIFY_AUDIO_SETTINGS", 
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE"
  ]
}
```

### ✅ App Icons
- [ ] Legacy icon: 512x512 px
- [ ] Adaptive icon foreground: 108x108 dp
- [ ] Adaptive icon background: 108x108 dp
- [ ] All icons in PNG format

### ✅ Content Rating
- [ ] Target audience: Adults (18+)
- [ ] Content descriptors: None required
- [ ] Rating: 3+ (General)

## Support Resources

- [Expo EAS Documentation](https://docs.expo.dev/eas/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle Guide](https://developer.android.com/guide/app-bundle)
- [Privacy Policy Requirements](https://play.google.com/about/privacy-security-deception/)

## Emergency Contacts

If you encounter issues:
1. Check Expo documentation first
2. Review Google Play Console error messages
3. Contact Expo support if EAS build issues
4. Contact Google Play support for store issues

---

**Remember**: The review process can take several days. Be patient and ensure all requirements are met before submission to avoid delays. 