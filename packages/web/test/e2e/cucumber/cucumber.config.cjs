/**
 * Cucumber + Playwright for @bianca-app/web (Vite).
 * .cjs so Node loads this as CommonJS while packages/web has "type": "module".
 *
 * Default base URL is Vite dev (5173). CodeBuild RunTests sets FRONTEND_URL=http://localhost:8081.
 */
const defaultFrontendURL = "http://localhost:5173"

module.exports = {
  default: {
    require: [
      "test/e2e/cucumber/support/world.cjs",
      "test/e2e/cucumber/support/hooks.cjs",
      "test/e2e/cucumber/step_definitions/**/*.cjs",
    ],
    format: [
      "progress-bar",
      "json:test/e2e/cucumber/reports/cucumber-report.json",
      "html:test/e2e/cucumber/reports/cucumber-report.html",
      "@cucumber/pretty-formatter",
    ],
    formatOptions: {
      snippetInterface: "async-await",
    },
    publishQuiet: true,
    strict: true,
    tags: process.env.CUCUMBER_TAGS ? `${process.env.CUCUMBER_TAGS} and not @skip` : "not @skip",
    worldParameters: {
      baseURL: process.env.FRONTEND_URL || process.env.BASE_URL || defaultFrontendURL,
      apiURL: process.env.API_URL || "http://localhost:3000",
    },
  },
}
