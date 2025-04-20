import { Page, expect } from "@playwright/test"

export async function navigateToRegister(page: Page) {
  await page.goto("/")
  await page.getByTestId("register-button").click()
  await expect(page.getByTestId("register-name")).toBeVisible()
}
