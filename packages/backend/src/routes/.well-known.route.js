const express = require('express');
const router = express.Router();
const config = require('../config/config');

/**
 * iOS Universal Links - Apple App Site Association
 * This file must be served at: https://yourdomain.com/.well-known/apple-app-site-association
 * Content-Type must be application/json (not text/plain)
 */
router.get('/apple-app-site-association', (req, res) => {
  // Set correct Content-Type for iOS Universal Links
  res.setHeader('Content-Type', 'application/json');
  
  // Don't cache this file - iOS checks it frequently
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  
  const association = {
    applinks: {
      apps: [], // iOS apps don't need to be listed here
      details: [
        {
          // Format: TEAM_ID.BUNDLE_ID
          // Get Team ID from: https://developer.apple.com/account
          // Or from Xcode: Preferences → Accounts → Select your account → Team ID
          appID: 'TEAM_ID.com.negascout.bianca', // TODO: Replace TEAM_ID with your Apple Team ID
          paths: [
            '/v1/auth/verify-email*',
            '/auth/verify-email*',
            '/email-verified*',
          ],
        },
      ],
    },
    // Optional: Add webcredentials for password autofill
    webcredentials: {
      apps: ['TEAM_ID.com.negascout.bianca'], // Replace TEAM_ID with your Apple Team ID
    },
  };
  
  res.json(association);
});

/**
 * Android App Links - Asset Links
 * This file must be served at: https://yourdomain.com/.well-known/assetlinks.json
 */
router.get('/assetlinks.json', (req, res) => {
  // Set correct Content-Type
  res.setHeader('Content-Type', 'application/json');
  
  // Don't cache this file
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  
  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.negascout.bianca',
        sha256_cert_fingerprints: [
          // Add your app's SHA-256 certificate fingerprints here
          // For debug builds, get with: keytool -list -v -keystore ~/.android/debug.keystore
          // For release builds, get from your app signing key
          // Example: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'
        ],
      },
    },
  ];
  
  res.json(assetLinks);
});

module.exports = router;

