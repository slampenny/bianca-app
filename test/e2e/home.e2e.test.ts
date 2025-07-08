import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { isPatientScreen, navigateToHome } from "./helpers/navigation";
import { loginUserViaUI } from "./helpers/testHelpers";
import { logoutViaUI } from './helpers/testHelpers'

// --- Test Configuration ---
const USER_WITH_PATIENTS = {
  name: "Test User",
  email: "fake@example.org",
  password: "Password1",
};

const USER_WITH_NO_PATIENTS = {
  name: "Test User No Patients",
  email: "no-patients@example.org",
  password: "Password1",
};

test.describe("Home Screen (UI-driven E2E)", () => {

  test("should display 'No patients found' when user has no patients", async ({ page }) => {
    // Login with user that has no patients
    await navigateToHome(page);
    await loginUserViaUI(page, USER_WITH_NO_PATIENTS.email, USER_WITH_NO_PATIENTS.password);
    await expect(page.getByTestId("home-header")).toBeVisible();
    
    await expect(page.getByTestId("home-welcome-header")).toContainText(USER_WITH_NO_PATIENTS.name);
    await expect(page.getByTestId("home-no-patients")).toBeVisible();
    await expect(page.getByTestId("add-patient-button")).toBeVisible();
    
    await logoutViaUI(page);
  });

  test("should display patient list when user has patients", async ({ page }) => {
    // Login with user that already has patients (from seed data)
    await navigateToHome(page);
    await loginUserViaUI(page, USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password);
    await expect(page.getByTestId("home-header")).toBeVisible();
    
    await expect(page.getByTestId("home-welcome-header")).toContainText(USER_WITH_PATIENTS.name);
    await expect(page.getByTestId("home-no-patients")).not.toBeVisible();
    // These patients should already exist from seed data
    await expect(page.getByTestId("patient-name-Agnes Alphabet")).toBeVisible();
    await expect(page.getByTestId("patient-name-Barnaby Button")).toBeVisible();
    await expect(page.getByTestId("patient-edit-button-Agnes Alphabet")).toBeVisible();
    await expect(page.getByTestId("patient-edit-button-Barnaby Button")).toBeVisible();
    await expect(page.getByTestId("add-patient-button")).toBeVisible();
    
    await logoutViaUI(page);
  });

  test("should navigate to Patient screen when 'Add Patient' is clicked", async ({ page }) => {
    // Login with user that has no patients for this test
    await navigateToHome(page);
    await loginUserViaUI(page, USER_WITH_NO_PATIENTS.email, USER_WITH_NO_PATIENTS.password);
    await expect(page.getByTestId("home-header")).toBeVisible();
    
    await page.getByTestId("add-patient-button").click();
    await isPatientScreen(page);
    
    await logoutViaUI(page);
  });

  test("should navigate to Patient screen when 'Edit' is clicked", async ({ page }) => {
    // Login with user that has patients
    await navigateToHome(page);
    await loginUserViaUI(page, USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password);
    await expect(page.getByTestId("home-header")).toBeVisible();
    
    // Use existing patient from seed data
    await page.getByTestId("patient-edit-button-Agnes Alphabet").click();
    await isPatientScreen(page);
    
    await logoutViaUI(page);
  });
});

// --- Remember to implement/update your Helper Functions ---
// export async function loginUser(page: Page, email?: string, password?: string, user?: any) { ... }
// export async function isPatientScreen(page: Page) { ... }