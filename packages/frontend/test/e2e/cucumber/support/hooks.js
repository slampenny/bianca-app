/**
 * Cucumber Hooks
 * 
 * Before and After hooks for test setup and teardown
 */

const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');

// Before each scenario
Before(async function() {
  await this.init();
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






