/**
 * Cucumber Configuration for Playwright Integration
 * 
 * This configures Cucumber to work with Playwright for BDD testing.
 * Step definitions will use Playwright's page and browser APIs.
 */

module.exports = {
  default: {
    require: [
      'test/e2e/cucumber/step_definitions/**/*.js',
      'test/e2e/cucumber/support/**/*.js'
    ],
    format: [
      'progress-bar',
      'json:test/e2e/cucumber/reports/cucumber-report.json',
      'html:test/e2e/cucumber/reports/cucumber-report.html',
      '@cucumber/pretty-formatter'
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
    publishQuiet: true,
    strict: false, // Set to false initially to allow undefined steps
    tags: process.env.CUCUMBER_TAGS ? `${process.env.CUCUMBER_TAGS} and not @skip` : 'not @skip',
    worldParameters: {
      // Centralized port configuration - all tests use this
      // Priority: FRONTEND_URL env var > BASE_URL env var > default (8084)
      // If port is wrong, ALL tests will fail consistently (not just some)
      // Default port is 8084 (common dev port) - override with FRONTEND_URL if different
      baseURL: process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:8084',
      apiURL: process.env.API_URL || 'http://localhost:3000',
    }
  }
};












