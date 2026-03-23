import { Page, expect } from '@playwright/test'

// Modular client care workflow components
export class ClientWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  async givenIHaveClientsAssigned() {
    // Wait for home screen to load - use multiple indicators
    try {
      // Try waiting for Add Client button (from working navigation helper)
      await expect(this.page.getByText('Add Client', { exact: true })).toBeVisible({ timeout: 10000 })
    } catch {
      try {
        // Fallback: wait for home header
        await this.page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
      } catch {
        // Final fallback: just wait for page to be ready
        await this.page.waitForTimeout(3000)
      }
    }

    // Check that we have clients or "no clients" message (use correct selectors)
    const clientCards = await this.page.locator('[data-testid^="client-card-"]').count() // Use starts-with selector
    const noClients = await this.page.getByTestId('home-no-clients').count()
    const noUsersText = await this.page.getByText(/no clients found/i).count()
    const addClientButton = await this.page.getByText('Add Client').count()

    console.log('Client workflow elements found:', { clientCards, noClients, noUsersText, addClientButton })

    // We should have at least one indicator that we're on the home screen
    expect(clientCards + noClients + noUsersText + addClientButton).toBeGreaterThan(0)
  }

  async givenIHaveAClientNamed(clientName: string) {
    // Use the correct selector pattern for client cards
    const clientCard = this.page.locator('[data-testid^="client-card-"]').filter({ hasText: clientName })
    await expect(clientCard).toBeVisible()
    return { name: clientName }
  }

  async givenIHaveInitiatedCallToClient(clientName: string) {
    await this.whenIClickCallNowForClient(clientName)
    await this.thenIShouldSeeCallStatusBanner()
  }

  async givenCallStatusIs(status: string) {
    await this.page.waitForFunction(
      (expectedStatus) => {
        const banner = document.querySelector('[data-testid="call-status"]')
        return banner && banner.textContent?.toLowerCase().includes(expectedStatus.toLowerCase())
      },
      status,
      { timeout: 10000 }
    )
  }

  async givenIHaveCompletedCallWithClient(clientName: string) {
    // Navigate to conversations to find completed call
    await this.page.getByTestId('conversations-tab').click()
    const conversation = this.page.getByTestId('conversation-item').filter({ hasText: clientName })
    await expect(conversation).toBeVisible()
  }

  async givenConversationHasBeenAnalyzed() {
    await this.page.waitForSelector('[data-testid="analysis-available"]', { timeout: 10000 })
  }

  // WHEN steps - Actions
  async whenIClickCallNowForClient(clientName: string) {
    // COMMENTED OUT: This actually calls real phone numbers!
    const callButton = this.page.getByTestId(`call-now-${clientName}`)

    // Check if call button exists but DON'T click it
    const callButtonCount = await callButton.count()
    if (callButtonCount === 0) {
      // Try finding call button within the client card
      const clientCard = this.page.locator('[data-testid^="client-card-"]').filter({ hasText: clientName })
      const callButtonInCard = clientCard.locator('[data-testid*="call"]')
      const callButtonInCardCount = await callButtonInCard.count()
      console.log(
        `⚠ Call button for ${clientName} found in card: ${callButtonInCardCount > 0} (NOT clicking to avoid phone calls)`
      )
      // await callButtonInCard.click() // COMMENTED OUT - CALLS REAL PHONE
    } else {
      console.log(`⚠ Call button for ${clientName} found: ${callButtonCount > 0} (NOT clicking to avoid phone calls)`)
      // await callButton.click() // COMMENTED OUT - CALLS REAL PHONE
    }

    // Return whether call button was found (for testing purposes)
    return callButtonCount > 0
  }

  async whenIMonitorConversationScreen() {
    await this.page.waitForSelector('[data-testid="conversation-screen"]', { timeout: 10000 })
    await this.page.waitForSelector('[data-testid="conversation-messages"]', { timeout: 10000 })
  }

  async whenINavigateToAnalysisScreen() {
    await this.page.getByTestId('analysis-tab').click()
    await this.page.waitForSelector('[data-testid="analysis-screen"]', { timeout: 10000 })
  }

  async whenIAddCallNotes(notes: string) {
    const notesInput = this.page.getByTestId('call-notes-input')
    await notesInput.fill(notes)
  }

  async whenIClickEndCall() {
    // COMMENTED OUT: This might end actual phone calls
    console.log('⚠ End call button found (NOT clicking to avoid ending real calls)')
    // await this.page.getByTestId('end-call-button').click()
  }

  async whenIClickClientCard(clientName: string) {
    const clientCard = this.page.locator('[data-testid^="client-card-"]').filter({ hasText: clientName })
    await clientCard.click()
  }

  async whenIClickAddClient() {
    await this.page.getByTestId('add-client-button').click()
  }

  async whenIFillClientForm(clientData: any) {
    await this.page.getByTestId('client-name-input').fill(clientData.name)
    await this.page.getByTestId('client-email-input').fill(clientData.email)
    await this.page.getByTestId('client-phone-input').fill(clientData.phone)
  }

  async whenIClickCreateClient() {
    await this.page.getByTestId('save-client-button').click()
  }

  // THEN steps - Assertions
  async thenIShouldSeeCallStatusBanner() {
    await expect(this.page.getByTestId('call-status-banner')).toBeVisible()
  }

  async thenCallStatusShouldBe(expectedStatus: string) {
    const statusText = await this.page.getByTestId('call-status').textContent()
    expect(statusText?.toLowerCase()).toContain(expectedStatus.toLowerCase())
  }

  async thenIShouldBeRedirectedToConversationScreen() {
    await this.page.waitForSelector('[data-testid="conversation-screen"]', { timeout: 10000 })
    const currentUrl = this.page.url()
    expect(currentUrl).toContain('conversation')
  }

  async thenIShouldSeeRealTimeUpdates() {
    await expect(this.page.getByTestId('conversation-messages')).toBeVisible()
    const messages = await this.page.getByTestId('message-item').count()
    expect(messages).toBeGreaterThan(0)
  }

  async thenIShouldSeeCallDurationTimer() {
    await expect(this.page.getByTestId('call-duration')).toBeVisible()
    const durationText = await this.page.getByTestId('call-duration').textContent()
    expect(durationText).toMatch(/\d{2}:\d{2}/)
  }

  async thenIShouldSeeAIInsights() {
    await expect(this.page.getByTestId('medical-insights')).toBeVisible()
    const insights = await this.page.getByTestId('medical-insights').textContent()
    expect(insights?.length).toBeGreaterThan(0)
  }

  async thenIShouldSeeSentimentAnalysis() {
    await expect(this.page.getByTestId('sentiment-analysis')).toBeVisible()
    await expect(this.page.getByTestId('sentiment-score')).toBeVisible()
  }

  async thenIShouldBeAbleToExportReport() {
    const exportButton = this.page.getByTestId('export-report-button')
    await expect(exportButton).toBeVisible()
    await exportButton.click()
    await expect(this.page.getByTestId('export-confirmation')).toBeVisible()
  }

  async thenIShouldSeeClientInList(clientName: string) {
    const clientCard = this.page.locator('[data-testid^="client-card-"]').filter({ hasText: clientName })
    await expect(clientCard).toBeVisible()
  }

  async thenIShouldSeeClientCreatedMessage() {
    await expect(this.page.getByTestId('client-saved')).toBeVisible()
  }

  async thenIShouldSeeErrorMessage(expectedError: string) {
    const errorElement = this.page.getByText(new RegExp(expectedError, 'i'))
    await expect(errorElement).toBeVisible()
  }
}
