# iOS Setup Checklist - What You Can Do Right Now

## ✅ Immediate Actions (No Mac Required)

### 1. **Update EAS Configuration** (5 minutes)

Edit `eas.json` and replace placeholder values:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID@example.com",  // ⚠️ REPLACE THIS
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",  // ⚠️ REPLACE THIS
        "appleTeamId": "YOUR_TEAM_ID"  // ⚠️ REPLACE THIS
      }
    }
  }
}
```

**How to find these:**
- **Apple ID**: Your Apple account email
- **Team ID**: [Apple Developer Portal](https://developer.apple.com/account) → Membership → Team ID
- **App ID**: Create app in [App Store Connect](https://appstoreconnect.apple.com) → Get App ID

### 2. **Verify App Configuration** (2 minutes)

Check `app.json` has correct iOS settings:
- ✅ Bundle Identifier: `com.negascout.bianca` (already set)
- ✅ App Name: "MyPhoneFriend" (already set)
- ✅ Version: `1.0.0` (update as needed)
- ✅ Build Number: Increment for each build

### 3. **Set Up App Store Connect** (15-30 minutes)

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "+" → New App
3. Fill in:
   - Platform: iOS
   - Name: MyPhoneFriend
   - Primary Language: English
   - Bundle ID: `com.negascout.bianca` (must match your app)
   - SKU: `bianca-ios-001` (any unique identifier)

4. Save and note the **App ID** (you'll need it for `eas.json`)

### 4. **Install/Verify EAS CLI** (1 minute)

```bash
npm install -g eas-cli
eas --version  # Should show version
```

### 5. **Login to Expo** (1 minute)

```bash
npx eas login
```

### 6. **Configure EAS Project** (2 minutes)

```bash
cd bianca-app-frontend
npx eas build:configure
```

This will verify your project is set up correctly.

### 7. **Test a Cloud Build** (15-20 minutes, but runs in background)

```bash
# Build for iOS simulator (cheaper, faster)
npm run build:ios:sim

# OR build for physical device (for TestFlight)
npm run build:ios:prod:cloud
```

**Note:** First build takes longer. You can monitor progress at [expo.dev](https://expo.dev)

### 8. **Prepare App Store Assets** (30-60 minutes)

While build is running, prepare:
- App screenshots (can use Android screenshots or simulator)
- App description
- Keywords
- Privacy policy URL
- Support URL
- App icon (1024x1024 PNG)

## 📋 Pre-Build Checklist

Before running your first build, verify:

- [ ] Apple Developer account active ($99/year)
- [ ] App created in App Store Connect
- [ ] `eas.json` has real Apple credentials (not placeholders)
- [ ] `app.json` has correct bundle identifier
- [ ] EAS CLI installed and logged in
- [ ] App icons and splash screens ready

## 🚀 First Build Command

Once everything is configured:

```bash
# Build for TestFlight (physical device)
npm run build:ios:prod:cloud

# Monitor build at: https://expo.dev
```

## 📱 After Build Completes

1. **Submit to TestFlight:**
   ```bash
   npm run submit:ios
   ```

2. **Or manually:**
   - Download the `.ipa` file from [expo.dev](https://expo.dev)
   - Upload to App Store Connect → TestFlight

3. **Test on iPhone:**
   - Install TestFlight app
   - Accept invitation
   - Install and test your app

## ⏱️ Time Estimate

- **Quick setup (credentials only)**: 10-15 minutes
- **Full setup (including App Store Connect)**: 30-60 minutes
- **First build**: 15-20 minutes (runs in background)
- **Total**: ~1-2 hours to get first build

## 💰 Costs

- **Apple Developer Account**: $99/year (required)
- **EAS Build**: Free tier available (limited builds/month)
- **TestFlight**: Free (included with Apple Developer account)

## 🎯 Priority Order

1. **Do Now**: Update `eas.json` with Apple credentials
2. **Do Now**: Set up App Store Connect app
3. **Do Now**: Run first cloud build
4. **Do Later**: Prepare app metadata and screenshots
5. **Do Later**: Submit to TestFlight for testing

## 🔍 Verify Your Setup

Run this to check if everything is configured:

```bash
# Check EAS configuration
npx eas build:configure

# Check if logged in
npx eas whoami

# List your projects
npx eas project:info
```

## 📝 Notes

- You **don't need a Mac** for cloud builds
- First build is slower, subsequent builds are faster (caching)
- You can build from Windows/Linux using EAS Build cloud
- TestFlight allows testing on real devices without App Store approval
- App Store submission requires additional metadata and review process

