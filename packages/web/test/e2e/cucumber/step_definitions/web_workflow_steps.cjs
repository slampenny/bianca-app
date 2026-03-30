const { When, Then } = require("@cucumber/cucumber")
const { expect } = require("@playwright/test")

Then("I should see the web dashboard", async function () {
  await expect(this.page.getByTestId("home-header")).toBeVisible({ timeout: 15000 })
})

Then("I should see the web residents hub", async function () {
  await expect(this.page.getByTestId("residents-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: "Residents" })).toBeVisible()
})

Then("I should see the web alerts hub", async function () {
  const list = this.page.getByTestId("alerts-page")
  const empty = this.page.getByTestId("alerts-empty")
  await expect(list.or(empty)).toBeVisible({ timeout: 15000 })
})

Then("I should see the web reports library", async function () {
  await expect(this.page.getByTestId("reports-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: "Reports" })).toBeVisible()
})

Then("I should see the web settings page", async function () {
  await expect(this.page.getByTestId("settings-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: "Settings" })).toBeVisible()
})

When("I search residents for {string}", async function (text) {
  await this.page.getByTestId("residents-search").fill(text)
})

When("I open the first web resident row", async function () {
  const row = this.page.getByTestId("resident-row").first()
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.click()
})

Then("I should see the web resident detail view", async function () {
  await expect(this.page.getByTestId("resident-detail-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByTestId("resident-detail-back")).toBeVisible()
})

When("I go back to residents from resident detail", async function () {
  await this.page.getByTestId("resident-detail-back").click()
  await expect(this.page.getByTestId("residents-page")).toBeVisible({ timeout: 15000 })
})

When("I open the first web alert if any exist", async function () {
  const rows = this.page.getByTestId("alert-row")
  const n = await rows.count()
  if (n === 0) return
  await rows.first().click()
})

Then("I should see the web alert detail or stay on alerts", async function () {
  const detail = this.page.getByTestId("alert-detail-page")
  const hub = this.page.getByTestId("alerts-page")
  const empty = this.page.getByTestId("alerts-empty")
  await expect(detail.or(hub).or(empty)).toBeVisible({ timeout: 15000 })
})

When("I go back to alerts from alert detail", async function () {
  const back = this.page.getByTestId("alert-detail-back")
  if ((await back.count()) > 0) {
    await back.click()
    await expect(this.page.getByTestId("alerts-page").or(this.page.getByTestId("alerts-empty"))).toBeVisible({
      timeout: 15000,
    })
  }
})

When("I open the web report template {string}", async function (templateId) {
  const link = this.page.getByTestId(`report-open-${templateId}`)
  await expect(link).toBeVisible({ timeout: 15000 })
  await link.click()
})

Then("I should see the web report detail view", async function () {
  await expect(this.page.getByTestId("report-detail-page")).toBeVisible({ timeout: 15000 })
})

When("I go back to reports from report detail", async function () {
  await this.page.getByTestId("report-detail-back").click()
  await expect(this.page.getByTestId("reports-page")).toBeVisible({ timeout: 15000 })
})

When("I follow web settings link {string}", async function (name) {
  const key = name.trim().toLowerCase()
  const map = {
    mfa: "settings-mfa-link",
    privacy: "settings-privacy-link",
    phone: "settings-phone-link",
  }
  const id = map[key]
  if (!id) throw new Error(`Unknown settings link: ${name}`)
  await this.page.getByTestId(id).click()
})

Then("I should see the web MFA settings page", async function () {
  await expect(this.page.getByTestId("settings-mfa-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: /Multi-factor authentication/i })).toBeVisible()
})

Then("I should see the web privacy settings page", async function () {
  await expect(this.page.getByTestId("settings-privacy-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: /Privacy & data/i })).toBeVisible()
})

When("I go back to web settings from subpage", async function () {
  await this.page.getByRole("link", { name: /Back to settings/i }).click()
  await expect(this.page.getByTestId("settings-page")).toBeVisible({ timeout: 15000 })
})
