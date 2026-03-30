const { Given, When, Then } = require("@cucumber/cucumber")
const { expect } = require("@playwright/test")

Given("I start web onboarding with a clean browser session", async function () {
  await this.ensureBackendSeeded()
  await this.page.goto(`${this.baseURL}/onboarding`, { waitUntil: "load", timeout: 30000 })
  await this.page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await this.page.goto(`${this.baseURL}/onboarding`, { waitUntil: "load", timeout: 30000 })
})

When("I choose the caregiver persona on web onboarding", async function () {
  await this.page.getByTestId("onboarding-persona-caregiver").click()
})

When("I continue from web onboarding about you", async function () {
  await this.page.getByTestId("onboarding-about-you-continue").click()
})

When("I continue from web onboarding how it works", async function () {
  await this.page.getByTestId("onboarding-how-it-works-continue").click()
})

Then("I should see the web registration form", async function () {
  await expect(this.page).toHaveURL(/\/register/)
  await expect(this.page.getByTestId("register-submit")).toBeVisible({ timeout: 15000 })
})

When("I complete web registration with random email", async function () {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  this.randomRegisterEmail = `cucumber.${suffix}@example.com`
  await this.page.getByTestId("register-name").fill("Cucumber Web User")
  await this.page.getByTestId("register-email").fill(this.randomRegisterEmail)
  await this.page.getByTestId("register-phone").fill("+16045550123")
  await this.page.getByTestId("register-password").fill("SecurePass123!")
  await this.page.getByTestId("register-confirm-password").fill("SecurePass123!")
  const reg = this.page.waitForResponse(
    (r) => r.url().includes("/v1/auth/register") && (r.status() === 200 || r.status() === 201),
    { timeout: 30000 },
  )
  await this.page.getByTestId("register-submit").click()
  await reg
})

Then("I should see the web check email page", async function () {
  await expect(this.page.getByTestId("check-email-page")).toBeVisible({ timeout: 15000 })
})
