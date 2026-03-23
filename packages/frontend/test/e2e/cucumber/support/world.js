/**
 * Cucumber World - Custom World for Playwright Integration
 * 
 * This extends Cucumber's World to include Playwright browser and page instances.
 */

const { setWorldConstructor, setDefaultTimeout } = require('@cucumber/cucumber');
const { chromium } = require('playwright');

setDefaultTimeout(3 * 60 * 1000); // 3 minutes default timeout - no workflow should take longer

class PlaywrightWorld {
  constructor({ attach, parameters }) {
    this.attach = attach;
    this.parameters = parameters;
    this.browser = null;
    /** If false, browser is shared (BeforeAll); do not close in cleanup(). */
    this._ownsBrowser = true;
    this.context = null;
    this.page = null;
    // Use centralized port configuration from cucumber.config.js worldParameters
    // This ensures all tests use the same port - if wrong, all fail consistently
    // Priority: worldParameters (from config) > FRONTEND_URL env var > BASE_URL env var > default (8084)
    this.baseURL = parameters.baseURL || process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:8084';
    this.apiURL = parameters.apiURL || process.env.API_URL || 'http://localhost:3000';
  }

  async init(sharedBrowserFromHook = null) {
    if (sharedBrowserFromHook) {
      this._ownsBrowser = false;
      this.browser = sharedBrowserFromHook;
    } else {
      this._ownsBrowser = true;
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: !process.env.HEADED,
          slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : 0,
          timeout: 60000,
        });
      }
    }

    // Create context
    this.context = await this.browser.newContext({
      baseURL: this.baseURL,
      viewport: { width: 1280, height: 720 },
      // Ignore network errors that might cause page to close
      ignoreHTTPSErrors: true,
    });

    // Create page
    this.page = await this.context.newPage();
    
    // Add error listeners to prevent page from closing on errors
    this.page.on('pageerror', (error) => {
      console.log('[Page Error]', error.message);
      // Don't let page errors close the page
    });
    
    this.page.on('crash', () => {
      console.log('[Page Crash] Page crashed but continuing...');
    });
    
    // Listen for console messages and log them
    this.page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      // Log all console messages that contain our debug tags
      if (text.includes('[REDUX') || text.includes('[API CALLBACK') || text.includes('[PATIENT SCREEN') || text.includes('createPatient') || text.includes('matchFulfilled')) {
        console.log(`[Browser Console ${type}]`, text);
      } else if (type === 'error') {
        console.log('[Console Error]', text);
      }
    });
  }

  async cleanup() {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {
          // Page might already be closed, that's okay
        });
        this.page = null;
      } else if (this.page) {
        this.page = null; // Already closed
      }
    } catch (e) {
      // Page might already be closed
      this.page = null;
    }
    
    try {
      if (this.context) {
        await this.context.close().catch(() => {
          // Context might already be closed, that's okay
        });
        this.context = null;
      }
    } catch (e) {
      // Context might already be closed
      this.context = null;
    }
    
    if (this._ownsBrowser) {
      try {
        if (this.browser) {
          await this.browser.close().catch(() => {
            // Browser might already be closed, that's okay
          });
          this.browser = null;
        }
      } catch (e) {
        this.browser = null;
      }
    } else {
      this.browser = null;
    }
  }

  async takeScreenshot(name) {
    if (this.page) {
      const screenshot = await this.page.screenshot({ path: `test/e2e/cucumber/screenshots/${name}.png` });
      await this.attach(screenshot, 'image/png');
    }
  }

  getCredentials(username) {
    // Map of test user credentials - matches backend test fixtures / seed data
    const credentials = {
      'admin': { email: 'admin@example.org', password: 'Password1' },
      'caregiver': { email: 'fake@example.org', password: 'Password1' },
      'staff': { email: 'fake@example.org', password: 'Password1' },
      'orgAdmin': { email: 'admin@example.org', password: 'Password1' },
      'superAdmin': { email: 'superadmin@example.org', password: 'Password1' },
    };
    return credentials[username] || { email: `${username}@example.org`, password: 'Password1' };
  }

  /**
   * Ensure the backend has seed data (fake@example.org, admin, etc.) so login works.
   * Calls POST /v1/test/seed once per run. Safe to call multiple times; only seeds once.
   */
  async ensureBackendSeeded() {
    if (this._backendSeeded) return;
    const apiURL = this.apiURL || process.env.API_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${apiURL}/v1/test/seed`, { method: 'POST' });
      if (res.ok) {
        this._backendSeeded = true;
        console.log('[E2E] Backend seed completed (test users available)');
      }
      // If 403 (production) or other error, assume backend is already seeded or not using test route
    } catch (e) {
      console.warn('[E2E] Backend seed request failed (backend may already be seeded):', e.message);
    }
    this._backendSeeded = true; // Don't retry every scenario
  }
}

setWorldConstructor(PlaywrightWorld);

