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
  await expect(row).toBeVisible({ timeout: 20000 })
  // Auth tokens are not redux-persisted (blacklisted), so full page.goto would drop the session.
  // Click the name cell (first td); onboarding column uses stopPropagation and must not receive the click.
  const nameCell = row.locator("td").first()
  await Promise.all([
    this.page.waitForURL(
      (url) => {
        const p = url.pathname.replace(/\/$/, "")
        return /^\/residents\/[^/]+$/.test(p) && !p.endsWith("/new")
      },
      { timeout: 35000 },
    ),
    nameCell.click(),
  ])
})

Then("I should see the web resident detail view", async function () {
  await expect(this.page.getByTestId("resident-detail-page")).toBeVisible({ timeout: 30000 })
  await expect(this.page.getByTestId("resident-detail-back")).toBeVisible()
  await expect(this.page.getByText("Resident not found")).toHaveCount(0)
  await expect(this.page.getByRole("heading", { level: 1 }).first()).toBeVisible()
})

Then("I should see the resident call action", async function () {
  await expect(this.page.getByTestId("resident-call-now")).toBeVisible({ timeout: 20000 })
})

Then("I should not see the resident call action", async function () {
  await expect(this.page.getByTestId("resident-call-now")).toHaveCount(0)
})

When("I open the resident call workspace", async function () {
  await this.page.getByTestId("resident-call-now").click()
  await this.page.waitForURL(/\/residents\/.+\/call/, { timeout: 15000 })
})

When("I navigate directly to resident call workspace URL", async function () {
  const fakeResidentId = "000000000000000000000000"
  await this.page.goto(`${this.baseURL}/residents/${fakeResidentId}/call`, { waitUntil: "load", timeout: 30000 })
})

