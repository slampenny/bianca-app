import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { isPatientScreen, navigateToHome } from "./helpers/navigation";
import { logoutViaUI } from './helpers/testHelpers'
import { TEST_USERS, TEST_PATIENTS } from './fixtures/testData'

test.describe("Home Screen (UI-driven E2E)", () => {

  test.afterEach(async ({ page }) => {
    await logoutViaUI(page);
  });

  test("should display 'No patients found' when user has no patients", async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITHOUT_PATIENTS);
    await expect(page.getByTestId("home-header")).toBeVisible();
    
    await expect(page.getByTestId("home-welcome-header")).toContainText(TEST_USERS.WITHOUT_PATIENTS.name);
    await expect(page.getByTestId("home-no-patients")).toBeVisible();
    await expect(page.getByTestId("add-patient-button")).toBeVisible();
  });

  test("should display patient list when user has patients", async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS);
    await expect(page.getByTestId("home-header")).toBeVisible();
    
    await expect(page.getByTestId("home-welcome-header")).toContainText(TEST_USERS.WITH_PATIENTS.name);
    await expect(page.getByTestId("home-no-patients")).not.toBeVisible();
    // These patients should already exist from seed data
    await expect(page.getByTestId(`patient-name-${TEST_PATIENTS.AGNES.name}`)).toBeVisible();
    await expect(page.getByTestId(`patient-name-${TEST_PATIENTS.BARNABY.name}`)).toBeVisible();
    await expect(page.getByTestId(`edit-patient-button-${TEST_PATIENTS.AGNES.name}`)).toBeVisible();
    await expect(page.getByTestId(`edit-patient-button-${TEST_PATIENTS.BARNABY.name}`)).toBeVisible();
    await expect(page.getByTestId("add-patient-button")).toBeVisible();
  });

  test("should navigate to Patient screen when 'Add Patient' is clicked", async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITHOUT_PATIENTS);
    await expect(page.getByTestId("home-header")).toBeVisible();
    
    await page.getByTestId("add-patient-button").click();
    await isPatientScreen(page);
  });

  test("should navigate to Patient screen when 'Edit' is clicked", async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS);
    await expect(page.getByTestId("home-header")).toBeVisible();
    
    // Use existing patient from seed data
    await page.getByTestId(`edit-patient-button-${TEST_PATIENTS.AGNES.name}`).click();
    await isPatientScreen(page);
  });
});

// --- Remember to implement/update your Helper Functions ---
// export async function loginUser(page: Page, email?: string, password?: string, user?: any) { ... }
// export async function isPatientScreen(page: Page) { ... }