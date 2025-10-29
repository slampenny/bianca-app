import { test, expect } from '@playwright/test'

test.describe('App Loading', () => {
  test('should load without JavaScript errors', async ({ page }) => {
    const criticalErrors: string[] = []
    
    // Capture page errors
    page.on('pageerror', (exception) => {
      criticalErrors.push(exception.message)
      console.error('PAGE ERROR:', exception.message)
    })
    
    // Capture console logs for debugging
    page.on('console', (message) => {
      console.log(`CONSOLE ${message.type()}: ${message.text()}`)
    })

    console.log('Navigating to app...')
    await page.goto('/')
    console.log('Waiting for app to load...')
    await page.waitForLoadState('networkidle')

    console.log('=== CONSOLE LOGS ===')
    // Console logs are captured by page.on('console') above

    console.log('=== PAGE ERRORS ===')
    criticalErrors.forEach(error => console.error(error))

    // The app should load without critical errors
    expect(criticalErrors.length).toBe(0)

    // Check that the root element exists
    const rootElement = await page.locator('#root').count()
    expect(rootElement).toBeGreaterThan(0)
  })
})