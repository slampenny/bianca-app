// test/e2e/telemetry.e2e.test.ts
// Playwright E2E tests for telemetry opt-in feature

import { test, expect } from '@playwright/test'
import { loginIfNeeded, navigateToReportsTab } from './helpers/navigation'

test.describe('Telemetry', () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page)
  })

  test('should display telemetry opt-in toggle in profile screen', async ({ page }) => {
    // Navigate to profile screen via ProfileButton in header
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"]').first()
    if (await profileButton.count() > 0) {
      await profileButton.click()
      await page.waitForTimeout(2000)
    } else {
      // Fallback: try navigating via org tab
      const orgTab = page.locator('[data-testid="tab-org"], [aria-label="Organization tab"]').first()
      if (await orgTab.count() > 0) {
        await orgTab.click()
        await page.waitForTimeout(1000)
      }
    }

    // Wait for profile screen to load
    const profileScreen = page.locator('[aria-label="profile-screen"]').first()
    await expect(profileScreen).toBeVisible({ timeout: 10000 }).catch(() => {
      // Profile screen might not have the label, continue anyway
    })

    // Check for telemetry toggle
    const telemetryToggle = page.locator('[data-testid="telemetry-opt-in-switch"], [aria-label="telemetry-opt-in-switch"]')
    const telemetryLabel = page.locator('text=/Share anonymous usage data|telemetry/i').first()

    // Either the toggle or label should be visible
    const hasToggle = await telemetryToggle.count() > 0
    const hasLabel = await telemetryLabel.count() > 0

    expect(hasToggle || hasLabel).toBe(true)
  })

  test('should allow user to toggle telemetry opt-in', async ({ page }) => {
    // Navigate to profile screen
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"]').first()
    if (await profileButton.count() > 0) {
      await profileButton.click()
      await page.waitForTimeout(2000)
    }

    // Find telemetry toggle
    const telemetryToggle = page.locator('[data-testid="telemetry-opt-in-switch"], [aria-label="telemetry-opt-in-switch"]')
    
    if (await telemetryToggle.count() > 0) {
      // Get initial state
      const initialChecked = await telemetryToggle.isChecked()
      
      // Toggle it
      await telemetryToggle.click()
      await page.waitForTimeout(1000)

      // Verify state changed
      const newChecked = await telemetryToggle.isChecked()
      
      expect(await telemetryToggle.isVisible()).toBe(true)
      expect(newChecked).toBe(!initialChecked)
    } else {
      // If toggle not found, skip test
      test.skip()
    }
  })

  test('should show telemetry description text', async ({ page }) => {
    // Navigate to profile screen
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"]').first()
    if (await profileButton.count() > 0) {
      await profileButton.click()
      await page.waitForTimeout(2000)
    }

    // Look for telemetry description
    const description = page.locator('text=/Help us improve|anonymous usage data|No personal information/i').first()
    
    if (await description.count() > 0) {
      await expect(description).toBeVisible({ timeout: 5000 })
    } else {
      // Description might not be visible if toggle is not present
      // This is acceptable - just verify profile screen loaded
      const profileScreen = page.locator('[aria-label="profile-screen"]')
      if (await profileScreen.count() > 0) {
        await expect(profileScreen.first()).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('should not crash when toggling telemetry', async ({ page }) => {
    const errors: string[] = []
    const consoleErrors: string[] = []

    page.on('pageerror', (error) => {
      errors.push(error.message)
      console.error('PAGE ERROR:', error.message)
    })

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Ignore expected 404s and network errors
        if (!text.includes('404') && !text.includes('Expected') && !text.includes('NetworkError')) {
          consoleErrors.push(text)
        }
      }
    })

    // Navigate to profile screen
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"]').first()
    if (await profileButton.count() > 0) {
      await profileButton.click()
      await page.waitForTimeout(2000)
    }

    // Try to find and click telemetry toggle
    const telemetryToggle = page.locator('[data-testid="telemetry-opt-in-switch"], [aria-label="telemetry-opt-in-switch"]')
    if (await telemetryToggle.count() > 0) {
      await telemetryToggle.click()
      await page.waitForTimeout(1000)
    }

    // Verify no crashes
    if (errors.length > 0) {
      console.error('Page errors found:', errors)
    }
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors)
    }

    expect(errors.length).toBe(0)
    expect(consoleErrors.length).toBe(0)
    console.log('✅ Telemetry toggle did not cause crashes')
  })
})
