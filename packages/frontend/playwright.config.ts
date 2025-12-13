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
  // Note: Backend (port 3000) and Frontend (port 8081) servers must be running
  // Start them with `yarn dev` from the root directory before running tests
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    // Firefox disabled due to XPCOM launch issues in test environment
    // {
    //   name: 'firefox',
    //   use: { browserName: 'firefox' },
    // },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never' }] // Don't automatically open HTML report server
  ],
})
