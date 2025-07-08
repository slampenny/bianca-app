import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { loginUserViaUI, createPatientViaUI, goToOrgTab, logoutViaUI } from "./helpers/testHelpers"

test.describe("Unassigned Patients Assignment UI (E2E)", () => {
  let testUserEmail: string
  let testUserPassword: string

  test.beforeEach(async ({ page }) => {
    // Use admin credentials
    testUserEmail = 'admin@example.org'
    testUserPassword = 'password123'
  })

  test.afterEach(async ({ page }) => {
    await logoutViaUI(page);
  });

  test("orgAdmin should see assign unassigned patients button on caregiver screen", async ({ page }) => {
    await loginUserViaUI(page, testUserEmail, testUserPassword)
    await goToOrgTab(page)
    await page.getByTestId('view-caregivers-button').click()
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    if (await caregiverCards.count() > 0) {
      await caregiverCards.first().click()
      await expect(page.getByTestId("caregiver-save-button")).toBeVisible({ timeout: 10000 })
      const assignButton = page.getByTestId("assign-unassigned-patients-button")
      await expect(assignButton).toBeVisible({ timeout: 5000 })
    } else {
      await page.getByTestId('add-caregiver-button').click()
      await page.getByTestId('caregiver-name-input').fill('Test Caregiver')
      await page.getByTestId('caregiver-email-input').fill('test@example.com')
      await page.getByTestId('caregiver-phone-input').fill('1234567890')
      await page.getByTestId('caregiver-save-button').click()
      await page.getByTestId('view-caregivers-button').click()
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        await expect(page.getByTestId("caregiver-save-button")).toBeVisible({ timeout: 10000 })
        const assignButton = page.getByTestId("assign-unassigned-patients-button")
        await expect(assignButton).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test("should open unassigned patients modal when button is clicked", async ({ page }) => {
    await loginUserViaUI(page, testUserEmail, testUserPassword)
    await goToOrgTab(page)
    await page.getByTestId('view-caregivers-button').click()
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    if (await caregiverCards.count() > 0) {
      await caregiverCards.first().click()
      await expect(page.getByTestId("caregiver-save-button")).toBeVisible({ timeout: 10000 })
      const assignButton = page.getByTestId("assign-unassigned-patients-button")
      await assignButton.click()
      await expect(page.getByTestId("assign-unassigned-patients-modal")).toBeVisible({ timeout: 5000 })
      await expect(page.getByTestId("unassigned-patients-loading")).toBeVisible({ timeout: 5000 })
    }
  })

  test("should show no unassigned patients message when none exist", async ({ page }) => {
    await loginUserViaUI(page, testUserEmail, testUserPassword)
    await goToOrgTab(page)
    await page.getByTestId('view-caregivers-button').click()
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    if (await caregiverCards.count() > 0) {
      await caregiverCards.first().click()
      await expect(page.getByTestId("caregiver-save-button")).toBeVisible({ timeout: 10000 })
      const assignButton = page.getByTestId("assign-unassigned-patients-button")
      await assignButton.click()
      await expect(page.getByTestId("no-unassigned-patients-message")).toBeVisible({ timeout: 10000 })
    }
  })

  test("should create an unassigned patient, assign to caregiver, and show success", async ({ page }) => {
    await loginUserViaUI(page, testUserEmail, testUserPassword)
    const patientName = `Test Patient ${Date.now()}`
    const patientEmail = `test-patient-${Date.now()}@example.com`
    const patientPhone = "1234567890"
    await createPatientViaUI(page, patientName, patientEmail, patientPhone)
    await goToOrgTab(page)
    await page.getByTestId('view-caregivers-button').click()
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    expect(await caregiverCards.count()).toBeGreaterThan(0)
    await caregiverCards.first().click()
    await expect(page.getByTestId("caregiver-save-button")).toBeVisible({ timeout: 10000 })
    const assignButton = page.getByTestId("assign-unassigned-patients-button")
    await assignButton.click()
    await expect(page.getByTestId("assign-unassigned-patients-modal")).toBeVisible({ timeout: 5000 })
    const patientItem = page.getByTestId(`unassigned-patient-item-${patientName}`)
    await patientItem.click()
    const assignSelectedButton = page.getByTestId("assign-selected-patients-button")
    await assignSelectedButton.click()
    await expect(page.getByTestId("patients-assigned-success-message")).toBeVisible({ timeout: 5000 })
  })
}) 