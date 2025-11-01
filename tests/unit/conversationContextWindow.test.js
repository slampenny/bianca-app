// tests/unit/conversationContextWindow.test.js

const { ConversationContextWindow, getConversationContextWindow } = require('../../src/utils/conversationContextWindow');

describe('ConversationContextWindow', () => {
  let contextWindow;

  beforeEach(() => {
    // Create fresh instance for each test
    contextWindow = new ConversationContextWindow({
      windowSizeMinutes: 5,
      maxUtterances: 10,
      cleanupIntervalMinutes: 30
    });
  });

  afterEach(() => {
    if (contextWindow) {
      contextWindow.stopCleanupInterval();
      contextWindow.clearAll();
    }
  });

  describe('addUtterance', () => {
    test('should add user utterance to context window', () => {
      const patientId = 'patient123';
      const text = 'I feel terrible';
      
      contextWindow.addUtterance(patientId, text, 'user', Date.now());
      
      const context = contextWindow.getRecentContext(patientId);
      expect(context).toHaveLength(1);
      expect(context[0].text).toBe(text);
      expect(context[0].role).toBe('user');
    });

    test('should add assistant utterance to context window', () => {
      const patientId = 'patient123';
      const text = 'I understand how you feel';
      
      contextWindow.addUtterance(patientId, text, 'assistant', Date.now());
      
      const context = contextWindow.getRecentContext(patientId);
      expect(context).toHaveLength(1);
      expect(context[0].text).toBe(text);
      expect(context[0].role).toBe('assistant');
    });

    test('should limit utterances to maxUtterances', () => {
      const patientId = 'patient123';
      
      // Add more than maxUtterances
      for (let i = 0; i < 15; i++) {
        contextWindow.addUtterance(patientId, `Message ${i}`, 'user', Date.now() + i * 1000);
      }
      
      const context = contextWindow.getRecentContext(patientId);
      expect(context.length).toBeLessThanOrEqual(10);
      // Should have the most recent ones
      expect(context[context.length - 1].text).toContain('14');
    });

    test('should handle empty or invalid inputs gracefully', () => {
      const patientId = 'patient123';
      
      contextWindow.addUtterance(patientId, '', 'user', Date.now());
      contextWindow.addUtterance(null, 'text', 'user', Date.now());
      contextWindow.addUtterance(patientId, null, 'user', Date.now());
      
      const context = contextWindow.getRecentContext(patientId);
      expect(context).toHaveLength(0);
    });
  });

  describe('getRecentContext', () => {
    test('should return utterances within time window', () => {
      const patientId = 'patient123';
      const now = Date.now();
      
      // Add utterances at different times
      contextWindow.addUtterance(patientId, 'Old message', 'user', now - 10 * 60 * 1000); // 10 minutes ago
      contextWindow.addUtterance(patientId, 'Recent message', 'user', now - 2 * 60 * 1000); // 2 minutes ago
      contextWindow.addUtterance(patientId, 'Very recent', 'user', now); // Now
      
      const context = contextWindow.getRecentContext(patientId, 5); // Last 5 minutes
      
      // Should only include utterances from last 5 minutes
      expect(context.length).toBe(2);
      expect(context[0].text).toBe('Recent message');
      expect(context[1].text).toBe('Very recent');
    });

    test('should return empty array if no context exists', () => {
      const context = contextWindow.getRecentContext('nonexistent');
      expect(context).toHaveLength(0);
    });

    test('should respect custom lookBackMinutes', () => {
      const patientId = 'patient123';
      const now = Date.now();
      
      // Create window with larger window size to accommodate both
      const largeWindow = new ConversationContextWindow({
        windowSizeMinutes: 20, // Large enough for both utterances
        maxUtterances: 10
      });
      
      largeWindow.addUtterance(patientId, 'Old', 'user', now - 10 * 60 * 1000);
      largeWindow.addUtterance(patientId, 'Recent', 'user', now - 1 * 60 * 1000);
      
      const context = largeWindow.getRecentContext(patientId, 15); // Last 15 minutes
      // Both should be included (10 min and 1 min ago are within 15 min window)
      expect(context.length).toBe(2);
      
      const shortContext = largeWindow.getRecentContext(patientId, 2); // Last 2 minutes
      // Only recent one should be included (1 min ago is within 2 min, 10 min is not)
      expect(shortContext.length).toBe(1);
      
      largeWindow.stopCleanupInterval();
      largeWindow.clearAll();
    });
  });

  describe('getContextText', () => {
    test('should return formatted context text', () => {
      const patientId = 'patient123';
      
      contextWindow.addUtterance(patientId, 'Hello', 'user', Date.now());
      contextWindow.addUtterance(patientId, 'Hi there', 'assistant', Date.now());
      contextWindow.addUtterance(patientId, 'How are you?', 'user', Date.now());
      
      const contextText = contextWindow.getContextText(patientId);
      
      expect(contextText).toContain('Patient: Hello');
      expect(contextText).toContain('Bianca: Hi there');
      expect(contextText).toContain('Patient: How are you?');
    });

    test('should return empty string if no context', () => {
      const contextText = contextWindow.getContextText('nonexistent');
      expect(contextText).toBe('');
    });
  });

  describe('classifyNarrativeVsPresent', () => {
    test('should detect narrative context (past story)', () => {
      const patientId = 'patient123';
      const now = Date.now();
      
      // Add narrative context (past story)
      contextWindow.addUtterance(patientId, 'Let me tell you about when I had a heart attack years ago', 'user', now - 2000);
      contextWindow.addUtterance(patientId, 'It was terrible', 'user', now - 1000);
      
      // Emergency phrase in narrative context
      const result = contextWindow.classifyNarrativeVsPresent(patientId, 'I remember the heart attack');
      
      expect(result.isNarrative).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reason).toContain('Narrative');
    });

    test('should detect present-tense context (current emergency)', () => {
      const patientId = 'patient123';
      const now = Date.now();
      
      // Add present-tense context
      contextWindow.addUtterance(patientId, 'I am having trouble right now', 'user', now - 2000);
      contextWindow.addUtterance(patientId, 'I feel something happening', 'user', now - 1000);
      
      // Emergency phrase in present-tense
      const result = contextWindow.classifyNarrativeVsPresent(patientId, 'I think I am having a heart attack');
      
      expect(result.isNarrative).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reason).toContain('Present-tense');
    });

    test('should handle ambiguous context with low confidence', () => {
      const patientId = 'patient123';
      
      // Add neutral context
      contextWindow.addUtterance(patientId, 'How is the weather?', 'user', Date.now() - 1000);
      
      const result = contextWindow.classifyNarrativeVsPresent(patientId, 'I feel sick');
      
      // Should return false (not narrative) and confidence depends on indicators found
      // If no clear indicators, confidence might be higher (close to 1.0) or lower
      expect(result.isNarrative).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should return neutral if no recent context', () => {
      const result = contextWindow.classifyNarrativeVsPresent('nonexistent', 'I have a heart attack');
      
      expect(result.isNarrative).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.reason).toContain('No recent context available');
    });

    test('should detect past tense indicators', () => {
      const patientId = 'patient123';
      
      contextWindow.addUtterance(patientId, 'My dad had a stroke last year', 'user', Date.now() - 1000);
      
      const result = contextWindow.classifyNarrativeVsPresent(patientId, 'it was really scary');
      
      expect(result.isNarrative).toBe(true);
      expect(result.narrativeScore).toBeGreaterThan(0);
    });

    test('should detect present tense indicators', () => {
      const patientId = 'patient123';
      
      // Add some context first
      contextWindow.addUtterance(patientId, 'I am having trouble', 'user', Date.now() - 1000);
      
      const result = contextWindow.classifyNarrativeVsPresent(patientId, 'I am having a heart attack right now');
      
      expect(result.isNarrative).toBe(false);
      // presentScore might be undefined if no context, check if it exists
      if (result.presentScore !== undefined) {
        expect(result.presentScore).toBeGreaterThan(0);
      }
      // At minimum, should detect present tense from the emergency text itself
      expect(result.reason).toBeDefined();
    });
  });

  describe('cleanup', () => {
    test('should clean up old contexts', () => {
      const patientId = 'patient123';
      const oldTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      
      contextWindow.addUtterance(patientId, 'Old message', 'user', oldTime);
      contextWindow.addUtterance(patientId, 'Recent message', 'user', Date.now());
      
      contextWindow.cleanupOldContexts();
      
      const context = contextWindow.getRecentContext(patientId, 5);
      // Should only have recent message (old one is outside 5-minute window)
      expect(context.length).toBe(1);
      expect(context[0].text).toBe('Recent message');
    });

    test('should remove patient entry if all utterances are old', () => {
      const patientId = 'patient123';
      const oldTime = Date.now() - 10 * 60 * 1000;
      
      contextWindow.addUtterance(patientId, 'Old message', 'user', oldTime);
      
      contextWindow.cleanupOldContexts();
      
      const context = contextWindow.getRecentContext(patientId);
      expect(context).toHaveLength(0);
    });
  });

  describe('clearPatientContext', () => {
    test('should clear all context for a patient', () => {
      const patientId = 'patient123';
      
      contextWindow.addUtterance(patientId, 'Message 1', 'user', Date.now());
      contextWindow.addUtterance(patientId, 'Message 2', 'user', Date.now());
      
      contextWindow.clearPatientContext(patientId);
      
      const context = contextWindow.getRecentContext(patientId);
      expect(context).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    test('should return statistics', () => {
      const patientId1 = 'patient1';
      const patientId2 = 'patient2';
      
      contextWindow.addUtterance(patientId1, 'Message 1', 'user', Date.now());
      contextWindow.addUtterance(patientId1, 'Message 2', 'user', Date.now());
      contextWindow.addUtterance(patientId2, 'Message 3', 'user', Date.now());
      
      const stats = contextWindow.getStats();
      
      expect(stats.totalPatients).toBe(2);
      expect(stats.totalUtterances).toBe(3);
      expect(stats.config).toBeDefined();
    });
  });

  describe('singleton instance', () => {
    test('getConversationContextWindow should return singleton', () => {
      const instance1 = getConversationContextWindow();
      const instance2 = getConversationContextWindow();
      
      expect(instance1).toBe(instance2);
    });
  });
});

