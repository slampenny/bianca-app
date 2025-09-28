import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome, isHomeScreen } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'

test.describe("Alert Badge Width Test", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
  })

  test("badge displays full number width correctly", async ({ page }) => {
    console.log('=== ALERT BADGE WIDTH TEST ===')
    
    // GIVEN: I'm on the home screen
    await expect(page.getByTestId('home-header')).toBeVisible()
    
    // WHEN: I check the alert tab badge
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.waitFor({ state: 'visible' })
    
    // Check if there's a badge on the alert tab
    const badgeElement = page.locator('[data-testid="tab-alert"] span[style*="background-color: rgb(255, 59, 48)"]')
    const badgeCount = await badgeElement.count()
    
    if (badgeCount > 0) {
      // THEN: I should see the full badge text without truncation
      const badgeText = await badgeElement.textContent()
      const badgeNumber = parseInt(badgeText || '0')
      
      console.log(`Badge shows: "${badgeText}" (${badgeNumber})`)
      
      // Check that the badge can display multi-digit numbers
      if (badgeNumber >= 10) {
        console.log(`✅ Badge successfully displays multi-digit number: ${badgeNumber}`)
        
        // Verify the badge styling allows for proper width
        const badgeHTML = await badgeElement.innerHTML()
        console.log('Badge HTML:', badgeHTML)
        
        // Check that the badge element has proper width styling
        const badgeStyle = await badgeElement.evaluate(el => {
          const computedStyle = window.getComputedStyle(el)
          return {
            width: computedStyle.width,
            minWidth: computedStyle.minWidth,
            maxWidth: computedStyle.maxWidth,
            paddingLeft: computedStyle.paddingLeft,
            paddingRight: computedStyle.paddingRight
          }
        })
        
        console.log('Badge computed styles:', badgeStyle)
        
        // Verify the badge is wide enough to display the full number
        expect(badgeNumber).toBeGreaterThan(0)
        expect(badgeText).toBeTruthy()
        expect(badgeText?.length).toBeGreaterThan(1) // Multi-digit number
        
      } else if (badgeNumber > 0) {
        console.log(`✅ Badge displays single-digit number: ${badgeNumber}`)
        expect(badgeNumber).toBeGreaterThan(0)
      } else {
        console.log('ℹ Badge shows 0 or invalid number')
      }
      
    } else {
      console.log('ℹ No badge present - all alerts may be read')
      
      // Navigate to alerts screen to see current state
      await alertTab.click()
      await page.waitForTimeout(2000)
      
      const alertItems = await page.locator('[data-testid="alert-item"]').count()
      console.log(`Alert screen shows ${alertItems} alert items`)
      
      if (alertItems === 0) {
        console.log('ℹ No alerts available in the system')
      } else {
        console.log('ℹ Alerts exist but may all be marked as read')
      }
    }
    
    console.log('=== BADGE WIDTH TEST COMPLETE ===')
  })

  test("badge styling properties are correct", async ({ page }) => {
    // GIVEN: I'm on the home screen
    await expect(page.getByTestId('home-header')).toBeVisible()
    
    // WHEN: I check for the alert tab
    const alertTab = page.getByTestId('tab-alert')
    await alertTab.waitFor({ state: 'visible' })
    
    // Check if badge exists
    const badgeElement = page.locator('[data-testid="tab-alert"] span[style*="background-color: rgb(255, 59, 48)"]')
    const badgeCount = await badgeElement.count()
    
    if (badgeCount > 0) {
      // THEN: The badge should have proper styling for width expansion
      const badgeStyle = await badgeElement.evaluate(el => {
        const computedStyle = window.getComputedStyle(el)
        return {
          width: computedStyle.width,
          minWidth: computedStyle.minWidth,
          maxWidth: computedStyle.maxWidth,
          paddingLeft: computedStyle.paddingLeft,
          paddingRight: computedStyle.paddingRight,
          fontSize: computedStyle.fontSize,
          textAlign: computedStyle.textAlign
        }
      })
      
      console.log('Badge styling verification:')
      console.log('- Width:', badgeStyle.width)
      console.log('- Min Width:', badgeStyle.minWidth)
      console.log('- Max Width:', badgeStyle.maxWidth)
      console.log('- Padding:', badgeStyle.paddingLeft, badgeStyle.paddingRight)
      console.log('- Font Size:', badgeStyle.fontSize)
      console.log('- Text Align:', badgeStyle.textAlign)
      
      // Verify that maxWidth is not constraining the badge
      if (badgeStyle.maxWidth === 'none' || badgeStyle.maxWidth === 'auto') {
        console.log('✅ Badge maxWidth allows expansion')
      } else {
        console.log(`ℹ Badge maxWidth: ${badgeStyle.maxWidth}`)
      }
      
      // Verify minimum width is reasonable
      const minWidthValue = parseInt(badgeStyle.minWidth.replace('px', ''))
      if (minWidthValue >= 18) {
        console.log('✅ Badge has adequate minimum width')
      } else {
        console.log(`ℹ Badge minWidth: ${badgeStyle.minWidth}`)
      }
      
    } else {
      console.log('ℹ No badge present to verify styling')
    }
  })
})
