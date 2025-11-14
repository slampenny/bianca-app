import { defineConfig } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'test-logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

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
  // Capture console logs and errors
  globalSetup: require.resolve('./test/e2e/helpers/globalSetup'),
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
