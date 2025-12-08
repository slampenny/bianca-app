import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'

test.describe("Alert Read/Unread Tabs Verification", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
    // Verify we're on home screen - flexible check
    const emailInput = page.locator('input[data-testid="email-input"]')
    const isOnLogin = await emailInput.isVisible({ timeout: 2000 }).catch(() => false)
    expect(isOnLogin).toBe(false)
  })

  test("should show different items on Unread vs All Alerts tabs when alerts are read", async ({ page }) => {
    console.log('=== ALERT READ/UNREAD TABS TEST ===')
    
    // Navigate to alert screen - try multiple selectors
    let alertTab = page.getByTestId('tab-alert')
    let tabCount = await alertTab.count().catch(() => 0)
    
    if (tabCount === 0) {
      alertTab = page.locator('[data-testid="tab-alert"], [aria-label="Alerts tab"], [aria-label*="alert" i]').first()
      tabCount = await alertTab.count().catch(() => 0)
    }
    
    if (tabCount === 0) {
      throw new Error('Alert tab not found')
    }
    
    await alertTab.waitFor({ state: 'visible', timeout: 10000 })
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    // Verify we're on alert screen
    const alertScreen = page.locator('[data-testid="alert-screen"], [aria-label*="alert" i]').first()
    await expect(alertScreen).toBeVisible({ timeout: 10000 }).catch(async () => {
      // Fallback: check if we can see alert items
      const alertItems = page.locator('[data-testid="alert-item"]')
      const hasAlerts = await alertItems.count() > 0
      if (!hasAlerts) {
        await page.waitForTimeout(2000)
        const hasAlertsAfterWait = await alertItems.count() > 0
        if (!hasAlertsAfterWait) {
          throw new Error('Alert screen not found and no alert items visible')
        }
      }
    })
    
    // Get initial state - we're on "Unread Alerts" tab by default
    const initialUnreadCount = await page.locator('[data-testid="alert-item"]').count()
    console.log(`Initial unread alerts: ${initialUnreadCount}`)
    
    if (initialUnreadCount === 0) {
      console.log('⚠ No alerts to test - skipping test')
      return
    }
    
    // Mark the first alert as read
    const alertItems = page.locator('[data-testid="alert-item"]')
    await alertItems.first().click()
    await page.waitForTimeout(2000) // Wait for API call to complete
    
    // Verify we're still on Unread tab and count has decreased
    const unreadAfterMarking = await page.locator('[data-testid="alert-item"]').count()
    console.log(`Unread alerts after marking one as read: ${unreadAfterMarking}`)
    
    // CRITICAL: Unread count should be less than initial (or 0 if we marked the only one)
    expect(unreadAfterMarking).toBeLessThan(initialUnreadCount)
    
    // Now switch to "All Alerts" tab - try multiple selectors
    let allButton = page.getByText(/all alerts/i)
    let allButtonCount = await allButton.count().catch(() => 0)
    
    if (allButtonCount === 0) {
      allButton = page.locator('[data-testid*="all"], [aria-label*="all" i]').first()
      allButtonCount = await allButton.count().catch(() => 0)
    }
    
    if (allButtonCount === 0) {
      throw new Error('All Alerts button/tab not found')
    }
    
    await allButton.first().waitFor({ state: 'visible', timeout: 5000 })
    await allButton.first().click()
    await page.waitForTimeout(1000)
    
    // CRITICAL: "All Alerts" should show MORE alerts than "Unread Alerts"
    const allAlertsCount = await page.locator('[data-testid="alert-item"]').count()
    console.log(`All alerts count: ${allAlertsCount}`)
    
    // The "All Alerts" count should be greater than or equal to unread count
    // Since we marked at least one as read, it should be greater
    expect(allAlertsCount).toBeGreaterThanOrEqual(unreadAfterMarking)
    
    // If we marked alerts as read, "All Alerts" should have MORE than "Unread"
    if (initialUnreadCount > 0 && unreadAfterMarking < initialUnreadCount) {
      expect(allAlertsCount).toBeGreaterThan(unreadAfterMarking)
      console.log(`✅ Verified: All Alerts (${allAlertsCount}) > Unread Alerts (${unreadAfterMarking})`)
    }
    
    // Switch back to "Unread Alerts" tab - try multiple selectors
    let unreadButton = page.getByText(/unread/i)
    let unreadButtonCount = await unreadButton.count().catch(() => 0)
    
    if (unreadButtonCount === 0) {
      unreadButton = page.locator('[data-testid*="unread"], [aria-label*="unread" i]').first()
      unreadButtonCount = await unreadButton.count().catch(() => 0)
    }
    
    if (unreadButtonCount === 0) {
      throw new Error('Unread Alerts button/tab not found')
    }
    
    await unreadButton.first().waitFor({ state: 'visible', timeout: 5000 })
    await unreadButton.first().click()
    await page.waitForTimeout(1000)
    
    // Verify count matches what we saw before
    const unreadCountFinal = await page.locator('[data-testid="alert-item"]').count()
    expect(unreadCountFinal).toBe(unreadAfterMarking)
    console.log(`✅ Verified: Unread count is still ${unreadCountFinal} after switching back`)
    
    // Verify the tabs show DIFFERENT items
    expect(allAlertsCount).not.toBe(unreadAfterMarking)
    console.log(`✅ Verified: Tabs show different counts (All: ${allAlertsCount}, Unread: ${unreadAfterMarking})`)
    
    console.log('✅ Test passed - tabs correctly show different items when alerts are read')
  })

  test("should show same items on both tabs when all alerts are unread", async ({ page }) => {
    console.log('=== ALL ALERTS UNREAD TEST ===')
    
    // Navigate to alert screen - try multiple selectors
    let alertTab = page.getByTestId('tab-alert')
    let tabCount = await alertTab.count().catch(() => 0)
    
    if (tabCount === 0) {
      alertTab = page.locator('[data-testid="tab-alert"], [aria-label="Alerts tab"], [aria-label*="alert" i]').first()
      tabCount = await alertTab.count().catch(() => 0)
    }
    
    if (tabCount === 0) {
      throw new Error('Alert tab not found')
    }
    
    await alertTab.waitFor({ state: 'visible', timeout: 10000 })
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    // Verify we're on alert screen
    const alertScreen = page.locator('[data-testid="alert-screen"], [aria-label*="alert" i]').first()
    await expect(alertScreen).toBeVisible({ timeout: 10000 }).catch(async () => {
      // Fallback: check if we can see alert items
      const alertItems = page.locator('[data-testid="alert-item"]')
      const hasAlerts = await alertItems.count() > 0
      if (!hasAlerts) {
        await page.waitForTimeout(2000)
        const hasAlertsAfterWait = await alertItems.count() > 0
        if (!hasAlertsAfterWait) {
          throw new Error('Alert screen not found and no alert items visible')
        }
      }
    })
    
    // We're on "Unread Alerts" tab by default
    const unreadCount = await page.locator('[data-testid="alert-item"]').count()
    console.log(`Unread alerts: ${unreadCount}`)
    
    if (unreadCount === 0) {
      console.log('⚠ No alerts to test - skipping test')
      return
    }
    
    // Switch to "All Alerts" tab - try multiple selectors
    let allButton = page.getByText(/all alerts/i)
    let allButtonCount = await allButton.count().catch(() => 0)
    
    if (allButtonCount === 0) {
      allButton = page.locator('[data-testid*="all"], [aria-label*="all" i]').first()
      allButtonCount = await allButton.count().catch(() => 0)
    }
    
    if (allButtonCount === 0) {
      throw new Error('All Alerts button/tab not found')
    }
    
    await allButton.first().waitFor({ state: 'visible', timeout: 5000 })
    await allButton.first().click()
    await page.waitForTimeout(1000)
    
    const allCount = await page.locator('[data-testid="alert-item"]').count()
    console.log(`All alerts: ${allCount}`)
    
    // When all alerts are unread, both tabs should show the same count
    expect(allCount).toBe(unreadCount)
    console.log(`✅ Verified: Both tabs show same count (${allCount}) when all alerts are unread`)
  })
})





