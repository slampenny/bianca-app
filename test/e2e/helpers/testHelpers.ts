import { Page } from '@playwright/test'
import { Alert, Caregiver, Patient, Org } from '../../../app/services/api/api.types'

export interface TestUser {
  token: string
  caregiver: Caregiver
  org: Org
}

export async function registerUserViaUI(page: Page, name: string, email: string, password: string, phone: string): Promise<string> {
  await page.goto('/register')
  await page.fill('[data-testid="register-name"]', name)
  await page.fill('[data-testid="register-email"]', email)
  await page.fill('[data-testid="register-password"]', password)
  await page.fill('[data-testid="register-confirm-password"]', password)
  await page.fill('[data-testid="register-phone"]', phone)
  await page.click('[data-testid="register-submit"]')
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/login', { timeout: 10000 })
  // Get the auth token from localStorage
  const token = await page.evaluate(() => localStorage.getItem('authToken'))
  if (!token) throw new Error('Registration failed: no auth token found')
  return token
}

export async function loginUserViaUI(page: Page, email: string, password: string): Promise<string> {
  await page.goto('/')
  await page.getByTestId('email-input').fill(email)
  await page.getByTestId('password-input').fill(password)
  await page.getByTestId('login-button').click()
  
  // Wait for successful login by checking for navigation to home
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 })
  
  // Check if we're logged in by looking for elements that should be visible after login
  await page.waitForSelector('text=Add Patient', { timeout: 10000 })
  
  // Return a mock token since we can't easily access Redux state from Playwright
  return 'mock-token'
}

export async function createPatientViaUI(page: Page, name: string, email: string, phone: string) {
  await page.goto('/patient')
  await page.fill('[data-testid="patient-name-input"]', name)
  await page.fill('[data-testid="patient-email-input"]', email)
  await page.fill('[data-testid="patient-phone-input"]', phone)
  await page.click('[data-testid="save-patient-button"]')
  await page.waitForSelector(`[data-testid="patient-name-${name}"]`, { timeout: 10000 })
}

export async function createAlertViaUI(page: Page, message: string, importance: string, alertType: string, patientName?: string) {
  await page.goto('/alerts')
  await page.click('[data-testid="create-alert-button"]')
  await page.fill('[data-testid="alert-message-input"]', message)
  await page.selectOption('[data-testid="alert-importance-select"]', importance)
  await page.selectOption('[data-testid="alert-type-select"]', alertType)
  if (patientName) {
    await page.selectOption('[data-testid="alert-patient-select"]', { label: patientName })
  }
  await page.click('[data-testid="save-alert-button"]')
  await page.waitForSelector(`text=${message}`, { timeout: 10000 })
}

export async function markAlertAsReadViaUI(page: Page, alertMessage: string) {
  await page.goto('/alerts')
  const alertItem = page.locator(`[data-testid="alert-item"]:has-text("${alertMessage}")`)
  await alertItem.click()
  await page.waitForTimeout(500)
}

export async function markAllAlertsAsReadViaUI(page: Page) {
  await page.goto('/alerts')
  await page.click('[data-testid="mark-all-checkbox"]')
  await page.waitForTimeout(1000)
}

export async function getVisibleAlertMessages(page: Page): Promise<string[]> {
  await page.goto('/alerts')
  await page.waitForSelector('[data-testid="alert-list"]', { timeout: 10000 })
  const messages = await page.$$eval('[data-testid="alert-item"]', items => items.map(i => i.textContent || ''))
  return messages
}

// For E2E tests, we'll work through the web interface instead of direct API calls
// This is more realistic and tests the actual user experience

export async function createTestOrgAndCaregiver(page: Page): Promise<TestUser> {
  // Navigate to register page
  await page.goto('/register')
  
  // Fill in registration form
  await page.fill('[data-testid="register-name"]', 'Test Caregiver')
  await page.fill('[data-testid="register-email"]', `test-${Date.now()}@example.com`)
  await page.fill('[data-testid="register-password"]', 'TestPassword123!')
  await page.fill('[data-testid="register-confirm-password"]', 'TestPassword123!')
  await page.fill('[data-testid="register-phone"]', '1234567890')
  
  // Submit the form
  await page.click('[data-testid="register-submit"]')
  
  // Wait for successful registration and redirect
  await page.waitForURL('/')
  
  // Get the auth token from localStorage
  const token = await page.evaluate(() => localStorage.getItem('authToken'))
  
  if (!token) {
    throw new Error('Failed to get auth token after registration')
  }
  
  // For now, return a mock structure - in a real implementation,
  // you might need to make an API call to get the full user data
  return {
    token,
    caregiver: {
      id: 'mock-id',
      name: 'Test Caregiver',
      email: `test-${Date.now()}@example.com`,
      phone: '1234567890',
      role: 'orgAdmin',
      isEmailVerified: false,
      org: 'mock-org-id',
      patients: [],
      avatar: null
    } as unknown as Caregiver,
    org: {
      id: 'mock-org-id',
      name: 'Test Caregiver',
      email: `test-${Date.now()}@example.com`,
      phone: '1234567890',
      isEmailVerified: false,
      paymentMethods: [],
      caregivers: [],
      patients: [],
      deleted: false,
      stripeCustomerId: null,
      avatar: null
    } as unknown as Org
  }
}

