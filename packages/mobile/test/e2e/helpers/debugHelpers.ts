import { Page, expect } from '@playwright/test';

/**
 * Debug helper functions for Playwright e2e tests
 * These functions help you step through tests and see what Playwright is doing
 */

/**
 * Pause execution and wait for user input
 * Use this to create breakpoints in your tests
 */
export async function debugBreak(message: string = 'Debug breakpoint - press any key to continue') {
  console.log(`🔍 DEBUG: ${message}`);
  console.log('⏸️  Test paused. Check the browser window and press any key in the terminal to continue...');
  
  // This will pause execution until you press a key in the terminal
  process.stdin.setRawMode(true);
  return new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      console.log('▶️  Continuing test execution...');
      resolve();
    });
  });
}

/**
 * Take a screenshot and log the current state
 */
export async function debugScreenshot(page: Page, name: string = 'debug-screenshot') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  
  console.log(`📸 Taking debug screenshot: ${filename}`);
  await page.screenshot({ path: `test-results/debug-${filename}`, fullPage: true });
  console.log(`📸 Screenshot saved to: test-results/debug-${filename}`);
}

/**
 * Log the current page state and wait for user input
 */
export async function debugPageState(page: Page, message: string = 'Current page state') {
  console.log(`\n🔍 DEBUG: ${message}`);
  console.log(`📍 Current URL: ${page.url()}`);
  console.log(`📄 Page title: ${await page.title()}`);
  
  // Log visible text elements
  const visibleText = await page.locator('body').textContent();
  console.log(`📝 Visible text (first 200 chars): ${visibleText?.substring(0, 200)}...`);
  
  await debugBreak('Press any key to continue');
}

/**
 * Wait for an element and log its state
 */
export async function debugElement(page: Page, selector: string, message: string = '') {
  console.log(`🔍 DEBUG: Looking for element: ${selector} ${message}`);
  
  try {
    const element = page.locator(selector);
    const isVisible = await element.isVisible();
    const text = await element.textContent();
    
    console.log(`✅ Element found - Visible: ${isVisible}, Text: "${text}"`);
    
    if (!isVisible) {
      console.log(`⚠️  Element exists but is not visible`);
    }
    
    return element;
  } catch (error) {
    console.log(`❌ Element not found: ${selector}`);
    throw error;
  }
}

/**
 * Step through a form fill operation with debugging
 */
export async function debugFillForm(page: Page, formData: Record<string, string>) {
  console.log(`🔍 DEBUG: Filling form with data:`, formData);
  
  for (const [field, value] of Object.entries(formData)) {
    console.log(`📝 Filling field: ${field} with value: ${value}`);
    
    try {
      const element = page.locator(`[data-testid="${field}"]`);
      await element.fill(value);
      console.log(`✅ Successfully filled ${field}`);
      
      // Optional: pause after each field
      // await debugBreak(`Filled ${field} - press any key to continue`);
    } catch (error) {
      console.log(`❌ Failed to fill ${field}:`, error);
      throw error;
    }
  }
  
  console.log(`✅ Form fill completed`);
}

/**
 * Debug a click operation
 */
export async function debugClick(page: Page, selector: string, message: string = '') {
  console.log(`🔍 DEBUG: Clicking element: ${selector} ${message}`);
  
  try {
    const element = page.locator(selector);
    const isVisible = await element.isVisible();
    const isEnabled = await element.isEnabled();
    
    console.log(`📍 Element state - Visible: ${isVisible}, Enabled: ${isEnabled}`);
    
    if (!isVisible) {
      console.log(`⚠️  Element is not visible, attempting to scroll into view`);
      await element.scrollIntoViewIfNeeded();
    }
    
    await element.click();
    console.log(`✅ Successfully clicked ${selector}`);
  } catch (error) {
    console.log(`❌ Failed to click ${selector}:`, error);
    throw error;
  }
}

/**
 * Wait for navigation and debug the new page
 */
export async function debugNavigation(page: Page, message: string = 'Navigation completed') {
  console.log(`🔍 DEBUG: ${message}`);
  console.log(`📍 New URL: ${page.url()}`);
  console.log(`📄 New title: ${await page.title()}`);
  
  // Wait a moment for the page to fully load
  await page.waitForLoadState('networkidle');
  
  await debugPageState(page, 'Page after navigation');
}

/**
 * Debug API calls by intercepting them
 */
export async function debugApiCalls(page: Page) {
  console.log(`🔍 DEBUG: Setting up API call interception`);
  
  page.on('request', request => {
    console.log(`🌐 API Request: ${request.method()} ${request.url()}`);
  });
  
  page.on('response', response => {
    console.log(`📡 API Response: ${response.status()} ${response.url()}`);
  });
}

/**
 * Create a test wrapper that includes debugging capabilities
 */
export function createDebugTest(testFn: (page: Page) => Promise<void>) {
  return async ({ page }: { page: Page }) => {
    console.log(`🚀 Starting debug test: ${testFn.name || 'Anonymous test'}`);
    
    // Set up API call debugging
    debugApiCalls(page);
    
    try {
      await testFn(page);
      console.log(`✅ Test completed successfully`);
    } catch (error) {
      console.log(`❌ Test failed:`, error);
      
      // Take a screenshot on failure
      await debugScreenshot(page, 'test-failure');
      
      throw error;
    }
  };
}

/**
 * Wait for a specific condition with debugging
 */
export async function debugWaitFor(page: Page, condition: () => Promise<boolean>, timeout: number = 5000, message: string = '') {
  console.log(`⏳ DEBUG: Waiting for condition: ${message}`);
  
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      if (await condition()) {
        console.log(`✅ Condition met: ${message}`);
        return;
      }
    } catch (error) {
      // Continue waiting
    }
    
    await page.waitForTimeout(100);
  }
  
  console.log(`⏰ Timeout waiting for condition: ${message}`);
  throw new Error(`Timeout waiting for condition: ${message}`);
} 