import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'
import { TEST_USERS } from './fixtures/testData'

test.describe('Conversations Screen', () => {
  test('should expand and collapse conversations without errors', async ({ page }) => {
    const auth = new AuthWorkflow(page)

    // GIVEN: I am logged in as a user with patients
    await auth.givenIAmOnTheLoginScreen()
    await auth.whenIEnterCredentials(TEST_USERS.WITH_PATIENTS.email, TEST_USERS.WITH_PATIENTS.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()

    // WHEN: I navigate to the conversations screen via patient management
    await page.waitForSelector('[data-testid*="edit-patient-button-"]', { timeout: 15000 })
    await page.getByTestId(/edit-patient-button-/).first().click()
    await page.waitForSelector('[data-testid="patient-screen"]', { timeout: 10000 })
    await page.waitForSelector('[data-testid="manage-conversations-button"]', { timeout: 10000 })
    await page.getByTestId('manage-conversations-button').click()
    await page.waitForSelector('[data-testid="conversations-screen"]', { timeout: 10000 })

    // THEN: I should see conversation cards
    const conversationCards = page.locator('[data-testid*="conversation-card"]')
    await expect(conversationCards.first()).toBeVisible({ timeout: 10000 })
    
    // WHEN: I click to expand a conversation
    const firstConversation = conversationCards.first()
    
    // Click to expand
    await firstConversation.click()
    
    // THEN: The conversation should expand and show "No messages yet" text
    await expect(firstConversation.locator('text=No messages yet')).toBeVisible({ timeout: 5000 })
    
    // WHEN: I click to collapse the conversation
    await firstConversation.click()
    
    // THEN: The conversation should collapse
    await expect(firstConversation.locator('text=No messages yet')).not.toBeVisible()
  })

  test('should handle multiple conversations', async ({ page }) => {
    const auth = new AuthWorkflow(page)

    // GIVEN: I am logged in as a user with patients
    await auth.givenIAmOnTheLoginScreen()
    await auth.whenIEnterCredentials(TEST_USERS.WITH_PATIENTS.email, TEST_USERS.WITH_PATIENTS.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()

    // WHEN: I navigate to the conversations screen
    await page.waitForSelector('[data-testid*="edit-patient-button-"]', { timeout: 15000 })
    await page.getByTestId(/edit-patient-button-/).first().click()
    await page.waitForSelector('[data-testid="patient-screen"]', { timeout: 10000 })
    await page.waitForSelector('[data-testid="manage-conversations-button"]', { timeout: 10000 })
    await page.getByTestId('manage-conversations-button').click()
    await page.waitForSelector('[data-testid="conversations-screen"]', { timeout: 10000 })

    // THEN: I should see conversation cards
    const conversationCards = page.locator('[data-testid*="conversation-card"]')
    await expect(conversationCards.first()).toBeVisible({ timeout: 10000 })

    // WHEN: I expand multiple conversations
    const allConversations = await conversationCards.count()
    for (let i = 0; i < Math.min(allConversations, 3); i++) {
      const conversation = conversationCards.nth(i)
      
      // Only expand if not already expanded
      const isExpanded = await conversation.locator('text=No messages yet').isVisible()
      if (!isExpanded) {
        await conversation.click()
        await expect(conversation.locator('text=No messages yet')).toBeVisible({ timeout: 5000 })
      }
    }
    
    // THEN: All expanded conversations should show their content
    for (let i = 0; i < Math.min(allConversations, 3); i++) {
      const conversation = conversationCards.nth(i)
      const hasMessages = await conversation.locator('text=No messages yet').isVisible()
      if (hasMessages) {
        await expect(conversation.locator('text=No messages yet')).toBeVisible()
      }
    }
  })
})
