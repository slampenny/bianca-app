/**
 * Step definitions for B2C vs org-family mobile account mode gating.
 */

const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

async function waitForHomeReady(page) {
  const homeTab = page.getByTestId('tab-home');
  if (await homeTab.isVisible().catch(() => false)) {
    await homeTab.click();
  }
  await page.locator('[data-testid="home-header"]').waitFor({ state: 'visible', timeout: 15000 });
  await page
    .locator('[data-testid^="edit-client-button-"], [data-testid="home-no-clients"]')
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });
}

When('I open the first linked loved one profile', async function () {
  const onProfile = await this.page.getByTestId('loved-one-profile-view').isVisible().catch(() => false);
  if (onProfile) {
    return;
  }

  const onNestedScreen = await this.page
    .locator('[data-testid="schedules-screen"], [data-testid="conversations-screen"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (onNestedScreen) {
    await this.page.goBack();
    await this.page.getByTestId('loved-one-profile-view').waitFor({ state: 'visible', timeout: 10000 });
    return;
  }

  await waitForHomeReady(this.page);
  const noClients = await this.page.getByTestId('home-no-clients').count();
  expect(noClients).toBe(0);
  const detailsBtn = this.page.locator('[data-testid^="edit-client-button-"]').first();
  await detailsBtn.click();
  await this.page.getByTestId('loved-one-profile-view').waitFor({ state: 'visible', timeout: 10000 });
});

When('I open the loved one schedule screen', async function () {
  await this.page.getByTestId('profile-schedule-button').click();
  await this.page.getByTestId('schedules-screen').waitFor({ state: 'visible', timeout: 10000 });
});

When('I open the loved one conversations screen', async function () {
  await this.page.getByTestId('profile-conversations-button').click();
  await this.page.getByTestId('conversations-screen').waitFor({ state: 'visible', timeout: 15000 });
});

Then('I should see the alerts tab', async function () {
  await waitForHomeReady(this.page);
  await expect(this.page.getByTestId('tab-alert')).toBeVisible({ timeout: 10000 });
});

Then('I should not see the alerts tab', async function () {
  await waitForHomeReady(this.page);
  await expect(this.page.getByTestId('tab-alert')).toHaveCount(0);
});

Then('I should see the add client button', async function () {
  await waitForHomeReady(this.page);
  await expect(this.page.getByTestId('add-client-button')).toBeVisible({ timeout: 10000 });
});

Then('I should not see the add client button', async function () {
  await waitForHomeReady(this.page);
  await expect(this.page.getByTestId('add-client-button')).toHaveCount(0);
});

Then('I should see the edit loved one button', async function () {
  await expect(this.page.getByTestId('profile-edit-button')).toBeVisible({ timeout: 5000 });
});

Then('I should not see the edit loved one button', async function () {
  await expect(this.page.getByTestId('profile-edit-button')).toHaveCount(0);
});

Then('I should see the schedule button on the profile', async function () {
  await expect(this.page.getByTestId('profile-schedule-button')).toBeVisible({ timeout: 5000 });
});

Then('I should see the conversations button on the profile', async function () {
  await expect(this.page.getByTestId('profile-conversations-button')).toBeVisible({ timeout: 5000 });
});

Then('I should see the save schedule button', async function () {
  await expect(this.page.getByTestId('schedule-save-button')).toBeVisible({ timeout: 5000 });
});

Then('I should not see the save schedule button', async function () {
  await expect(this.page.getByTestId('schedule-save-button')).toHaveCount(0);
});

Then('I should see the conversations screen', async function () {
  await expect(this.page.getByTestId('conversations-screen')).toBeVisible({ timeout: 10000 });
});

When('I open the family weekly digests from insights', async function () {
  await this.page.getByTestId('tab-insights').click();
  await this.page.getByTestId('reports-screen').waitFor({ state: 'visible', timeout: 15000 });
  await this.page.getByTestId('family-weekly-digests-button').click();
  await this.page.getByTestId('family-weekly-digests-screen').waitFor({ state: 'visible', timeout: 15000 });
});

Then('I should see at least one conversation on the list', async function () {
  const cards = this.page.locator('[data-testid^="conversation-card-"]');
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(1);
});

Then('I should see at least one family weekly digest', async function () {
  const rows = this.page.locator('[data-testid^="family-weekly-digest-row-"]');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  expect(await rows.count()).toBeGreaterThanOrEqual(1);
});
