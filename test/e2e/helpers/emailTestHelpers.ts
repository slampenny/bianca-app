import { Page, BrowserContext } from '@playwright/test'

/**
 * Email testing helpers for invite workflow tests
 * These helpers simulate email interactions in a test environment
 */

export interface EmailMessage {
  to: string
  from: string
  subject: string
  body: string
  htmlBody?: string
  links: string[]
}

export class EmailTestHelper {
  private emails: EmailMessage[] = []

  /**
   * Mock email sending - captures emails instead of actually sending them
   */
  async mockEmailService(page: Page) {
    await page.route('**/v1/orgs/*/sendInvite', async (route) => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      // Generate a mock invite token
      const inviteToken = `mock_invite_token_${Date.now()}`
      
      // Capture the email that would be sent
      const email: EmailMessage = {
        to: postData.email,
        from: 'noreply@bianca-app.com',
        subject: 'You\'re invited to join Bianca App',
        body: `You've been invited to join Test Organization. Click the link below to complete your registration.`,
        htmlBody: this.generateInviteEmailHTML(inviteToken, postData.email),
        links: [this.generateInviteLink(inviteToken)]
      }
      
      this.emails.push(email)
      
      // Return the normal API response
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          caregiver: {
            id: `mock_invited_caregiver_${Date.now()}`,
            email: postData.email,
            name: postData.name,
            role: 'invited',
            avatar: '',
            phone: postData.phone,
            org: 'mock_org_id',
            patients: []
          },
          inviteToken: inviteToken
        })
      })
    })
  }

  /**
   * Get the most recent email sent to a specific address
   */
  getLatestEmail(to: string): EmailMessage | null {
    const userEmails = this.emails.filter(email => email.to === to)
    return userEmails.length > 0 ? userEmails[userEmails.length - 1] : null
  }

  /**
   * Get all emails sent to a specific address
   */
  getAllEmails(to: string): EmailMessage[] {
    return this.emails.filter(email => email.to === to)
  }

  /**
   * Clear all captured emails
   */
  clearEmails() {
    this.emails = []
  }

  /**
   * Generate invite email HTML content
   */
  private generateInviteEmailHTML(inviteToken: string, email: string): string {
    const inviteLink = this.generateInviteLink(inviteToken)
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>You're invited to join Bianca App</title>
        </head>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You're invited to join Bianca App</h2>
            <p>Hello,</p>
            <p>You've been invited to join Bianca App. Click the button below to complete your registration:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Complete Registration
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${inviteLink}</p>
            <p>This invitation will expire in 7 days.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Generate invite link (matches backend implementation)
   */
  private generateInviteLink(inviteToken: string): string {
    return `http://localhost:8081/signup?token=${inviteToken}`
  }

  /**
   * Simulate clicking an email link
   */
  async clickEmailLink(context: BrowserContext, email: EmailMessage, linkIndex: number = 0): Promise<Page> {
    if (linkIndex >= email.links.length) {
      throw new Error(`Link index ${linkIndex} out of range. Email has ${email.links.length} links.`)
    }

    const newPage = await context.newPage()
    await newPage.goto(email.links[linkIndex])
    return newPage
  }

  /**
   * Extract invite token from email link
   */
  extractInviteToken(email: EmailMessage, linkIndex: number = 0): string | null {
    if (linkIndex >= email.links.length) {
      return null
    }

    const url = new URL(email.links[linkIndex])
    return url.searchParams.get('token')
  }
}

/**
 * Helper function to set up email testing for invite workflow
 */
export async function setupEmailTesting(page: Page): Promise<EmailTestHelper> {
  const emailHelper = new EmailTestHelper()
  await emailHelper.mockEmailService(page)
  return emailHelper
}

/**
 * Helper function to simulate the complete invite workflow
 */
export async function simulateInviteWorkflow(
  adminPage: Page,
  context: BrowserContext,
  inviteeEmail: string,
  inviteeName: string,
  inviteePhone: string
): Promise<{ adminPage: Page; inviteePage: Page; emailHelper: EmailTestHelper }> {
  // Set up email testing
  const emailHelper = await setupEmailTesting(adminPage)

  // Admin sends invite
  await adminPage.getByTestId('invite-caregiver-button').click()
  await adminPage.getByTestId('invite-email-input').fill(inviteeEmail)
  await adminPage.getByTestId('send-invite-button').click()

  // Wait for success message
  await adminPage.waitForSelector('[data-testid="invite-success-message"]', { timeout: 5000 })

  // Get the email that was sent
  const email = emailHelper.getLatestEmail(inviteeEmail)
  if (!email) {
    throw new Error('No email was captured for the invite')
  }

  // Simulate clicking the email link
  const inviteePage = await emailHelper.clickEmailLink(context, email)

  // Complete registration on the invitee page
  await inviteePage.waitForSelector('[data-testid="register-with-invite-screen"]')
  await inviteePage.getByTestId('register-name').fill(inviteeName)
  await inviteePage.getByTestId('register-password').fill('StrongPassword123!')
  await inviteePage.getByTestId('register-confirm-password').fill('StrongPassword123!')
  await inviteePage.getByTestId('register-phone').fill(inviteePhone)
  await inviteePage.getByTestId('register-submit').click()

  return { adminPage, inviteePage, emailHelper }
}