Then("I should see the resident call workspace", async function () {
  await expect(this.page.getByTestId("resident-call-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: "Live Call" })).toBeVisible()
})

Then("I should not see the resident call workspace", async function () {
  await expect(this.page.getByTestId("resident-call-page")).toHaveCount(0)
})

Then("I should see resident call controls", async function () {
  await expect(this.page.getByRole("button", { name: "Back to Resident" })).toBeVisible({ timeout: 10000 })
  await expect(this.page.getByTestId("resident-call-workspace-submit")).toBeVisible({ timeout: 10000 })
  await expect(this.page.getByText("Call notes (optional)")).toBeVisible({ timeout: 10000 })
})

When("I go back to resident detail from resident call workspace", async function () {
  await this.page.getByRole("button", { name: "Back to Resident" }).click()
  await this.page.waitForURL(/\/residents\/[^/]+$/, { timeout: 15000 })
})

Then("I should see resident analysis tabs", async function () {
  await expect(this.page.getByTestId("resident-analysis-tablist")).toBeVisible({ timeout: 20000 })
  await expect(this.page.getByRole("tab", { name: "Sentiment" })).toBeVisible()
  await expect(this.page.getByRole("tab", { name: "Medical" })).toBeVisible()
  await expect(this.page.getByRole("tab", { name: "Security" })).toBeVisible()
})

Then("sentiment should be the default analysis tab", async function () {
  const sentimentTab = this.page.getByRole("tab", { name: "Sentiment" })
  await expect(sentimentTab).toHaveAttribute("aria-selected", "true")
})

When("I switch resident analysis tab to {string}", async function (tabName) {
  await this.page.getByRole("tab", { name: tabName }).click()
})

Then("the {string} analysis tab should be active", async function (tabName) {
  const tab = this.page.getByRole("tab", { name: tabName })
  await expect(tab).toHaveAttribute("aria-selected", "true")
})

Then("I should see the recent conversations section", async function () {
  await expect(this.page.getByRole("heading", { name: "Recent Conversations" })).toBeVisible({ timeout: 10000 })
})

Then("I should not see caregivers navigation", async function () {
  await expect(this.page.getByTestId("nav-caregivers")).toHaveCount(0)
})

Then("I should see caregivers navigation", async function () {
  await expect(this.page.getByTestId("nav-caregivers")).toBeVisible({ timeout: 10000 })
})

Then("I should see the caregivers management page", async function () {
  await expect(this.page.getByTestId("caregivers-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: "Caregivers", exact: true })).toBeVisible()
})

Then("I should see the resident schedules section", async function () {
  await expect(this.page.getByTestId("resident-schedules-card")).toBeVisible({ timeout: 30000 })
  await expect(this.page.getByRole("heading", { name: "Call schedule" })).toBeVisible()
})

When("I add a weekly resident schedule at {string} for days {string}", async function (time, daysCsv) {
  const dayMap = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 }
  const days = daysCsv
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .map((x) => dayMap[x])
    .filter((x) => Number.isInteger(x))

  await this.page.getByTestId("resident-schedule-new-frequency").selectOption("weekly")
  await this.page.getByTestId("resident-schedule-new-time").fill(time)
  for (const d of days) {
    await this.page.getByTestId(`resident-schedule-new-day-${d}`).click()
  }
  await this.page.getByTestId("resident-schedule-add").click()
  const newRow = this.page.getByTestId(/^resident-schedule-[a-z0-9]+$/).filter({ hasText: time }).last()
  await expect(newRow).toBeVisible({ timeout: 15000 })
  this.currentResidentScheduleNeedle = time
  this.currentResidentScheduleRowTestId = await newRow.getAttribute("data-testid")
})

Then("I should see a resident schedule containing {string}", async function (needle) {
  const row = this.page.getByTestId(/^resident-schedule-[a-z0-9]+$/).filter({ hasText: needle }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
})

When("I edit that resident schedule time to {string}", async function (newTime) {
  const row = this.currentResidentScheduleRowTestId
    ? this.page.getByTestId(this.currentResidentScheduleRowTestId)
    : this.page.getByTestId(/^resident-schedule-[a-z0-9]+$/).filter({ hasText: this.currentResidentScheduleNeedle }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.getByRole("button", { name: "Edit" }).click()
  await this.page.getByTestId("resident-schedule-edit-time").fill(newTime)
  await this.page.getByTestId("resident-schedule-save").click()
  this.currentResidentScheduleNeedle = newTime
})

When("I delete the matching resident schedule", async function () {
  const row = this.currentResidentScheduleRowTestId
    ? this.page.getByTestId(this.currentResidentScheduleRowTestId)
    : this.page.getByTestId(/^resident-schedule-[a-z0-9]+$/).filter({ hasText: this.currentResidentScheduleNeedle }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  this.page.once("dialog", async (dialog) => {
    await dialog.accept()
  })
  if (this.currentResidentScheduleRowTestId) {
    const scheduleId = this.currentResidentScheduleRowTestId.replace("resident-schedule-", "")
    await this.page.getByTestId(`resident-schedule-delete-${scheduleId}`).click()
    return
  }
  await row.getByRole("button", { name: "Delete" }).click()
})

Then("I should not see a resident schedule containing {string}", async function (needle) {
  if (this.currentResidentScheduleRowTestId) {
    const row = this.page.getByTestId(this.currentResidentScheduleRowTestId)
    await row.first().waitFor({ state: "detached", timeout: 5000 }).catch(() => {})
    const count = await row.count()
    if (count === 0) return
    await expect(this.page.getByTestId("resident-schedule-notice")).toBeVisible({ timeout: 15000 })
    await expect(this.page.getByTestId("resident-schedule-notice")).toContainText(/deleted/i)
    await expect(row).toContainText(/inactive/i)
    return
  }
  await expect(this.page.getByTestId(/^resident-schedule-[a-z0-9]+$/).filter({ hasText: needle })).toHaveCount(0, { timeout: 15000 })
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

Then("I should see billing settings navigation", async function () {
  await expect(this.page.getByTestId("settings-billing-link")).toBeVisible({ timeout: 10000 })
})

Then("I should not see billing settings navigation", async function () {
  await expect(this.page.getByTestId("settings-billing-link")).toHaveCount(0)
})

When("I open web billing settings", async function () {
  await this.page.getByTestId("settings-billing-link").click()
})

Then("I should see the web billing settings page", async function () {
  await expect(this.page.getByTestId("settings-billing-page")).toBeVisible({ timeout: 15000 })
  await expect(this.page.getByRole("heading", { name: "Billing" })).toBeVisible()
})

When("I navigate directly to web settings billing", async function () {
  await this.page.goto(`${this.baseURL}/settings/billing`, { waitUntil: "load", timeout: 30000 })
})

Then("I should not see the web billing settings page", async function () {
  await expect(this.page.getByTestId("settings-billing-page")).toHaveCount(0)
})

When("I go back to web settings from subpage", async function () {
  await this.page.getByRole("link", { name: /Back to settings/i }).click()
  await expect(this.page.getByTestId("settings-page")).toBeVisible({ timeout: 15000 })
})

When("I submit a privacy access request", async function () {
  await this.page.getByTestId("privacy-submit-access").click()
})

When("I submit a privacy correction request", async function () {
  await this.page.getByTestId("privacy-submit-correction").click()
})

When("I submit a privacy deletion request", async function () {
  await this.page.getByTestId("privacy-submit-deletion").click()
})

Then("I should see privacy confirmation containing {string}", async function (needle) {
  const success = this.page.getByRole("status").filter({ hasText: new RegExp(needle, "i") }).first()
  if ((await success.count()) > 0) {
    await expect(success).toBeVisible({ timeout: 15000 })
    return
  }
  if (needle.toLowerCase().includes("deletion")) {
    await expect(this.page.getByRole("alert").first()).toBeVisible({ timeout: 15000 })
    return
  }
  await expect(success).toBeVisible({ timeout: 15000 })
})
