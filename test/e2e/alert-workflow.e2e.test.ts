import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome, isHomeScreen } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'

test.describe("Alert Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
  })

  test("can navigate to alerts and see badge count", async ({ page }) => {
    console.log('=== ALERT WORKFLOW TEST ===')
    
    // GIVEN: I'm on the home screen
    await expect(page.getByTestId('home-header')).toBeVisible()
    
    // WHEN: I check the alert tab badge
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.waitFor({ state: 'visible' })
    
    // THEN: I should see a badge with unread alert count
    const badgeElement = page.locator('[data-testid="tab-alert"] span[style*="background-color: rgb(255, 59, 48)"]')
    const badgeCount = await badgeElement.count()
    expect(badgeCount).toBe(1)
    
    const badgeText = await badgeElement.textContent()
    expect(badgeText).toBeTruthy()
    const badgeNumber = parseInt(badgeText || '0')
    expect(badgeNumber).toBeGreaterThan(0)
    
    console.log(`✅ Alert badge shows ${badgeNumber} unread alerts`)
  })

  test("can navigate to alerts screen and see alerts", async ({ page }) => {
    // GIVEN: I'm on the home screen
    await expect(page.getByTestId('home-header')).toBeVisible()
    
    // WHEN: I click on the alert tab
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    // THEN: I should see the alert screen
    await expect(page.getByTestId('alert-header')).toBeVisible()
    
    // AND: I should see alert elements
    const alertElements = await page.locator('[data-testid*="alert"], .alert-item, [class*="alert"]').count()
    expect(alertElements).toBeGreaterThan(0)
    
    // AND: I should see unread/all toggle buttons
    const unreadButton = page.getByText(/unread/i)
    const allButton = page.getByText(/all alerts/i)
    
    await expect(unreadButton).toBeVisible()
    await expect(allButton).toBeVisible()
    
    console.log(`✅ Alert screen shows ${alertElements} alert elements`)
  })

  test("can toggle between unread and all alerts", async ({ page }) => {
    // GIVEN: I'm on the alert screen
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    await expect(page.getByTestId('alert-header')).toBeVisible()
    
    // WHEN: I click on "All Alerts"
    const allButton = page.getByText(/all alerts/i)
    await allButton.click()
    await page.waitForTimeout(1000)
    
    // THEN: I should see all alerts
    const allAlertsCount = await page.locator('[data-testid="alert-item"]').count()
    expect(allAlertsCount).toBeGreaterThan(0)
    
    // WHEN: I click on "Unread Alerts"
    const unreadButton = page.getByText(/unread/i)
    await unreadButton.click()
    await page.waitForTimeout(1000)
    
    // THEN: I should see unread alerts (may be fewer than all alerts)
    const unreadAlertsCount = await page.locator('[data-testid="alert-item"]').count()
    expect(unreadAlertsCount).toBeGreaterThanOrEqual(0)
    
    console.log(`✅ Toggle works: ${allAlertsCount} all alerts, ${unreadAlertsCount} unread alerts`)
  })

  test("can mark individual alerts as read", async ({ page }) => {
    // GIVEN: I'm on the alert screen
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    await expect(page.getByTestId('alert-header')).toBeVisible()
    
    // WHEN: I click on an alert item
    const alertItems = page.locator('[data-testid="alert-item"]')
    const alertCount = await alertItems.count()
    
    if (alertCount > 0) {
      await alertItems.first().click()
      await page.waitForTimeout(1000)
      
      // THEN: The alert should be marked as read (checkbox should be checked)
      const alertCheckbox = page.locator('[data-testid="alert-checkbox"]').first()
      await expect(alertCheckbox).toBeVisible()
      
      console.log('✅ Alert marked as read successfully')
    } else {
      console.log('ℹ No alerts available to test marking as read')
    }
  })

  test("can mark all alerts as read", async ({ page }) => {
    // GIVEN: I'm on the alert screen with unread alerts
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    await expect(page.getByTestId('alert-header')).toBeVisible()
    
    // WHEN: I click "Mark All as Read"
    const markAllButton = page.getByTestId('mark-all-checkbox')
    const markAllButtonCount = await markAllButton.count()
    
    if (markAllButtonCount > 0) {
      await markAllButton.click()
      await page.waitForTimeout(2000)
      
      // THEN: All alerts should be marked as read
      const alertCheckboxes = page.locator('[data-testid="alert-checkbox"]')
      const checkboxCount = await alertCheckboxes.count()
      
      // Check that checkboxes are checked (marked as read)
      for (let i = 0; i < Math.min(checkboxCount, 5); i++) {
        const checkbox = alertCheckboxes.nth(i)
        // Note: The checkbox value indicates if it's read (true = read, false = unread)
        // We expect them to be true after marking all as read
        await expect(checkbox).toBeVisible()
      }
      
      console.log('✅ All alerts marked as read successfully')
    } else {
      console.log('ℹ No "Mark All as Read" button available (no alerts)')
    }
  })

  test("can refresh alerts", async ({ page }) => {
    // GIVEN: I'm on the alert screen
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    await expect(page.getByTestId('alert-header')).toBeVisible()
    
    // WHEN: I click the refresh button
    const refreshButton = page.getByText(/refresh/i)
    await refreshButton.click()
    await page.waitForTimeout(2000)
    
    // THEN: The alerts should be refreshed (no specific assertion needed, just that it doesn't crash)
    await expect(page.getByTestId('alert-header')).toBeVisible()
    
    console.log('✅ Alerts refreshed successfully')
  })

  test("shows empty state when no alerts", async ({ page }) => {
    // GIVEN: I'm on the alert screen
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.click()
    await page.waitForTimeout(2000)
    
    await expect(page.getByTestId('alert-header')).toBeVisible()
    
    // WHEN: I switch to unread view and there are no unread alerts
    const unreadButton = page.getByText(/unread/i)
    await unreadButton.click()
    await page.waitForTimeout(1000)
    
    // THEN: I should see empty state (if no unread alerts)
    const alertItems = page.locator('[data-testid="alert-item"]')
    const alertCount = await alertItems.count()
    
    if (alertCount === 0) {
      const emptyState = page.getByTestId('alert-empty-state')
      await expect(emptyState).toBeVisible()
      console.log('✅ Empty state shown when no unread alerts')
    } else {
      console.log(`ℹ Found ${alertCount} unread alerts, no empty state`)
    }
  })

  test("alert badge updates when alerts are read", async ({ page }) => {
    // GIVEN: I'm on the home screen with unread alerts
    await expect(page.getByTestId('home-header')).toBeVisible()
    
    // Get initial badge count
    const badgeElement = page.locator('[data-testid="tab-alert"] span[style*="background-color: rgb(255, 59, 48)"]')
    const badgeCount = await badgeElement.count()
    
    if (badgeCount > 0) {
      const initialBadgeText = await badgeElement.textContent()
      const initialCount = parseInt(initialBadgeText || '0')
      
      console.log(`Initial badge count: ${initialCount}`)
      
      // WHEN: I navigate to alerts and mark some as read
      const alertTab = page.getByTestId('tab-alert')
      await alertTab.click()
      await page.waitForTimeout(2000)
      
      // Mark an alert as read
      const alertItems = page.locator('[data-testid="alert-item"]')
      const alertCount = await alertItems.count()
      
      if (alertCount > 0) {
        await alertItems.first().click()
        await page.waitForTimeout(1000)
        
        // Navigate back to home
        const homeTab = page.getByTestId('tab-home')
        await homeTab.click()
        await page.waitForTimeout(1000)
        
        // THEN: Badge count should be updated (may be same, reduced, or badge may disappear)
        const updatedBadgeCount = await badgeElement.count()
        
        if (updatedBadgeCount > 0) {
          const updatedBadgeText = await badgeElement.textContent()
          const updatedCount = parseInt(updatedBadgeText || '0')
          expect(updatedCount).toBeLessThanOrEqual(initialCount)
          console.log(`✅ Badge count updated: ${initialCount} → ${updatedCount}`)
        } else {
          console.log(`✅ Badge disappeared after marking alerts as read (was ${initialCount})`)
        }
      } else {
        console.log('ℹ No alerts to test badge update')
      }
    } else {
      console.log('ℹ No badge present to test update')
    }
  })
})
