/**
 * These are configuration settings for the test environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
const PRIMARY_DOMAIN = "localhost";

const config = {
  PRIMARY_DOMAIN,
  API_URL: "http://localhost:3000/v1",
  persistNavigation: "never", // Disable navigation persistence in tests
}

export default config

// Simple test to satisfy Jest
describe('config', () => {
  it('should export config with required properties', () => {
    expect(config.PRIMARY_DOMAIN).toBe('localhost')
    expect(config.API_URL).toBe('http://localhost:3000/v1')
    expect(config.persistNavigation).toBe('never')
  })
}) 