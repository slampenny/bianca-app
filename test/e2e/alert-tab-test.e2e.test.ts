import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome, isHomeScreen } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'

test.describe("Alert Tab Test", () => {
  test.beforeEach(async ({ page }) => {
    // Capture console logs to see alert debug info
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()))
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
  })

  test("check alert tab badge count vs alert screen", async ({ page }) => {
    console.log('=== ALERT TAB TEST ===')
    
    // GIVEN: I'm on the home screen
    await expect(page.getByLabel('home-header')).toBeVisible()
    
    // WHEN: I check the alert tab badge
    const alertTab = page.getByTestId('tab-alert').or(page.getByLabel('Alerts tab'))
    await alertTab.waitFor({ state: 'visible' })
    
    // Check if there's a badge on the alert tab - look for the actual badge element
    const badgeElement = page.locator('[data-testid="tab-alert"] span[style*="background-color: rgb(255, 59, 48)"]')
    const badgeCount = await badgeElement.count()
    console.log('Alert tab badge elements found:', badgeCount)
    
    if (badgeCount > 0) {
      const badgeText = await badgeElement.textContent()
      console.log('Alert tab badge text:', badgeText)
    }
    
    // Debug: Check the actual DOM structure of the alert tab
    const alertTabHTML = await page.locator('[data-testid="tab-alert"]').innerHTML()
    console.log('Alert tab HTML:', alertTabHTML)
    
    // Check for any badge-related elements
    const allBadgeElements = await page.locator('[class*="badge"], [data-badge], [aria-label*="badge"]').count()
    console.log('All badge elements found:', allBadgeElements)
    
    // Debug: Check Redux state for unread alert count
    const unreadCount = await page.evaluate(() => {
      // Access Redux store if available
      const store = (window as any).__REDUX_STORE__ || (window as any).store
      if (store && store.getState) {
        const state = store.getState()
        console.log('Redux state:', state)
        return state.alert?.alerts?.length || 0
      }
      return 0
    })
    console.log('Redux unread count:', unreadCount)
    
    // Navigate to alert screen
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    // Check alert screen content
    const alertElements = await page.locator('[data-testid*="alert"], .alert-item, [class*="alert"]').count()
    console.log('Alert elements on alert screen:', alertElements)
    
    // Check for unread/all toggle buttons
    const unreadButton = page.getByText(/unread/i)
    const allButton = page.getByText(/all/i)
    
    const unreadButtonCount = await unreadButton.count()
    const allButtonCount = await allButton.count()
    
    console.log('Unread button found:', unreadButtonCount)
    console.log('All button found:', allButtonCount)
    
    if (unreadButtonCount > 0) {
      try {
        const unreadButtonText = await unreadButton.first().textContent({ timeout: 3000 })
        console.log('Unread button text:', unreadButtonText)
      } catch (error) {
        console.log('Could not get unread button text:', error instanceof Error ? error.message : String(error))
      }
    }
    
    if (allButtonCount > 0) {
      try {
        const allButtonText = await allButton.first().textContent({ timeout: 3000 })
        console.log('All button text:', allButtonText)
      } catch (error) {
        console.log('Could not get all button text:', error instanceof Error ? error.message : String(error))
      }
    }
    
    // THEN: Should be able to navigate to alerts and see the discrepancy
    expect(alertElements).toBeGreaterThan(0)
    console.log('✅ Alert screen accessible and shows alerts')
    console.log('=== ALERT TAB TEST COMPLETE ===')
  })
})
