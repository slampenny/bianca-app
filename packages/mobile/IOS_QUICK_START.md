# iOS Quick Start Guide

Your Apple Developer account is approved! Here's how to get your iOS app building and ready for TestFlight/App Store.

## ✅ What's Already Done

- ✅ EAS CLI installed
- ✅ iOS bundle identifier configured: `com.negascout.bianca`
- ✅ iOS build number added: `1`
- ✅ Encryption exemption configured (required for App Store)
- ✅ App icons and splash screens configured

## 🚀 Quick Setup (15-20 minutes)

### Step 1: Login to EAS

```bash
cd packages/mobile
eas login
```

### Step 2: Set Up iOS Credentials

EAS can automatically generate certificates and provisioning profiles for you:

```bash
eas credentials
```

When prompted:
1. Select **iOS** platform
2. Select **Set up credentials** or **Manage credentials**
3. EAS will guide you through:
   - Creating/selecting an App Store Connect API key (recommended)
   - Or using your Apple ID credentials
   - Generating distribution certificates
   - Creating provisioning profiles

**Note:** If you prefer to use App Store Connect API keys (more secure):
- Go to [App Store Connect](https://appstoreconnect.apple.com) → Users and Access → Keys
- Create a new key with "App Manager" or "Admin" role
- Download the `.p8` key file
- Use it in EAS credentials setup

### Step 3: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **"+"** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Bianca
   - **Primary Language:** English
   - **Bundle ID:** `com.negascout.bianca` (must match exactly)
   - **SKU:** `bianca-ios-001` (any unique identifier)
4. Click **Create**
5. **Note the App ID** (you'll see it in the App Information section)

### Step 4: Get Your Team ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Click **Membership** in the sidebar
3. Your **Team ID** is listed there (format: `ABC123DEF4`)

### Step 5: Update eas.json

Edit `packages/mobile/eas.json` and replace the placeholder values in the `submit.production.ios` section:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-actual-apple-id@example.com",  // Your Apple ID email
        "ascAppId": "1234567890",  // App ID from App Store Connect (Step 3)
        "appleTeamId": "ABC123DEF4"  // Team ID from Developer Portal (Step 4)
      }
    }
  }
}
```

### Step 6: Test Your First Build

Build for iOS device (for TestFlight):

```bash
yarn build:ios:prod:cloud
```

Or build for simulator (faster, cheaper, for testing):

```bash
yarn build:ios:sim
```

The build will run on Expo's cloud infrastructure. You'll get a link to track progress.

### Step 7: Submit to TestFlight

Once the build completes:

```bash
yarn submit:ios
```

Or manually:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app → **TestFlight** tab
3. Upload the build from EAS
4. Add internal/external testers
5. Test on your iPhone!

## 📱 Testing on Your iPhone

1. Install **TestFlight** app from the App Store
2. Accept the TestFlight invitation (sent via email)
3. Install and test your app

## 🔄 Incrementing Build Numbers

Each time you submit a new build, increment the build number in `app.json`:

```json
{
  "ios": {
    "buildNumber": "2"  // Increment this for each new build
  }
}
```

## 🛠️ Common Commands

```bash
# Build for iOS device (TestFlight/App Store)
yarn build:ios:prod:cloud

# Build for iOS simulator (testing)
yarn build:ios:sim

# Submit to App Store Connect/TestFlight
yarn submit:ios

# Manage credentials
eas credentials

# View build status
eas build:list
```

## ❓ Troubleshooting

### "No credentials found"
Run `eas credentials` and set up your iOS credentials.

### "Invalid bundle identifier"
Make sure `com.negascout.bianca` matches exactly in:
- `app.json` → `ios.bundleIdentifier`
- App Store Connect app settings
- Apple Developer Portal → Identifiers

### "Team ID not found"
- Verify your Apple Developer account is active
- Check the Team ID in [Apple Developer Portal](https://developer.apple.com/account) → Membership

### Build fails
- Check the build logs in EAS dashboard
- Ensure all dependencies are installed: `yarn install`
- Verify your app configuration is valid: `npx expo config --type introspect`

## 📚 Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

## 🎉 Next Steps After TestFlight

1. Test thoroughly on physical devices
2. Prepare App Store listing (screenshots, description, etc.)
3. Submit for App Store review
4. Release to production!

---

**Need help?** Check the detailed guides in `docs/IOS_BUILD_GUIDE.md` and `docs/IOS_SETUP_CHECKLIST.md`
