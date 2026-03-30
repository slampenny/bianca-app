const { Given, When, Then } = require("@cucumber/cucumber")
const { expect } = require("@playwright/test")

Given("the web frontend is available at {string}", async function (frontendBase) {
  this.baseURL = (
    process.env.FRONTEND_URL ||
    process.env.BASE_URL ||
    this.parameters?.baseURL ||
    frontendBase ||
    "http://localhost:5173"
  ).replace(/\/$/, "")
})

Given("the API is available at {string}", async function (apiBase) {
  const raw =
    process.env.API_URL || this.parameters?.apiURL || apiBase || "http://localhost:3000"
  this.apiURL = raw.replace(/\/$/, "")
})

Given("I have cleared the web app session", async function () {
  await this.ensureBackendSeeded()
  await this.page.goto(`${this.baseURL}/login`, { waitUntil: "load", timeout: 30000 })
  await this.page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await this.page.goto(`${this.baseURL}/login`, { waitUntil: "load", timeout: 30000 })
})

When("I open the web login page", async function () {
  await this.page.goto(`${this.baseURL}/login`, { waitUntil: "load", timeout: 30000 })
  await this.page.getByTestId("email-input").waitFor({ state: "visible", timeout: 15000 })
})

When("I type web login email {string}", async function (email) {
  await this.page.getByTestId("email-input").fill(email)
})

When("I type web login password {string}", async function (password) {
  await this.page.getByTestId("password-input").fill(password)
})

When("I submit the web login form expecting success", async function () {
  const loginDone = this.page.waitForResponse(
    (r) => r.url().includes("/v1/auth/login") && r.status() === 200,
    { timeout: 20000 },
  )
  await this.page.getByTestId("login-button").click()
  await loginDone
})

When("I submit the web login form allowing failure", async function () {
  const loginDone = this.page.waitForResponse((r) => r.url().includes("/v1/auth/login"), { timeout: 20000 })
  await this.page.getByTestId("login-button").click()
  await loginDone
})

Then("I should land on the web dashboard", async function () {
  await this.page.getByTestId("home-header").waitFor({ state: "visible", timeout: 20000 })
  await expect(this.page.getByTestId("email-input")).toHaveCount(0)
})

Then("I should see a web login error message", async function () {
  await expect(this.page.getByRole("alert")).toBeVisible({ timeout: 10000 })
})

Then("the web login form should still be visible", async function () {
  await expect(this.page).toHaveURL(/\/login/)
  await expect(this.page.getByTestId("email-input")).toBeVisible()
})
