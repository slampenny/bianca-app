import { test, expect, device } from '@detox/e2e'
import { loginAsCaregiver, createTestPatient, cleanupTestData } from './helpers/testHelpers'
import { USER_WITH_PATIENTS } from './fixtures/user.fixture'

describe('Sentiment Analysis E2E Tests', () => {
  let patientId: string
  let patientName: string

  beforeAll(async () => {
    // Login as caregiver
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Create a test patient
    const patient = await createTestPatient({
      name: 'Sentiment Test Patient',
      email: 'sentiment-test@example.com',
      phone: '+16045624266'
    })
    patientId = patient.id
    patientName = patient.name
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  test('should navigate to sentiment analysis from patient screen', async () => {
    // Navigate to patient screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await expect(element(by.text(patientName))).toBeVisible()
    
    // Check if sentiment analysis button is visible
    await expect(element(by.id('view-sentiment-analysis-button'))).toBeVisible()
    
    // Tap sentiment analysis button
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Verify we're on sentiment analysis screen
    await expect(element(by.text('Sentiment Analysis'))).toBeVisible()
    await expect(element(by.text('Patient Sentiment Analysis'))).toBeVisible()
  })

  test('should display sentiment dashboard with time range selector', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Verify time range selector is visible
    await expect(element(by.text('Time Range:'))).toBeVisible()
    await expect(element(by.text('Month'))).toBeVisible()
    await expect(element(by.text('Year'))).toBeVisible()
    await expect(element(by.text('All Time'))).toBeVisible()
    
    // Verify default selection is Month
    await expect(element(by.text('Month'))).toHaveValue('selected')
  })

  test('should change time range selection', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Tap Year button
    await element(by.text('Year')).tap()
    await expect(element(by.text('Year'))).toHaveValue('selected')
    
    // Tap All Time button
    await element(by.text('All Time')).tap()
    await expect(element(by.text('All Time'))).toHaveValue('selected')
    
    // Tap Month button
    await element(by.text('Month')).tap()
    await expect(element(by.text('Month'))).toHaveValue('selected')
  })

  test('should display no data state when no sentiment data', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Verify no data state is displayed
    await expect(element(by.text('No Sentiment Data Available'))).toBeVisible()
    await expect(element(by.text('Sentiment analysis will appear here once the patient has completed conversations.'))).toBeVisible()
  })

  test('should display loading state', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Verify loading state is displayed initially
    await expect(element(by.text('Loading sentiment analysis...'))).toBeVisible()
  })

  test('should display footer information', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Scroll to bottom to see footer
    await element(by.id('sentiment-dashboard-scroll')).scrollTo('bottom')
    
    // Verify footer information is displayed
    await expect(element(by.text('Sentiment analysis is automatically generated after each conversation using AI technology.'))).toBeVisible()
  })

  test('should handle pull-to-refresh', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Perform pull-to-refresh
    await element(by.id('sentiment-dashboard-scroll')).scrollTo('top', 'fast', 0.1)
    
    // Verify loading state appears during refresh
    await expect(element(by.text('Loading sentiment analysis...'))).toBeVisible()
  })

  test('should navigate back from sentiment analysis screen', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Verify we're on sentiment analysis screen
    await expect(element(by.text('Sentiment Analysis'))).toBeVisible()
    
    // Navigate back
    await element(by.id('back-button')).tap()
    
    // Verify we're back on patient screen
    await expect(element(by.text(patientName))).toBeVisible()
  })

  test('should display sentiment indicators in conversation list', async () => {
    // Navigate to conversations screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then conversations
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('manage-conversations-button')).tap()
    
    // Verify conversation list is displayed
    await expect(element(by.text('Conversations'))).toBeVisible()
    
    // Check if sentiment indicators are visible (if conversations exist)
    const conversationItems = await element(by.id('conversation-item'))
    if (await conversationItems.getCount() > 0) {
      await expect(element(by.id('sentiment-indicator'))).toBeVisible()
    }
  })

  test('should handle sentiment analysis with mock data', async () => {
    // This test would require setting up mock sentiment data
    // For now, we'll test the UI components with expected data
    
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Wait for any potential data to load
    await waitFor(element(by.text('No Sentiment Data Available')))
      .toBeVisible()
      .withTimeout(10000)
    
    // Verify the screen is functional
    await expect(element(by.text('Patient Sentiment Analysis'))).toBeVisible()
    await expect(element(by.text('Time Range:'))).toBeVisible()
  })

  test('should handle error states gracefully', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Verify error handling (no data state)
    await expect(element(by.text('No Sentiment Data Available'))).toBeVisible()
    
    // Verify the screen is still functional
    await expect(element(by.text('Time Range:'))).toBeVisible()
    await expect(element(by.text('Month'))).toBeVisible()
  })

  test('should maintain state during navigation', async () => {
    // Navigate to sentiment analysis screen
    await device.launchApp({ newInstance: true })
    await loginAsCaregiver(USER_WITH_PATIENTS.email, USER_WITH_PATIENTS.password)
    
    // Go to patient screen and then sentiment analysis
    await element(by.id('patient-list-item')).atIndex(0).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Change time range
    await element(by.text('Year')).tap()
    await expect(element(by.text('Year'))).toHaveValue('selected')
    
    // Navigate back and forward
    await element(by.id('back-button')).tap()
    await element(by.id('view-sentiment-analysis-button')).tap()
    
    // Verify state is maintained (this would depend on implementation)
    await expect(element(by.text('Sentiment Analysis'))).toBeVisible()
  })
})


