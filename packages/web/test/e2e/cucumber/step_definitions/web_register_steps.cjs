const { Given, When, Then } = require("@cucumber/cucumber")
const { expect } = require("@playwright/test")

Given("I have cleared session and opened web register", async function () {
  await this.ensureBackendSeeded()
  await this.page.goto(`${this.baseURL}/register`, { waitUntil: "load", timeout: 30000 })
  await this.page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await this.page.goto(`${this.baseURL}/register`, { waitUntil: "load", timeout: 30000 })
  await expect(this.page.getByTestId("register-submit")).toBeVisible({ timeout: 15000 })
})

When("I set web register full name to {string}", async function (name) {
  await this.page.getByTestId("register-name").fill(name)
})

When("I clear the web register full name field", async function () {
  await this.page.getByTestId("register-name").fill("")
})

When("I set web register email to {string}", async function (email) {
  await this.page.getByTestId("register-email").fill(email)
})

When("I set web register phone to {string}", async function (phone) {
  await this.page.getByTestId("register-phone").fill(phone)
})

When("I set web register password to {string}", async function (pw) {
  await this.page.getByTestId("register-password").fill(pw)
})

When("I set web register confirm password to {string}", async function (pw) {
  await this.page.getByTestId("register-confirm-password").fill(pw)
})

When("I submit web registration expecting client validation only", async function () {
  await this.page.getByTestId("register-submit").click()
})

Then("I should see web register validation error containing {string}", async function (substring) {
  const alert = this.page.getByRole("alert")
  await expect(alert).toBeVisible({ timeout: 10000 })
  await expect(alert).toContainText(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
})

When("I open web forgot password from login", async function () {
  await this.page.goto(`${this.baseURL}/login`, { waitUntil: "load", timeout: 30000 })
  await this.page.getByTestId("login-forgot-password-link").click()
  await expect(this.page).toHaveURL(/\/forgot-password/)
})

When("I submit web forgot password for {string}", async function (email) {
  await this.page.getByTestId("forgot-password-email").fill(email)
  const done = this.page.waitForResponse((r) => r.url().includes("/v1/auth/forgot-password"), { timeout: 20000 })
  await this.page.getByTestId("forgot-password-submit").click()
  await done
})

Then("I should see web forgot password confirmation", async function () {
  await expect(this.page.getByTestId("forgot-password-success")).toBeVisible({ timeout: 10000 })
})

When("I navigate directly to web settings phone", async function () {
  // Keep navigation in-app to preserve in-memory auth state.
  await this.page.getByTestId("nav-settings").click()
  await this.page.getByTestId("settings-phone-link").click()
  await this.page.waitForURL(/\/settings\/phone|\/profile\/phone/, { timeout: 15000 })
})

Then("I should see the web phone verification page", async function () {
  await expect(this.page.getByTestId("settings-phone-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: /Verify phone/i })).toBeVisible()
})
