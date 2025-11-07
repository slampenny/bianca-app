import { defineConfig } from '@playwright/test'

export default defineConfig({
  timeout: 60000, // Increase timeout for integration tests
  testDir: './test/e2e',
  use: {
    screenshot: 'only-on-failure',
    baseURL: 'http://localhost:8081',
    headless: true,
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    testIdAttribute: 'accessibilityLabel', // Use accessibilityLabel for React Native Web
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
  ],
  globalSetup: require.resolve('./test/e2e/helpers/globalSetup'),
  reporter: [
    ['list'],
    ['html', { open: 'never' }] // Don't automatically open HTML report server
  ],
})
