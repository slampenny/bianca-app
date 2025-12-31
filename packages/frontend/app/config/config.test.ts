/**
 * These are configuration settings for the test environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
const PRIMARY_DOMAIN = "localhost";

export default {
  PRIMARY_DOMAIN,
  API_URL: "http://localhost:3000/v1",
  persistNavigation: "never", // Disable navigation persistence in tests
} 