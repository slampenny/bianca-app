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
import StagingConfig from "./config.staging"
import DemoConfig from "./config.demo"
import Constants from "expo-constants"
import { logger } from "../utils/logger"

const browserHostname =
  typeof window !== "undefined" ? window.location?.hostname : undefined

// Check for test environment first to avoid window access issues
// Note: config.test.ts is excluded from staging/production builds via metro.config.js blockList
// So we can't import it here. In test environments, we'll use DevConfig as a fallback
// since test environments typically run locally and can use dev settings
let ExtraConfig = ProdConfig

if (process.env.NODE_ENV === 'test' || 
    process.env.PLAYWRIGHT_TEST === '1' ||
    process.env.JEST_WORKER_ID) {
  // Use DevConfig as fallback for test environments since config.test.ts is blocked in builds
  // This is safe because test environments typically run locally and can use dev settings
  ExtraConfig = DevConfig
  logger.debug('Using DEV config for test environment (config.test.ts excluded from builds)');
} else {
  // Debug logging (only when not in test environment)
  logger.debug('Config loading - Environment check:', {
    __DEV__: typeof __DEV__ !== 'undefined' ? __DEV__ : 'undefined',
    NODE_ENV: process.env.NODE_ENV,
    PLAYWRIGHT_TEST: process.env.PLAYWRIGHT_TEST,
    JEST_WORKER_ID: process.env.JEST_WORKER_ID,
    expo_environment: Constants.expoConfig?.extra?.environment || 'undefined',
    window_location: browserHostname ?? 'undefined'
  });

  // For web: if running on localhost or loopback, use dev config (for local testing and Playwright tests)
  if (browserHostname === 'localhost' || browserHostname === '127.0.0.1') {
    ExtraConfig = DevConfig
    logger.debug('Using DEV config (localhost / 127.0.0.1 detected)');
  }
  // Use dev config for development
  else if (typeof __DEV__ !== 'undefined' && __DEV__) {
    ExtraConfig = DevConfig
    logger.debug('Using DEV config');
  }
  // Use demo config if running on demo.biancawellness.com
  else if (browserHostname === 'demo.biancawellness.com') {
    ExtraConfig = DemoConfig
    logger.debug('Using DEMO config (demo.biancawellness.com detected)');
  }
  // Use staging config if explicitly set in Expo config or build-time environment
  else if (Constants.expoConfig?.extra?.environment === 'staging' || 
           process.env.EXPO_PUBLIC_ENVIRONMENT === 'staging') {
    ExtraConfig = StagingConfig
    logger.debug('Using STAGING config (from Expo constants or build env)');
  } else {
    logger.debug('Using PROD config');
  }
}

const Config = { ...BaseConfig, ...ExtraConfig }

// Runtime override: If running on demo.biancawellness.com, force API_URL to use same origin
// This works even if the bundle was built with staging config
if (browserHostname === 'demo.biancawellness.com') {
  Config.API_URL = `https://demo.biancawellness.com/v1`
  logger.debug('Runtime override: Using demo API URL (same origin)');
}

logger.debug('Final API_URL:', Config.API_URL);

export default Config
