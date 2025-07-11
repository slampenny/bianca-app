import { defineConfig } from '@playwright/test'

export default defineConfig({
  timeout: 10000,
  testDir: './test/e2e',
  use: {
    screenshot: 'only-on-failure',
    baseURL: 'http://localhost:8081',
    headless: false,
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  globalSetup: require.resolve('./test/e2e/helpers/globalSetup'),
  reporter: [
    ['html'],
    ['list']
  ],
})
