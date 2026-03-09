// tests/unit/enhancedEmergencyProcessor.test.js

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { EmergencyProcessor } = require('../../src/services/emergencyProcessor.service');
const { getConversationContextWindow } = require('../../src/utils/conversationContextWindow');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Enhanced Emergency Processor with Context Awareness', () => {
  let processor;
  let mockClient;
  const { Client, Org, EmergencyPhrase } = require('../../src/models');

  beforeEach(async () => {
    // Clear context window
    const contextWindow = getConversationContextWindow();
    contextWindow.clearAll();

    processor = new EmergencyProcessor();
    
    // Clear existing documents
    await Client.deleteMany({});
    await Org.deleteMany({});
    await EmergencyPhrase.deleteMany({});
    
    // Create test emergency phrases
    const testUserId = new mongoose.Types.ObjectId();
    await EmergencyPhrase.create([
      {
        phrase: "heart attack",
        language: "en",
        category: "Medical",
        severity: "CRITICAL",
        description: "Cardiac emergency",
        pattern: "\\b(heart\\s+attack|heartattack)\\b",
        caseSensitive: false,
        createdBy: testUserId,
        lastModifiedBy: testUserId
      }
    ]);
    
    // Force reload of emergency phrases
    const { localizedEmergencyDetector } = require('../../src/services/localizedEmergencyDetector.service');
    await localizedEmergencyDetector.loadPhrases();
    
    // Create test patient
    const testOrg = await Org.create({
      name: 'Test Org',
      email: 'testorg@example.com',
      country: 'US',
    });
    
    mockClient = await Client.create({
      name: 'Test Client',
      email: 'test@example.com',
      phone: '1234567890',
      preferredLanguage: 'en',
      org: testOrg._id
    });
  });

  afterEach(async () => {
    // Clear context window after each test
    const contextWindow = getConversationContextWindow();
    contextWindow.clearAll();
  });

  describe('Context-aware false positive filtering', () => {
    test('should filter narrative context (past story) as false positive', async () => {
      const contextWindow = getConversationContextWindow();
      const clientId = mockClient._id.toString();
      
      // Add narrative context (past story)
      contextWindow.addUtterance(clientId, 'Let me tell you about my father', 'user', Date.now() - 5000);
      contextWindow.addUtterance(clientId, 'He had a heart attack years ago', 'user', Date.now() - 3000);
      
      // Emergency phrase in narrative context
      const result = await processor.processUtterance(
        clientId,
        'I remember the heart attack he had'
      );
      
      // Should be detected as emergency but filtered as false positive
      expect(result.processing.emergencyDetected).toBe(true);
      expect(result.processing.falsePositive).toBe(true);
      expect(result.reason).toContain('Narrative context');
    });

    test('should allow present-tense emergency (current situation)', async () => {
      const contextWindow = getConversationContextWindow();
      const clientId = mockClient._id.toString();
      
      // Add present-tense context
      contextWindow.addUtterance(clientId, 'I am having trouble breathing', 'user', Date.now() - 5000);
      contextWindow.addUtterance(clientId, 'I feel something happening right now', 'user', Date.now() - 3000);
      
      // Emergency phrase in present-tense
      const result = await processor.processUtterance(
        clientId,
        'I think I am having a heart attack'
      );
      
      // Should be detected and NOT filtered as false positive
      expect(result.processing.emergencyDetected).toBe(true);
      expect(result.processing.falsePositive).toBe(false);
      expect(result.shouldAlert).toBe(true);
    });

    test('should track utterances in context window', async () => {
      const contextWindow = getConversationContextWindow();
      const clientId = mockClient._id.toString();
      
      const initialContext = contextWindow.getRecentContext(clientId);
      expect(initialContext.length).toBe(0);
      
      // Process utterance (should add to context window)
      await processor.processUtterance(clientId, 'I feel terrible', Date.now());
      
      const afterContext = contextWindow.getRecentContext(clientId);
      expect(afterContext.length).toBe(1);
      expect(afterContext[0].text).toBe('I feel terrible');
      expect(afterContext[0].role).toBe('user');
    });

    test('should handle emergency with no recent context', async () => {
      const clientId = mockClient._id.toString();
      
      // Process emergency without context
      const result = await processor.processUtterance(
        clientId,
        'I am having a heart attack'
      );
      
      // Should still detect emergency (no narrative context to filter)
      expect(result.processing.emergencyDetected).toBe(true);
      expect(result.processing.falsePositive).toBe(false);
    });

    test('should distinguish between similar phrases in different contexts', async () => {
      const contextWindow = getConversationContextWindow();
      const clientId = mockClient._id.toString();
      
      // First: narrative context (should be filtered)
      contextWindow.addUtterance(clientId, 'Back when I was younger', 'user', Date.now() - 5000);
      contextWindow.addUtterance(clientId, 'I had a heart attack once', 'user', Date.now() - 3000);
      
      const narrativeResult = await processor.processUtterance(
        clientId,
        'It was really scary, that heart attack'
      );
      
      expect(narrativeResult.processing.falsePositive).toBe(true);
      
      // Clear context
      contextWindow.clearClientContext(clientId);
      
      // Second: present-tense (should NOT be filtered)
      contextWindow.addUtterance(clientId, 'I am having trouble', 'user', Date.now() - 5000);
      
      const presentResult = await processor.processUtterance(
        clientId,
        'I think I am having a heart attack right now'
      );
      
      expect(presentResult.processing.falsePositive).toBe(false);
      expect(presentResult.shouldAlert).toBe(true);
    });
  });

  describe('Context window integration', () => {
    test('should maintain sliding window of utterances', async () => {
      const contextWindow = getConversationContextWindow();
      const clientId = mockClient._id.toString();
      
      // Add multiple utterances
      await processor.processUtterance(clientId, 'First message', Date.now() - 10000);
      await processor.processUtterance(clientId, 'Second message', Date.now() - 5000);
      await processor.processUtterance(clientId, 'Third message', Date.now());
      
      const context = contextWindow.getRecentContext(clientId, 10); // Last 10 minutes
      expect(context.length).toBe(3);
    });

    test('should use context window in deduplication', async () => {
      const contextWindow = getConversationContextWindow();
      const clientId = mockClient._id.toString();
      
      // First emergency
      const result1 = await processor.processUtterance(
        clientId,
        'I am having a heart attack'
      );
      
      expect(result1.shouldAlert).toBe(true);
      
      // Second similar emergency within deduplication window
      const result2 = await processor.processUtterance(
        clientId,
        'I think I am having a heart attack'
      );
      
      // Should be deduplicated
      expect(result2.shouldAlert).toBe(false);
      expect(result2.reason).toContain('Recent');
    });
  });

  describe('Error handling', () => {
    test('should handle errors in context window gracefully', async () => {
      const clientId = mockClient._id.toString();
      
      // Process with invalid patient ID (should not crash)
      const result = await processor.processUtterance(
        'invalid-id',
        'I am having a heart attack'
      );
      
      // Should still process (falls back to no context)
      expect(result).toBeDefined();
    });
  });
});





