import { Page } from '@playwright/test'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'

/**
 * Seed the database using the backend seeding endpoint
 * Only works in development/test environments
 */
export async function seedDatabase(page: Page): Promise<void> {
  try {
    const response = await page.request.post(`${API_BASE_URL}/test/seed`)
    
    if (!response.ok()) {
      const errorText = await response.text()
      throw new Error(`Failed to seed database: ${response.status()} ${errorText}`)
    }
    
    const result = await response.json()
    console.log('Database seeded successfully:', result.message)
    return result
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}

/**
 * Clean the database using the backend clean endpoint
 * Only works in development/test environments
 */
export async function cleanDatabase(page: Page): Promise<void> {
  try {
    const response = await page.request.post(`${API_BASE_URL}/test/clean`)
    
    if (!response.ok()) {
      const errorText = await response.text()
      throw new Error(`Failed to clean database: ${response.status()} ${errorText}`)
    }
    
    const result = await response.json()
    console.log('Database cleaned successfully:', result.message)
    return result
  } catch (error) {
    console.error('Error cleaning database:', error)
    throw error
  }
}

/**
 * Retrieve the last email sent to a recipient from Ethereal
 * Only works when NODE_ENV is development or test and Ethereal is configured
 * @param page - Playwright page instance
 * @param email - Email address to retrieve email for
 * @param waitForEmail - Whether to wait for email to arrive (default: false)
 * @param maxWaitMs - Maximum time to wait in milliseconds (default: 30000)
 * @returns Email object with subject, text, html, and extracted tokens
 */
export async function getEmailFromEthereal(
  page: Page,
  email: string,
  waitForEmail = false,
  maxWaitMs = 30000
): Promise<{
  subject: string
  from: string
  to: string
  text: string
  html: string
  date: Date
  tokens: {
    verification: string | null
    invite: string | null
    resetPassword: string | null
  }
}> {
  try {
    const response = await page.request.post(`${API_BASE_URL}/test/get-email`, {
      data: {
        email,
        waitForEmail,
        maxWaitMs,
      },
    })
    
    if (!response.ok()) {
      const errorText = await response.text()
      throw new Error(`Failed to retrieve email: ${response.status()} ${errorText}`)
    }
    
    const result = await response.json()
    if (!result.success || !result.email) {
      throw new Error(`Email retrieval failed: ${result.message || 'Unknown error'}`)
    }
    
    return result.email
  } catch (error) {
    console.error('Error retrieving email from Ethereal:', error)
    throw error
  }
}

