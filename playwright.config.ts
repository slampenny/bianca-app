import { defineConfig } from '@playwright/test'

export default defineConfig({
  timeout: 30000, // Increase timeout for integration tests
  testDir: './test/e2e',
  use: {
    screenshot: 'only-on-failure',
    baseURL: 'http://localhost:8082',
    headless: false,
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  globalSetup: require.resolve('./test/e2e/helpers/globalSetup'),
  reporter: [
    ['list'],
    ['html']
  ],
})
