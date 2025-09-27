import { defineConfig } from '@playwright/test'

/**
 * Special configuration for SSO and Invite workflow tests
 * These tests require more time and specific setup
 */
export default defineConfig({
  timeout: 30000, // Longer timeout for SSO flows
  testDir: './test/e2e',
  use: {
    screenshot: 'only-on-failure',
    baseURL: 'http://localhost:8081',
    headless: false, // Keep visible for debugging SSO flows
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    // Slower actions for more reliable SSO testing
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'sso-tests',
      testMatch: '**/sso*.e2e.test.ts',
      use: {
        // Additional setup for SSO tests
        extraHTTPHeaders: {
          'Accept': 'application/json',
        },
      },
    },
    {
      name: 'invite-tests',
      testMatch: '**/invite*.e2e.test.ts',
      use: {
        // Additional setup for invite tests
        extraHTTPHeaders: {
          'Accept': 'application/json',
        },
      },
    },
    {
      name: 'integration-tests',
      testMatch: '**/sso-invite-integration*.e2e.test.ts',
      use: {
        // Additional setup for integration tests
        extraHTTPHeaders: {
          'Accept': 'application/json',
        },
      },
    },
  ],
  globalSetup: require.resolve('./helpers/globalSetup'),
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-sso-invite' }],
    ['json', { outputFile: 'test-results-sso-invite.json' }],
  ],
  // Retry failed tests
  retries: 2,
  // Run tests in parallel but limit concurrency
  workers: 2,
})
