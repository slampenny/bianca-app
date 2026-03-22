import { test, expect } from '@playwright/test'
import { loginUserViaUI } from './helpers/testHelpers'
import { TEST_USERS } from './fixtures/testData'
import { API_URL } from './helpers/testConfig'

/**
 * Test to verify OpenAI voice connection is working
 * 
 * This test ensures that:
 * 1. The app can connect to OpenAI Realtime API
 * 2. A session can be created successfully
 * 3. Voice configuration is properly set up
 * 
 * This is a critical health check to ensure the voice functionality
 * is available before running other tests that depend on it.
 */
test.describe('OpenAI Voice Connection', () => {
  test('should successfully connect to OpenAI and verify voice configuration', async ({ page }) => {
    // Login to get authentication token (must match /v1/test/seed — seed creates fake@example.org, not no-clients@example.org)
    await page.goto('/')
    await loginUserViaUI(page, TEST_USERS.WITH_PATIENTS.email, TEST_USERS.WITH_PATIENTS.password)
    
    // Wait for home screen to ensure login is complete
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
    
    // Wait for auth token to be stored in localStorage
    await page.waitForFunction(() => {
      try {
        const authState = localStorage.getItem('persist:root')
        if (authState) {
          const parsed = JSON.parse(authState)
          const auth = JSON.parse(parsed.auth || '{}')
          return !!auth.tokens?.access?.token
        }
        return false
      } catch {
        return false
      }
    }, { timeout: 10000 })
    
    // Get auth token from localStorage
    const authToken = await page.evaluate(() => {
      try {
        const authState = localStorage.getItem('persist:root')
        if (authState) {
          const parsed = JSON.parse(authState)
          const auth = JSON.parse(parsed.auth || '{}')
          return auth.tokens?.access?.token
        }
      } catch (error) {
        console.error('Error getting auth token:', error)
      }
      return null
    })
    
    expect(authToken).toBeTruthy()
    console.log('✅ Auth token retrieved')
    
    // Make API call to test OpenAI connection
    const response = await page.request.post(`${API_URL}/test/openai-connection`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      data: {},
    })
    
    // Verify response status
    expect(response.status()).toBe(200)
    console.log('✅ API endpoint responded successfully')
    
    // Parse response
    const result = await response.json()
    
    // Verify the connection test was successful
    expect(result.success).toBe(true)
    console.log(`✅ OpenAI connection test succeeded (API Version: ${result.apiVersion})`)
    
    // Verify session was created
    expect(result.sessionId).toBeTruthy()
    console.log(`✅ Session created: ${result.sessionId}`)
    
    // Verify voice configuration is present
    expect(result.sessionDetails).toBeTruthy()
    expect(result.sessionDetails.session).toBeTruthy()
    expect(result.sessionDetails.session.voice).toBeTruthy()
    expect(result.sessionDetails.session.model).toBeTruthy()
    console.log(`✅ Voice configured: ${result.sessionDetails.session.voice}`)
    console.log(`✅ Model configured: ${result.sessionDetails.session.model}`)
    
    // Verify the test received expected messages
    expect(result.receivedMessages).toBeTruthy()
    expect(Array.isArray(result.receivedMessages)).toBe(true)
    
    // Check that we received session.created and session.updated messages
    const messageTypes = result.receivedMessages.map((msg: any) => msg.type)
    expect(messageTypes).toContain('session.created')
    expect(messageTypes).toContain('session.updated')
    console.log('✅ Received expected session messages')
    
    console.log('\n✅ OpenAI voice connection test completed successfully!')
    console.log(`   API Version: ${result.apiVersion}`)
    console.log(`   Voice: ${result.sessionDetails.session.voice}`)
    console.log(`   Model: ${result.sessionDetails.session.model}`)
    console.log(`   Session ID: ${result.sessionId}`)
  })
})
