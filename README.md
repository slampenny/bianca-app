# MyPhoneFriend Mobile & Web App

> React Native/Expo healthcare communication platform for secure caregiver coordination and wellness monitoring

[![React Native](https://img.shields.io/badge/React%20Native-0.73-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-50+-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

## 📱 Overview

MyPhoneFriend is a cross-platform mobile and web application that enables healthcare organizations, caregivers, and families to coordinate patient care through secure communication, automated wellness checks, and real-time monitoring.

### 🎯 Key Features

- 🔐 **Secure Authentication** - Multi-factor authentication with biometric support
- 👥 **Patient Management** - Comprehensive patient profiles and care coordination
- 📞 **Voice Calls** - High-quality voice calls for wellness checks
- 📅 **Smart Scheduling** - AI-powered scheduling for wellness checks
- 📊 **Real-time Dashboard** - Live patient status and care metrics
- 🏥 **Multi-Organization** - Support for healthcare facilities and home care
- 📱 **Cross-Platform** - iOS, Android, and web support
- 🔒 **HIPAA Compliant** - End-to-end encryption for patient data

## 🛠️ Technology Stack

- **React Native 0.73** - Cross-platform mobile development
- **Expo 50+** - Development platform and deployment
- **TypeScript** - Type-safe JavaScript development
- **Ignite CLI** - React Native boilerplate and toolchain
- **Redux Toolkit** - State management
- **React Navigation 6** - Navigation and routing
- **Socket.io** - Real-time communication
- **EAS Build** - Cloud-based builds and deployment

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- EAS CLI (`npm install -g eas-cli`)

### Installation

```bash
git clone https://github.com/jordanlapp/myphonefriend-frontend.git
cd myphonefriend-frontend
yarn install
yarn start
```

### Development

```bash
yarn start             # Start Expo development server
yarn ios               # Run on iOS simulator
yarn android           # Run on Android emulator
yarn web               # Run on web browser
yarn test              # Run tests
```

### Building for Production

```bash
yarn build:android:prod:cloud    # Build Android AAB
yarn build:ios:prod:cloud        # Build iOS IPA
yarn deploy:android              # Deploy to Google Play Store
yarn deploy:ios                  # Deploy to Apple App Store
```

## 📁 Project Structure

```
app/
├── components/          # Reusable UI components
├── screens/            # Application screens
├── navigators/         # Navigation configuration
├── services/           # API services
├── store/             # Redux store and slices
├── theme/             # Design system
└── utils/             # Utility functions

assets/
├── images/            # Image assets
├── icons/             # Icon assets
└── fonts/             # Custom fonts
```

## 📱 Platform Support

### Mobile
- **iOS 13+** - iPhone and iPad
- **Android 8+** - Phone and tablet
- **Deep Linking** - Custom URL schemes (`bianca://`)
- **Push Notifications** - Real-time updates
- **Biometric Auth** - Face ID, Touch ID, Fingerprint

### Web
- **Modern Browsers** - Chrome, Firefox, Safari, Edge
- **Responsive Design** - Desktop and mobile layouts
- **PWA Support** - Progressive Web App capabilities

## 🧪 Testing

```bash
yarn test              # Unit tests
yarn test:watch        # Tests in watch mode
yarn test:web:e2e      # Web E2E tests
yarn test:maestro      # Mobile E2E tests
```

## 📱 App Store Information

### Google Play Store
- **Package**: `com.negascout.bianca`
- **Category**: Medical
- **Version**: 1.0.0

### Apple App Store
- **Bundle ID**: `com.negascout.bianca`
- **Category**: Medical
- **Version**: 1.0.0

## 📞 Support

- **Email**: support@myphonefriend.com
- **Phone**: +1-604-562-4263
- **Address**: 2955 Elbow Place, Port Coquitlam, BC V3B 7T3

---

**MyPhoneFriend** - Secure Healthcare Communication Platform