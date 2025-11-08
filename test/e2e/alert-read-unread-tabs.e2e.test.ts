import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'

test.describe("Alert Read/Unread Tabs Verification", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
    await expect(page.getByLabel('home-header')).toBeVisible()
  })

  test("should show different items on Unread vs All Alerts tabs when alerts are read", async ({ page }) => {
    console.log('=== ALERT READ/UNREAD TABS TEST ===')
    
    // Navigate to alert screen
    const alertTab = page.getByLabel('Alerts tab').or(page.getByTestId('tab-alert').or(page.getByLabel('Alerts tab')))
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    await expect(page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))).toBeVisible()
    
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
    
    // Now switch to "All Alerts" tab
    const allButton = page.getByLabel(/all alerts/i).or(page.getByText(/all alerts/i))
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
    
    // Switch back to "Unread Alerts" tab
    const unreadButton = page.getByLabel(/unread/i).or(page.getByText(/unread/i))
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
    
    // Navigate to alert screen
    const alertTab = page.getByLabel('Alerts tab').or(page.getByTestId('tab-alert').or(page.getByLabel('Alerts tab')))
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    await expect(page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))).toBeVisible()
    
    // We're on "Unread Alerts" tab by default
    const unreadCount = await page.locator('[data-testid="alert-item"]').count()
    console.log(`Unread alerts: ${unreadCount}`)
    
    if (unreadCount === 0) {
      console.log('⚠ No alerts to test - skipping test')
      return
    }
    
    // Switch to "All Alerts" tab
    const allButton = page.getByLabel(/all alerts/i).or(page.getByText(/all alerts/i))
    await allButton.first().click()
    await page.waitForTimeout(1000)
    
    const allCount = await page.locator('[data-testid="alert-item"]').count()
    console.log(`All alerts: ${allCount}`)
    
    // When all alerts are unread, both tabs should show the same count
    expect(allCount).toBe(unreadCount)
    console.log(`✅ Verified: Both tabs show same count (${allCount}) when all alerts are unread`)
  })
})





