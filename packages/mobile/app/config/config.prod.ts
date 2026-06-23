/**
 * These are configuration settings for the production environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */

// Primary domain (single source of truth)
const PRIMARY_DOMAIN = "biancawellness.com";

export default {
  PRIMARY_DOMAIN,
  API_URL: `https://api.${PRIMARY_DOMAIN}/v1`,
  androidPlayStoreUrl: "https://play.google.com/store/apps/details?id=com.negascout.bianca",
  // Set IOS_APP_STORE_URL in AWS Secrets Manager when the App Store listing is live
  iosAppStoreUrl: "",
}