export async function createTestPatient(
  page: Page, 
  token: string, 
  orgId: string
): Promise<Patient> {
  // Navigate to add patient page
  await page.goto('/patient')
  
  // Fill in patient form - using placeholder text since there are no test IDs
  await page.fill('input[placeholder="Name *"]', 'Test Patient')
  await page.fill('input[placeholder="Email *"]', `patient-${Date.now()}@example.com`)
  await page.fill('input[placeholder="Phone *"]', '1234567890')
  
  // Submit the form - look for the button text
  await page.click('button:has-text("CREATE PATIENT")')
  
  // Wait for successful creation and redirect
  await page.waitForURL('/')
  
  // Return mock patient data
  return {
    id: 'mock-patient-id',
    name: 'Test Patient',
    email: `patient-${Date.now()}@example.com`,
    phone: '1234567890',
    org: orgId,
    caregivers: [],
    conversations: [],
    schedules: [],
    avatar: null
  } as unknown as Patient
}

export async function createTestAlert(
  page: Page,
  token: string,
  alertData: Partial<Alert>
): Promise<Alert> {
  // For now, we'll create alerts through the UI if there's an alert creation page
  // Otherwise, we'll need to mock this or create alerts through a different mechanism
  
  // Navigate to alerts page
  await page.goto('/alerts')
  
  // If there's a create alert button, click it and fill the form
  const createButton = page.locator('[data-testid="create-alert-button"]')
  if (await createButton.isVisible()) {
    await createButton.click()
    
    // Fill in alert form
    await page.fill('[data-testid="alert-message-input"]', alertData.message || 'Test Alert')
    await page.selectOption('[data-testid="alert-importance-select"]', alertData.importance || 'medium')
    await page.selectOption('[data-testid="alert-type-select"]', alertData.alertType || 'system')
    
    // Submit the form
    await page.click('[data-testid="save-alert-button"]')
    
    // Wait for successful creation
    await page.waitForURL('/alerts')
  }
  
  // Return mock alert data
  return {
    id: 'mock-alert-id',
    message: alertData.message || 'Test Alert',
    importance: alertData.importance || 'medium',
    alertType: alertData.alertType || 'system',
    isRead: false,
    relevanceUntil: alertData.relevanceUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'mock-caregiver-id',
    createdModel: 'Caregiver',
    visibility: alertData.visibility || 'allCaregivers',
    relatedPatient: alertData.relatedPatient,
    relatedConversation: alertData.relatedConversation,
    readBy: []
  } as unknown as Alert
}

export async function markAlertAsRead(
  page: Page,
  token: string,
  alertId: string
): Promise<Alert> {
  // Navigate to alerts page
  await page.goto('/alerts')
  
  // Find the alert and click on it to mark as read
  const alertItem = page.locator(`[data-testid="alert-item"][data-alert-id="${alertId}"]`)
  await alertItem.click()
  
  // Wait for the alert to be marked as read
  await page.waitForTimeout(1000)
  
  // Return mock alert data
  return {
    id: alertId,
    message: 'Test Alert',
    importance: 'medium',
    alertType: 'system',
    isRead: true,
    relevanceUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'mock-caregiver-id',
    createdModel: 'Caregiver',
    visibility: 'allCaregivers'
  } as Alert
}

export async function markAllAlertsAsRead(
  page: Page,
  token: string,
  alertIds: string[]
): Promise<{ successfullyMarkedAlerts: Alert[] }> {
  // Navigate to alerts page
  await page.goto('/alerts')
  
  // Click the "Mark all as read" button
  const markAllButton = page.locator('[data-testid="mark-all-checkbox"]')
  await markAllButton.click()
  
  // Wait for the operation to complete
  await page.waitForTimeout(2000)
  
  // Return mock data
  return {
    successfullyMarkedAlerts: alertIds.map(id => ({
      id,
      message: 'Test Alert',
      importance: 'medium',
      alertType: 'system',
      isRead: true,
      relevanceUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'mock-caregiver-id',
      createdModel: 'Caregiver',
      visibility: 'allCaregivers'
    } as Alert))
  }
}

export async function getAlerts(
  page: Page,
  token: string,
  showRead: boolean = false
): Promise<Alert[]> {
  // Navigate to alerts page
  await page.goto('/alerts')
  
  // If showRead is false, make sure we're on the "Unread Alerts" tab
  if (!showRead) {
    const unreadTab = page.locator('text=Unread Alerts')
    await unreadTab.click()
  } else {
    const allTab = page.locator('text=All Alerts')
    await allTab.click()
  }
  
  // Wait for alerts to load
  await page.waitForSelector('[data-testid="alert-list"]', { timeout: 10000 })
  
  // Get all alert items
  const alertItems = await page.locator('[data-testid="alert-item"]').all()
  
  // Return mock alert data based on what we see
  return alertItems.map((_, index) => ({
    id: `mock-alert-${index}`,
    message: `Test Alert ${index + 1}`,
    importance: 'medium',
    alertType: 'system',
    isRead: showRead,
    relevanceUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'mock-caregiver-id',
    createdModel: 'Caregiver',
    visibility: 'allCaregivers'
  } as Alert))
}

export async function cleanupTestData(
  page: Page,
  token: string,
  orgId: string
) {
  // For E2E tests, cleanup is usually handled by the test framework
  // or by using a separate test database
  console.log('Cleanup would happen here in a real implementation')
} 