import { FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  // Set environment variable for API base URL
  process.env.API_BASE_URL = 'http://localhost:3000/v1'
}

export default globalSetup 