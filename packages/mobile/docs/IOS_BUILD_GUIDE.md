# iOS Build Guide - Without a Mac

This guide covers what you can do to prepare and build your iOS app **without needing a Mac**.

## ✅ What You Can Do Right Now (No Mac Required)

### 1. **Use EAS Build Cloud** (Recommended - No Mac Needed!)

EAS Build runs on Expo's cloud infrastructure, so you can build iOS apps from any platform:

```bash
# Build for iOS simulator (for testing)
npm run build:ios:sim

# Build for physical device (for TestFlight/App Store)
npm run build:ios:prod:cloud

# Or use EAS CLI directly
npx eas build --platform ios --profile production
```

**Requirements:**
- Expo account (free tier works)
- Apple Developer account ($99/year)
- EAS CLI installed: `npm install -g eas-cli`

### 2. **Configure iOS App Settings**

You can update these files right now:

#### Update `app.json` or `app.config.ts`:

```json
{
  "ios": {
    "bundleIdentifier": "com.negascout.bianca",  // ✅ Already set
    "buildNumber": "1",  // Increment for each build
    "supportsTablet": true,  // ✅ Already set
    "infoPlist": {
      "NSMicrophoneUsageDescription": "This app needs access to the microphone to make phone calls for wellness checks.",
      "NSCameraUsageDescription": "This app may need access to the camera for profile pictures.",
      "NSPhotoLibraryUsageDescription": "This app may need access to your photos for profile pictures.",
      // Add more permissions as needed
      "ITSAppUsesNonExemptEncryption": false  // Required for App Store if not using encryption
    },
    "config": {
      "usesNonExemptEncryption": false  // If your app doesn't use encryption
    }
  }
}
```

### 3. **Set Up App Store Connect** (Web-Based, No Mac Needed)

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create your app listing:
   - App name: "MyPhoneFriend"
   - Primary language: English
   - Bundle ID: `com.negascout.bianca`
   - SKU: `bianca-ios-001` (or any unique identifier)

3. Fill out app metadata:
   - Description
   - Keywords
   - Screenshots (can be from simulator or Android)
   - App icon
   - Privacy policy URL
   - Support URL

4. Set up App Store categories and pricing

### 4. **Configure EAS Submit** (Update `eas.json`)

Update the iOS submit configuration with your real Apple credentials:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",  // Your Apple ID email
        "ascAppId": "1234567890",  // App Store Connect App ID (found in App Store Connect)
        "appleTeamId": "ABC123DEF4"  // Your Apple Team ID (found in Apple Developer portal)
      }
    }
  }
}
```

**To find your Team ID:**
1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Click on "Membership" in the sidebar
3. Your Team ID is listed there

**To find your App ID:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. The App ID is in the App Information section

### 5. **Set Up Push Notifications** (If Needed)

If you need push notifications, you can configure them:

1. **In Apple Developer Portal:**
   - Go to Certificates, Identifiers & Profiles
   - Create an APNs Key (recommended) or Certificate
   - Download and save securely

2. **In EAS:**
   ```bash
   npx eas credentials
   ```
   - Select iOS platform
   - Select "Push Notifications"
   - Upload your APNs key/certificate

### 6. **Test Builds via TestFlight**

Once you have a build:

1. Build with EAS:
   ```bash
   npm run build:ios:prod:cloud
   ```

2. Submit to TestFlight:
   ```bash
   npm run submit:ios
   ```

3. Or manually:
   - Go to App Store Connect
   - Select your app → TestFlight
   - Add internal/external testers
   - Test on physical iPhone/iPad

### 7. **Configure App Icons and Splash Screens**

Make sure you have iOS-specific assets:

- **App Icon**: `assets/images/app-icon-ios.png` (1024x1024)
- **Splash Screen**: Already configured in `app.json`

### 8. **Update iOS Permissions**

Add any additional permissions you need in `app.json`:

```json
{
  "ios": {
    "infoPlist": {
      "NSLocationWhenInUseUsageDescription": "This app needs location access for...",
      "NSContactsUsageDescription": "This app needs contacts access for...",
      // etc.
    }
  }
}
```

## 🔧 Setup Steps (Do These Now)

### Step 1: Install EAS CLI (if not already installed)
```bash
npm install -g eas-cli
```

### Step 2: Login to Expo
```bash
npx eas login
```

### Step 3: Configure EAS Project
```bash
npx eas build:configure
```

### Step 4: Update `eas.json` with your Apple credentials
Edit `eas.json` and replace the placeholder values in the `submit.production.ios` section.

### Step 5: Test a Cloud Build
```bash
# Build for iOS simulator first (faster, cheaper)
npm run build:ios:sim

# Or build for device
npm run build:ios:prod:cloud
```

## 📱 Testing Options Without a Mac

1. **EAS Build Cloud** - Builds run on Expo's Mac infrastructure
2. **TestFlight** - Install on physical iPhone/iPad for testing
3. **Expo Go** - For development (limited native features)
4. **Physical Device** - Connect iPhone via USB and use Expo Dev Client

## ⚠️ What You CAN'T Do Without a Mac

- Run iOS Simulator locally
- Debug native iOS code in Xcode
- Test on iOS Simulator (but you can use TestFlight on real device)
- Build locally with `eas build --local` (requires Mac)

## 🚀 Quick Start: Build Your First iOS App

1. **Make sure you're logged in:**
   ```bash
   npx eas login
   ```

2. **Update eas.json with your Apple credentials** (see Step 4 above)

3. **Build for TestFlight:**
   ```bash
   npm run build:ios:prod:cloud
   ```

4. **Submit to TestFlight:**
   ```bash
   npm run submit:ios
   ```

5. **Test on your iPhone:**
   - Install TestFlight app from App Store
   - Accept the TestFlight invitation
   - Install and test your app

## 📝 Next Steps

1. ✅ Update `eas.json` with real Apple credentials
2. ✅ Set up App Store Connect listing
3. ✅ Configure app metadata (description, screenshots, etc.)
4. ✅ Build first cloud build: `npm run build:ios:prod:cloud`
5. ✅ Submit to TestFlight: `npm run submit:ios`
6. ✅ Test on physical device
7. ✅ Submit for App Store review when ready

## 💡 Tips

- **Free EAS Build credits**: Expo gives free build minutes each month
- **Build caching**: EAS caches builds, so rebuilds are faster
- **Build profiles**: Use different profiles for dev/staging/production
- **Incremental builds**: Only changed code is rebuilt
- **Build status**: Check build progress at [expo.dev](https://expo.dev)

## 🔗 Useful Links

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer Portal](https://developer.apple.com/account)
- [Expo EAS Submit](https://docs.expo.dev/submit/introduction/)

## ❓ Common Issues

**Q: Do I need an Apple Developer account?**
A: Yes, $99/year. Required for TestFlight and App Store distribution.

**Q: Can I test without a physical iPhone?**
A: Not easily without a Mac. Use TestFlight on a real device, or use Expo Go for basic testing.

**Q: How long do builds take?**
A: First build: ~15-20 minutes. Subsequent builds: ~5-10 minutes (cached).

**Q: Can I build for free?**
A: Yes! Expo provides free build minutes each month. Paid plans available for more builds.

