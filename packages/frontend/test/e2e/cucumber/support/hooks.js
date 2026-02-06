/**
 * Cucumber Hooks
 * 
 * Before and After hooks for test setup and teardown
 */

const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');

// Before each scenario
Before(async function() {
  await this.init();
  
  // Set playwright test mode in localStorage for faster polling (3s instead of 30s)
  // This must be set BEFORE any page navigation so AlertScreen picks it up
  try {
    await this.page.evaluate(() => {
      localStorage.setItem('playwright_test', '1');
    });
  } catch (e) {
    // Page might not be loaded yet, that's okay
  }
});

// After each scenario
After(async function() {
  await this.cleanup();
});

// Optional: BeforeAll and AfterAll hooks if needed
// BeforeAll(async function() {
//   // Global setup
// });

// AfterAll(async function() {
//   // Global teardown
// });












