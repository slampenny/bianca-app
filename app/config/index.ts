/**
 * This file imports configuration objects from either the config.dev.js file
 * or the config.prod.js file depending on whether we are in __DEV__ or not.
 *
 * Note that we do not gitignore these files. Unlike on web servers, just because
 * these are not checked into your repo doesn't mean that they are secure.
 * In fact, you're shipping a JavaScript bundle with every
 * config variable in plain text. Anyone who downloads your app can easily
 * extract them.
 *
 * If you doubt this, just bundle your app, and then go look at the bundle and
 * search it for one of your config variable values. You'll find it there.
 *
 * Read more here: https://reactnative.dev/docs/security#storing-sensitive-info
 */
import BaseConfig from "./config.base"
import ProdConfig from "./config.prod"
import DevConfig from "./config.dev"
import TestConfig from "./config.test"
import StagingConfig from "./config.staging"
import Constants from "expo-constants"

// Check for test environment first to avoid window access issues
let ExtraConfig = ProdConfig

if (process.env.NODE_ENV === 'test' || 
    process.env.PLAYWRIGHT_TEST === '1' ||
    process.env.JEST_WORKER_ID) {
  ExtraConfig = TestConfig
  console.log('Using TEST config');
} else {
  // Debug logging (only when not in test environment)
  console.log('Config loading - Environment check:', {
    __DEV__: typeof __DEV__ !== 'undefined' ? __DEV__ : 'undefined',
    NODE_ENV: process.env.NODE_ENV,
    PLAYWRIGHT_TEST: process.env.PLAYWRIGHT_TEST,
    JEST_WORKER_ID: process.env.JEST_WORKER_ID,
    expo_environment: Constants.expoConfig?.extra?.environment || 'undefined',
    window_location: typeof window !== 'undefined' ? window.location.hostname : 'undefined'
  });

  // Use dev config for development
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    ExtraConfig = DevConfig
    console.log('Using DEV config');
  }
  // Use staging config if explicitly set in Expo config
  else if (Constants.expoConfig?.extra?.environment === 'staging') {
    ExtraConfig = StagingConfig
    console.log('Using STAGING config (from Expo constants)');
  } else {
    console.log('Using PROD config');
  }
}

const Config = { ...BaseConfig, ...ExtraConfig }

console.log('Final API_URL:', Config.API_URL);

export default Config
