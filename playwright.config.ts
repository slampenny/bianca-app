import { defineConfig } from '@playwright/test'

export default defineConfig({
  timeout: 30000,
  testDir: './test/e2e',
  use: {
    baseURL: 'http://localhost:8081', // or 19006 depending on how you run expo web
    headless: true,
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
