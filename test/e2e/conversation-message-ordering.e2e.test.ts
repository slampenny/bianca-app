import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'
import { TEST_USERS } from './fixtures/testData'
import { Page } from '@playwright/test'

/**
 * This test verifies that conversation messages are displayed in the correct
 * chronological order during a live call, even when messages are created/updated
 * in a different order.
 * 
 * Scenario:
 * 1. User starts speaking → placeholder created with timestamp T1
 * 2. AI starts speaking → placeholder created with timestamp T2 (T2 > T1)
 * 3. User stops speaking → placeholder updated with real text, timestamp preserved (T1)
 * 4. AI stops speaking → placeholder updated with real text, timestamp preserved (T2)
 * 
 * Expected: Frontend should display user message first (T1), then AI message (T2)
 */
test.describe('Conversation Message Ordering - Live Call', () => {
  test('should display messages in chronological order when user speaks before AI', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    
    // GIVEN: I am logged in
    await auth.givenIAmOnTheLoginScreen()
    await auth.whenIEnterCredentials(TEST_USERS.WITH_PATIENTS.email, TEST_USERS.WITH_PATIENTS.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()

    // Setup: Create timestamps that simulate the real scenario
    const userStartTime = new Date('2024-01-01T10:00:00.000Z')
    const aiStartTime = new Date('2024-01-01T10:00:05.000Z') // AI starts 5 seconds after user
    const conversationId = 'test-conversation-123'
    const callSid = 'test-call-sid-456'

    // Mock the initiate call endpoint
    let callInitiated = false
    await page.route('**/v1/calls/initiate', async (route) => {
      callInitiated = true
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId,
          callSid,
          patientId: 'test-patient-id',
          patientName: 'Test Patient',
          patientPhone: '5551234567',
          status: 'initiated'
        })
      })
    })

    // Mock the getCallStatus endpoint to return messages in the correct order
    // This simulates what the backend should return after messages are saved
    let callStatusCallCount = 0
    await page.route(`**/v1/calls/${conversationId}/status`, async (route) => {
      callStatusCallCount++
      
      // Simulate progressive message updates
      let messages: any[] = []
      
      if (callStatusCallCount === 1) {
        // First poll: User placeholder exists
        messages = [{
          _id: 'msg-user-1',
          id: 'msg-user-1',
          role: 'patient',
          content: '[Speaking...]',
          createdAt: userStartTime.toISOString(),
          messageType: 'user_message'
        }]
      } else if (callStatusCallCount === 2) {
        // Second poll: User placeholder updated, AI placeholder exists
        messages = [
          {
            _id: 'msg-user-1',
            id: 'msg-user-1',
            role: 'patient',
            content: 'Hello, how are you?', // Updated from placeholder
            createdAt: userStartTime.toISOString(), // CRITICAL: Preserved from when user started
            messageType: 'user_message'
          },
          {
            _id: 'msg-ai-1',
            id: 'msg-ai-1',
            role: 'assistant',
            content: '[Speaking...]',
            createdAt: aiStartTime.toISOString(),
            messageType: 'assistant_response'
          }
        ]
      } else {
        // Third poll and beyond: Both messages updated
        messages = [
          {
            _id: 'msg-user-1',
            id: 'msg-user-1',
            role: 'patient',
            content: 'Hello, how are you?',
            createdAt: userStartTime.toISOString(), // CRITICAL: Preserved timestamp
            messageType: 'user_message'
          },
          {
            _id: 'msg-ai-1',
            id: 'msg-ai-1',
            role: 'assistant',
            content: 'I am doing well, thank you for asking.',
            createdAt: aiStartTime.toISOString(), // CRITICAL: Preserved timestamp
            messageType: 'assistant_response'
          }
        ]
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            conversationId,
            status: 'in-progress',
            startTime: userStartTime.toISOString(),
            duration: 0,
            patient: {
              name: 'Test Patient',
              phone: '5551234567',
              id: 'test-patient-id'
            },
            agent: {
              name: 'Test Agent',
              id: 'test-agent-id'
            },
            messages: messages, // Messages sorted by createdAt (oldest first)
            aiSpeaking: {
              isSpeaking: callStatusCallCount < 3,
              userIsSpeaking: false,
              conversationState: 'conversation_active'
            }
          }
        })
      })
    })

    // WHEN: I initiate a call for a patient
    await page.waitForSelector('[aria-label*="edit-patient-button-"]', { timeout: 15000 })
    await page.locator('[aria-label*="edit-patient-button-"]').first().click()
    await page.waitForSelector('[data-testid="patient-screen"], [aria-label*="patient-screen"]', { timeout: 10000 })
    
    // Find and click the call button
    const callButton = page.locator('[data-testid="call-button"], [aria-label*="call-button"], [aria-label*="initiate-call"]')
    await callButton.waitFor({ state: 'visible', timeout: 10000 })
    await callButton.first().click()

    // Wait for call screen to appear
    await page.waitForSelector('[data-testid="call-screen"], [aria-label*="call-screen"]', { timeout: 10000 })
    
    // Wait for messages to appear (polling will happen automatically)
    await page.waitForTimeout(3000) // Give time for polling to complete

    // THEN: Messages should be displayed in chronological order
    // Wait for messages container to be visible
    const messagesContainer = page.locator('[data-testid="conversation-messages"]')
    await messagesContainer.waitFor({ state: 'visible', timeout: 10000 })
    
    // Wait for at least one message to appear
    await page.waitForSelector('[data-testid^="message-bubble-"]', { timeout: 10000 })
    
    // Poll until we have both messages (simulating real-time updates)
    let messageBubbles = page.locator('[data-testid^="message-bubble-"]')
    let messageCount = await messageBubbles.count()
    
    // Wait up to 10 seconds for both messages to appear
    let attempts = 0
    while (messageCount < 2 && attempts < 20) {
      await page.waitForTimeout(500)
      messageBubbles = page.locator('[data-testid^="message-bubble-"]')
      messageCount = await messageBubbles.count()
      attempts++
    }
    
    expect(messageCount).toBeGreaterThanOrEqual(2) // Both messages should be visible
    
    // Get all message texts and verify order
    const messages: Array<{ role: string; content: string; index: number; timestamp?: string }> = []
    for (let i = 0; i < messageCount; i++) {
      const bubble = messageBubbles.nth(i)
      const text = await bubble.textContent()
      
      // Determine role by checking message content or parent container alignment
      const isUserMessage = await bubble.evaluate((el) => {
        // Check parent container for right alignment (user messages)
        let parent = el.parentElement
        while (parent) {
          const style = window.getComputedStyle(parent)
          if (style.alignSelf === 'flex-end' || style.textAlign === 'right') {
            return true
          }
          parent = parent.parentElement
        }
        return false
      })
      
      // Also check content to determine role
      const content = text || ''
      const roleFromContent = content.includes('Hello') || content.includes('how are you') 
        ? 'patient' 
        : content.includes('doing well') || content.includes('thank you')
        ? 'assistant'
        : isUserMessage ? 'patient' : 'assistant'
      
      // Get timestamp if available
      const timeElement = page.locator(`[data-testid="message-time-${i}"]`)
      const timestamp = await timeElement.textContent().catch(() => null)
      
      messages.push({
        role: roleFromContent,
        content: content,
        index: i,
        timestamp: timestamp || undefined
      })
    }

    // CRITICAL VERIFICATION: User message should come before AI message
    const userMessage = messages.find(m => m.content.includes('Hello') || m.role === 'patient')
    const aiMessage = messages.find(m => m.content.includes('doing well') || m.role === 'assistant')
    
    expect(userMessage).toBeTruthy()
    expect(aiMessage).toBeTruthy()
    
    // User message should appear before AI message (user spoke first)
    expect(userMessage!.index).toBeLessThan(aiMessage!.index)
    
    // Verify content
    expect(userMessage!.content).toContain('Hello')
    expect(aiMessage!.content).toContain('doing well')
    
    console.log('✅ Message order verified:', {
      userMessage: { index: userMessage!.index, content: userMessage!.content },
      aiMessage: { index: aiMessage!.index, content: aiMessage!.content }
    })
  })

  test('should display messages in chronological order when AI speaks before user', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    
    // GIVEN: I am logged in
    await auth.givenIAmOnTheLoginScreen()
    await auth.whenIEnterCredentials(TEST_USERS.WITH_PATIENTS.email, TEST_USERS.WITH_PATIENTS.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()

    // Setup: AI speaks first, then user responds
    const aiStartTime = new Date('2024-01-01T10:00:00.000Z')
    const userStartTime = new Date('2024-01-01T10:00:05.000Z') // User starts 5 seconds after AI
    const conversationId = 'test-conversation-456'
    const callSid = 'test-call-sid-789'

    // Mock the initiate call endpoint
    await page.route('**/v1/calls/initiate', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId,
          callSid,
          patientId: 'test-patient-id',
          patientName: 'Test Patient',
          patientPhone: '5551234567',
          status: 'initiated'
        })
      })
    })

    // Mock the getCallStatus endpoint - AI message first, then user message
    let callStatusCallCount = 0
    await page.route(`**/v1/calls/${conversationId}/status`, async (route) => {
      callStatusCallCount++
      
      let messages: any[] = []
      
      if (callStatusCallCount === 1) {
        // First poll: AI placeholder exists
        messages = [{
          _id: 'msg-ai-1',
          id: 'msg-ai-1',
          role: 'assistant',
          content: '[Speaking...]',
          createdAt: aiStartTime.toISOString(),
          messageType: 'assistant_response'
        }]
      } else if (callStatusCallCount === 2) {
        // Second poll: AI updated, user placeholder exists
        messages = [
          {
            _id: 'msg-ai-1',
            id: 'msg-ai-1',
            role: 'assistant',
            content: 'How can I help you today?',
            createdAt: aiStartTime.toISOString(), // Preserved timestamp
            messageType: 'assistant_response'
          },
          {
            _id: 'msg-user-1',
            id: 'msg-user-1',
            role: 'patient',
            content: '[Speaking...]',
            createdAt: userStartTime.toISOString(),
            messageType: 'user_message'
          }
        ]
      } else {
        // Third poll and beyond: Both updated
        messages = [
          {
            _id: 'msg-ai-1',
            id: 'msg-ai-1',
            role: 'assistant',
            content: 'How can I help you today?',
            createdAt: aiStartTime.toISOString(), // Preserved timestamp
            messageType: 'assistant_response'
          },
          {
            _id: 'msg-user-1',
            id: 'msg-user-1',
            role: 'patient',
            content: 'I need help with something',
            createdAt: userStartTime.toISOString(), // Preserved timestamp
            messageType: 'user_message'
          }
        ]
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            conversationId,
            status: 'in-progress',
            startTime: aiStartTime.toISOString(),
            duration: 0,
            patient: {
              name: 'Test Patient',
              phone: '5551234567',
              id: 'test-patient-id'
            },
            agent: {
              name: 'Test Agent',
              id: 'test-agent-id'
            },
            messages: messages, // Messages sorted by createdAt (oldest first)
            aiSpeaking: {
              isSpeaking: false,
              userIsSpeaking: false,
              conversationState: 'conversation_active'
            }
          }
        })
      })
    })

    // WHEN: I initiate a call
    await page.waitForSelector('[aria-label*="edit-patient-button-"]', { timeout: 15000 })
    await page.locator('[aria-label*="edit-patient-button-"]').first().click()
    await page.waitForSelector('[data-testid="patient-screen"], [aria-label*="patient-screen"]', { timeout: 10000 })
    
    const callButton = page.locator('[data-testid="call-button"], [aria-label*="call-button"], [aria-label*="initiate-call"]')
    await callButton.waitFor({ state: 'visible', timeout: 10000 })
    await callButton.first().click()

    await page.waitForSelector('[data-testid="call-screen"], [aria-label*="call-screen"]', { timeout: 10000 })
    await page.waitForTimeout(3000) // Wait for polling

    // THEN: AI message should appear first, then user message
    const messagesContainer = page.locator('[data-testid="conversation-messages"]')
    await messagesContainer.waitFor({ state: 'visible', timeout: 10000 })
    
    await page.waitForSelector('[data-testid^="message-bubble-"]', { timeout: 10000 })
    
    // Poll until we have both messages
    let messageBubbles = page.locator('[data-testid^="message-bubble-"]')
    let messageCount = await messageBubbles.count()
    
    let attempts = 0
    while (messageCount < 2 && attempts < 20) {
      await page.waitForTimeout(500)
      messageBubbles = page.locator('[data-testid^="message-bubble-"]')
      messageCount = await messageBubbles.count()
      attempts++
    }
    
    expect(messageCount).toBeGreaterThanOrEqual(2)
    
    // Get all messages
    const messages: Array<{ role: string; content: string; index: number }> = []
    for (let i = 0; i < messageCount; i++) {
      const bubble = messageBubbles.nth(i)
      const text = await bubble.textContent()
      
      const isUserMessage = await bubble.evaluate((el) => {
        let parent = el.parentElement
        while (parent) {
          const style = window.getComputedStyle(parent)
          if (style.alignSelf === 'flex-end' || style.textAlign === 'right') {
            return true
          }
          parent = parent.parentElement
        }
        return false
      })
      
      const content = text || ''
      const roleFromContent = content.includes('need help') || content.includes('I need')
        ? 'patient'
        : content.includes('How can I help') || content.includes('help you today')
        ? 'assistant'
        : isUserMessage ? 'patient' : 'assistant'
      
      messages.push({
        role: roleFromContent,
        content: content,
        index: i
      })
    }

    // CRITICAL VERIFICATION: AI message should come before user message
    const aiMessage = messages.find(m => m.content.includes('How can I help') || m.role === 'assistant')
    const userMessage = messages.find(m => m.content.includes('need help') || m.role === 'patient')
    
    expect(aiMessage).toBeTruthy()
    expect(userMessage).toBeTruthy()
    
    // AI message should appear before user message (AI spoke first)
    expect(aiMessage!.index).toBeLessThan(userMessage!.index)
    
    // Verify content
    expect(aiMessage!.content).toContain('How can I help')
    expect(userMessage!.content).toContain('need help')
    
    console.log('✅ Message order verified:', {
      aiMessage: { index: aiMessage!.index, content: aiMessage!.content },
      userMessage: { index: userMessage!.index, content: userMessage!.content }
    })
  })
})

