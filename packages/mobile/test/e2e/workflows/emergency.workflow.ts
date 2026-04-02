import { Page, expect } from '@playwright/test'

// Modular emergency response workflow components
export class EmergencyWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  async givenThereIsACriticalAlertForClient(clientName: string) {
    // Navigate to alerts tab
    await this.page.getByTestId('alerts-tab').click()
    await this.page.waitForSelector('[data-testid="alert-list"]', { timeout: 10000 })
    
    // Verify critical alert exists
    const alert = this.page.getByTestId('alert-item').filter({ hasText: clientName })
    await expect(alert).toBeVisible()
    
    return { clientName, severity: 'CRITICAL' }
  }

  async givenAlertSeverityIs(severity: string) {
    const alertBadge = this.page.getByTestId('alert-severity-badge')
    await expect(alertBadge).toContainText(severity)
  }

  async givenIAmViewingCriticalAlert(clientName: string) {
    await this.page.getByTestId('alerts-tab').click()
    const alert = this.page.getByTestId('alert-item').filter({ hasText: clientName })
    await alert.click()
    await this.page.waitForSelector('[data-testid="alert-details"]', { timeout: 10000 })
  }

  async givenIHaveRespondedToEmergency(clientName: string) {
    return {
      clientName,
      responded: true,
      timestamp: new Date()
    }
  }

  async givenIAmRespondingToLifeThreateningEmergency(clientName: string) {
    return {
      clientName,
      severity: 'LIFE_THREATENING',
      requiresEscalation: true
    }
  }

  // WHEN steps - Actions
  async whenITapAlertBadgeOnHomeScreen() {
    const alertBadge = this.page.getByTestId('alert-badge')
    await expect(alertBadge).toBeVisible()
    await alertBadge.click()
  }

  async whenIClickCallClientImmediately() {
    await this.page.getByTestId('call-client-immediately-button').click()
  }

  async whenIAddEmergencyNotes(notes: string) {
    const notesInput = this.page.getByTestId('emergency-notes-input')
    await notesInput.fill(notes)
  }

  async whenIMarkAlertAsResolved() {
    await this.page.getByTestId('mark-alert-resolved-button').click()
  }

  async whenIDetermineEmergencyServicesNeeded() {
    // This represents a decision point in the workflow
    return { emergencyServicesNeeded: true }
  }

  async whenIClickContactEmergencyServices() {
    await this.page.getByTestId('contact-emergency-services-button').click()
  }

  // THEN steps - Assertions
  async thenIShouldSeeEmergencyAlertDetails() {
    await expect(this.page.getByTestId('alert-details')).toBeVisible()
    await expect(this.page.getByTestId('alert-severity')).toBeVisible()
    await expect(this.page.getByTestId('alert-timestamp')).toBeVisible()
    await expect(this.page.getByTestId('alert-description')).toBeVisible()
  }

  async thenIShouldSeeRecentConversationContext() {
    await expect(this.page.getByTestId('recent-conversations')).toBeVisible()
    const conversations = await this.page.getByTestId('conversation-summary').count()
    expect(conversations).toBeGreaterThan(0)
  }

  async thenIShouldSeeCallClientButton() {
    await expect(this.page.getByTestId('call-client-immediately-button')).toBeVisible()
  }

  async thenCallShouldBeHighPriority() {
    await expect(this.page.getByTestId('priority-call-indicator')).toBeVisible()
    const priorityLevel = await this.page.getByTestId('call-priority').textContent()
    expect(priorityLevel).toContain('HIGH')
  }

  async thenAlertShouldBeMarkedAs(status: string) {
    await this.page.waitForFunction(
      (expectedStatus) => {
        const statusElement = document.querySelector('[data-testid="alert-status"]')
        return statusElement && statusElement.textContent?.toLowerCase().includes(expectedStatus.toLowerCase())
      },
      status,
      { timeout: 5000 }
    )
  }

  async thenTeamMembersShouldBeNotified() {
    await expect(this.page.getByTestId('team-notification-sent')).toBeVisible()
  }

  async thenAlertShouldBeClosed() {
    const alertStatus = await this.page.getByTestId('alert-status').textContent()
    expect(alertStatus?.toLowerCase()).toContain('resolved')
  }

  async thenResponseShouldBeDocumented() {
    await this.page.getByTestId('client-record-link').click()
    await expect(this.page.getByTestId('emergency-response-log')).toBeVisible()
  }

  async thenFollowUpReminderShouldBeCreated() {
    await expect(this.page.getByTestId('followup-reminder')).toBeVisible()
  }

  async thenIShouldSeeEmergencyContacts() {
    await expect(this.page.getByTestId('emergency-contacts')).toBeVisible()
    const contacts = await this.page.getByTestId('emergency-contact-item').count()
    expect(contacts).toBeGreaterThan(0)
  }

  async thenEscalationShouldBeLogged() {
    await expect(this.page.getByTestId('escalation-logged')).toBeVisible()
  }

  async thenAlertShouldRemainActive() {
    const alertStatus = await this.page.getByTestId('alert-status').textContent()
    expect(alertStatus?.toLowerCase()).toContain('active')
  }
}
