import { test, expect, Page } from "@playwright/test"

test.describe("Simple App Test", () => {
  test("should load the app and show basic elements", async ({ page }) => {
    // Navigate to the app
    await page.goto("/")
    
    // Wait for the app to load
    await page.waitForTimeout(5000)
    
    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'test-results/app-screenshot.png' })
    
    // Log the page title and URL
    console.log('Page title:', await page.title())
    console.log('Page URL:', page.url())
    
    // Check if there's any text on the page
    const bodyText = await page.textContent('body')
    console.log('Body text:', bodyText?.substring(0, 500))
    
    // Try to find any buttons or links
    const buttons = await page.locator('button').all()
    console.log('Found buttons:', buttons.length)
    
    const links = await page.locator('a').all()
    console.log('Found links:', links.length)
    
    // Just check if the page loaded at all
    await expect(page.locator('body')).toBeVisible()
  })
}) 