/**
 * Cucumber Hooks
 * 
 * Before and After hooks for test setup and teardown
 */

const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');
const { chromium } = require('playwright');

/**
 * One browser for the whole run: avoids N× chromium.launch() and matches Playwright's
 * default launch timeout (180s) with Cucumber's hook timeout — a slow/stuck launch
 * could make Before() hit 180s with no steps running.
 */
let sharedBrowser = null;

BeforeAll(async function() {
  sharedBrowser = await chromium.launch({
    headless: !process.env.HEADED,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : 0,
    timeout: 60000,
  });
});

AfterAll(async function() {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
  }
});

// Before each scenario
Before(async function() {
  await this.init(sharedBrowser);

  // Hit app origin first so localStorage applies to the same origin as the app (not about:blank).
  const base = (this.baseURL || 'http://localhost:8084').replace(/\/$/, '');
  try {
    await this.page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (e) {
    // Dev server may still be starting; auth step will retry navigation
  }

  // Set playwright test mode for faster alert polling (3s); must exist before AlertScreen mounts
  try {
    await this.page.evaluate(() => {
      localStorage.setItem('playwright_test', '1');
    });
  } catch (e) {
    // Non-fatal
  }
});

// After each scenario
After(async function() {
  await this.cleanup();
});









