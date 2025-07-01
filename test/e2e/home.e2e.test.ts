import { test, expect, Page, request } from "@playwright/test";
import { isPatientScreen } from "./helpers/navigation"; // Assuming these helpers exist

// --- Test Configuration ---
const TEST_USER = {
  id: "test-user-001", // A consistent ID for your test user
  name: "E2E Test User",
  email: "fake@example.org",
  password: "Password1", // Use environment variables for secrets in real scenarios
};

const MOCK_PATIENTS = [
  // Define patient data structures your API expects
  { name: "Agnes Alphabet", avatar: "url_to_agnes_avatar.png", /* other needed fields */ },
  { name: "Barnaby Button", avatar: "url_to_barnaby_avatar.png", /* other needed fields */ },
];

test.describe("Home Screen (E2E with Backend Control)", () => {
  // --- Setup: Log in and Reset Data before each test ---
  test.beforeEach(async ({ page }) => {
    // Log in the consistent test user
    await loginUser(page, TEST_USER.email, TEST_USER.password, TEST_USER);

    // Reset patient data for the logged-in user via API
    await setupUserPatients(TEST_USER.id, []); // Pass empty array to only reset

    // Reload the page *after* resetting data to ensure HomeScreen fetches clean state
    await page.reload();

    // Wait for a stable element to ensure home screen is ready after reload
    await expect(page.getByText("Add Patient", { exact: true })).toBeVisible();
  });

  // --- Test Scenario: No Patients ---
  test("should display 'No patients found' when user has no patients", async ({ page }) => {
    // Data is already reset by beforeEach

    // Verify Welcome Message (recommend testID="home-welcome-header")
    await expect(page.locator(`text=/Welcome, ${TEST_USER.name}/i`)).toBeVisible();

    // Verify "No patients found" message (recommend testID="home-no-patients")
    await expect(page.getByText("No patients found")).toBeVisible();

    // Verify "Add Patient" button is visible (recommend testID="home-add-patient-button")
    await expect(page.getByText("Add Patient", { exact: true })).toBeVisible();
  });

  // --- Test Scenario: With Patients ---
  test("should display patient list when user has patients", async ({ page }) => {
    // Setup: Add specific patients for this test
    await setupUserPatients(TEST_USER.id, MOCK_PATIENTS);

    // Reload page to fetch the newly added patients
    await page.reload();
    await expect(page.getByText("Add Patient", { exact: true })).toBeVisible(); // Wait indicator


    // Verify Welcome Message
    await expect(page.locator(`text=/Welcome, ${TEST_USER.name}/i`)).toBeVisible();

    // Verify "No patients found" message is NOT visible
    await expect(page.getByText("No patients found")).not.toBeVisible();

    // Verify patient names are visible (recommend testID=`patient-name-${id}`)
    await expect(page.getByText(MOCK_PATIENTS[0].name)).toBeVisible();
    await expect(page.getByText(MOCK_PATIENTS[1].name)).toBeVisible();

    // Verify "Edit" buttons are visible (recommend testID=`patient-edit-button-${id}`)
    await expect(
      page.locator(`*:has-text("${MOCK_PATIENTS[0].name}")`).getByText("Edit", { exact: true }),
    ).toBeVisible();
     await expect(
      page.locator(`*:has-text("${MOCK_PATIENTS[1].name}")`).getByText("Edit", { exact: true }),
    ).toBeVisible();

    // Verify "Add Patient" button is visible
    await expect(page.getByText("Add Patient", { exact: true })).toBeVisible();
  });

  // --- Test Scenario: Add Patient Button ---
  test("should navigate to Patient screen when 'Add Patient' is clicked", async ({ page }) => {
    // No specific patient data setup needed here after reset

    // Click Add Patient button (recommend testID="home-add-patient-button")
    await page.getByText("Add Patient", { exact: true }).click();

    // Verify navigation to the Patient screen
    await isPatientScreen(page); // Use your helper function
  });

  // --- Test Scenario: Edit Patient Button ---
  test("should navigate to Patient screen when 'Edit' is clicked", async ({ page }) => {
    // Setup: Add one patient to edit
    await setupUserPatients(TEST_USER.id, [MOCK_PATIENTS[0]]);

     // Reload page to fetch the newly added patient
    await page.reload();
    await expect(page.getByText(MOCK_PATIENTS[0].name)).toBeVisible(); // Wait for patient


    // Click Edit button for the first patient (recommend testID=`patient-edit-button-${id}`)
    await page
      .locator(`*:has-text("${MOCK_PATIENTS[0].name}")`)
      .getByText("Edit", { exact: true })
      .click();

    // Verify navigation to the Patient screen
    await isPatientScreen(page);
     // Optional: Verify the Patient screen shows details for MOCK_PATIENTS[0]
  });

});

// --- Remember to implement/update your Helper Functions ---
// export async function loginUser(page: Page, email?: string, password?: string, user?: any) { ... }
// export async function isPatientScreen(page: Page) { ... }