const { Given, When, Then } = require("@cucumber/cucumber")
const { expect } = require("@playwright/test")

const SEEDED_EMAIL = "fake@example.org"
const SEEDED_PASSWORD = "Password1"
const SEEDED_ORG_ADMIN_EMAIL = "admin@example.org"
const SEEDED_ORG_ADMIN_PASSWORD = "Password1"

async function startFromFreshLoginPage(world) {
  await world.page.context().clearCookies()
  await world.page.goto(`${world.baseURL}/login`, { waitUntil: "load", timeout: 30000 })
  await world.page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await world.page.goto(`${world.baseURL}/login`, { waitUntil: "load", timeout: 30000 })
}

/** Full login used by most signed-in scenarios */
Given("I am signed in on the web as the seeded test caregiver", async function () {
  await this.ensureBackendSeeded()
  await startFromFreshLoginPage(this)
  if ((await this.page.getByTestId("home-header").count()) > 0) return
  await this.page.getByTestId("email-input").waitFor({ state: "visible", timeout: 15000 })
  await this.page.getByTestId("email-input").fill(SEEDED_EMAIL)
  await this.page.getByTestId("password-input").fill(SEEDED_PASSWORD)
  const done = this.page.waitForResponse(
    (r) => r.url().includes("/v1/auth/login") && r.status() === 200,
    { timeout: 25000 },
  )
  await this.page.getByTestId("login-button").click()
  await done
  await this.page.getByTestId("home-header").waitFor({ state: "visible", timeout: 20000 })
})

Given("I am signed in on the web as the seeded org admin", async function () {
  await this.ensureBackendSeeded()
  await startFromFreshLoginPage(this)
  if ((await this.page.getByTestId("home-header").count()) > 0) return
  await this.page.getByTestId("email-input").waitFor({ state: "visible", timeout: 15000 })
  await this.page.getByTestId("email-input").fill(SEEDED_ORG_ADMIN_EMAIL)
  await this.page.getByTestId("password-input").fill(SEEDED_ORG_ADMIN_PASSWORD)
  const done = this.page.waitForResponse(
    (r) => r.url().includes("/v1/auth/login") && r.status() === 200,
    { timeout: 25000 },
  )
  await this.page.getByTestId("login-button").click()
  await done
  await this.page.getByTestId("home-header").waitFor({ state: "visible", timeout: 20000 })
})

When("I open the web sidebar {string} section", async function (label) {
  const key = label.trim().toLowerCase()
  const map = {
    dashboard: "nav-dashboard",
    alerts: "nav-alerts",
    residents: "nav-residents",
    caregivers: "nav-caregivers",
    reports: "nav-reports",
    settings: "nav-settings",
  }
  const testId = map[key]
  if (!testId) throw new Error(`Unknown sidebar section: ${label}. Use: ${Object.keys(map).join(", ")}`)
  await this.page.getByTestId(testId).click()
  await this.page.waitForLoadState("domcontentloaded")
})

When("I sign out from web settings", async function () {
  await this.page.getByTestId("settings-sign-out").click()
  await this.page.waitForURL(/\/login/, { timeout: 15000 })
})

Then("I should be on the web login page", async function () {
  await expect(this.page).toHaveURL(/\/login/)
  await expect(this.page.getByTestId("email-input")).toBeVisible({ timeout: 10000 })
})
