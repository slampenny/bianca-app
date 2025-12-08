import { FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  // Set environment variables for test environment
  process.env.NODE_ENV = 'test'
  process.env.PLAYWRIGHT_TEST = '1'
  process.env.API_BASE_URL = 'http://localhost:3000/v1'
  
  console.log('Global setup - Environment variables set:', {
    NODE_ENV: process.env.NODE_ENV,
    PLAYWRIGHT_TEST: process.env.PLAYWRIGHT_TEST,
    API_BASE_URL: process.env.API_BASE_URL
  })
}

export default globalSetup 