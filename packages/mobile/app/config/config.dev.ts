/**
 * These are configuration settings for the dev environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
const PRIMARY_DOMAIN = "localhost";

export default {
  PRIMARY_DOMAIN,
  API_URL: "http://localhost:3000/v1",
  /** Seeded by yarn seed / POST /v1/test/seed — use for local mobile (B2C) dev. */
  devLogin: {
    email: "parent@example.org",
    password: "Password1",
  },
}
