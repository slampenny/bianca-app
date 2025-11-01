// src/utils/conversationContextWindow.js

/**
 * Conversation Context Window
 * Tracks recent utterances for context-aware emergency detection
 * Helps distinguish between narrative (past story) vs present-tense (current emergency)
 */

class ConversationContextWindow {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      windowSizeMinutes: config.windowSizeMinutes || 5, // Look back 5 minutes
      maxUtterances: config.maxUtterances || 10, // Keep max 10 recent utterances
      cleanupIntervalMinutes: config.cleanupIntervalMinutes || 30,
      ...config
    };

    // In-memory storage: { patientId: [{ text, timestamp, role }] }
    this.contextWindows = new Map();
    
    // Cleanup interval
    this.cleanupIntervalId = null;
    this.startCleanupInterval();
  }

  /**
   * Add an utterance to the context window
   * Thread-safe: Ensures atomic read-modify-write operations for concurrent calls
   * @param {string} patientId - Patient ID
   * @param {string} text - Utterance text
   * @param {string} role - 'user' or 'assistant'
   * @param {number} timestamp - Timestamp (defaults to now)
   */
  addUtterance(patientId, text, role = 'user', timestamp = Date.now()) {
    try {
      if (!patientId || !text || !text.trim()) return;

      // Atomic operation: Get current context or create new array
      // Using get-or-create pattern to avoid race conditions
      let context = this.contextWindows.get(patientId);
      if (!context) {
        // Create new array atomically - if another thread sets it between get and set,
        // we'll use the existing one on next iteration
        const newContext = [];
        this.contextWindows.set(patientId, newContext);
        context = this.contextWindows.get(patientId); // Get actual value (may be our new one or one set by concurrent call)
      }

      // Create a copy of the current context to modify atomically
      // This prevents lost updates when multiple concurrent calls modify the same patient's context
      const updatedContext = [...context];
      
      // Add new utterance
      updatedContext.push({
        text: text.trim(),
        role,
        timestamp
      });

      // Limit to max utterances (keep most recent)
      if (updatedContext.length > this.config.maxUtterances) {
        updatedContext.shift(); // Remove oldest
      }

      // Remove utterances outside window
      const cutoffTime = timestamp - (this.config.windowSizeMinutes * 60 * 1000);
      const filteredContext = updatedContext.filter(utterance => utterance.timestamp >= cutoffTime);

      // Atomic write: Replace entire array atomically
      // If another call modified it concurrently, we'll overwrite, but that's acceptable
      // since each call operates on a snapshot of the data at read time
      if (filteredContext.length === 0) {
        this.contextWindows.delete(patientId);
      } else {
        this.contextWindows.set(patientId, filteredContext);
      }
    } catch (error) {
      console.error('Error adding utterance to context window:', error);
    }
  }

  /**
   * Get recent context for a patient (utterances within time window)
   * Thread-safe: Returns a copy of the context to prevent external mutations
   * @param {string} patientId - Patient ID
   * @param {number} lookBackMinutes - How many minutes back to look (defaults to config)
   * @returns {Array} - Array of { text, role, timestamp } (copy, safe for concurrent access)
   */
  getRecentContext(patientId, lookBackMinutes = null) {
    try {
      // Atomic read: Get current snapshot of context
      const context = this.contextWindows.get(patientId);
      if (!context || context.length === 0) return [];

      // Create a defensive copy to prevent external mutations affecting internal state
      // This ensures thread-safe access even if caller modifies the returned array
      const contextCopy = [...context];

      const windowMs = (lookBackMinutes || this.config.windowSizeMinutes) * 60 * 1000;
      const cutoffTime = Date.now() - windowMs;

      // Filter and return copy (don't mutate original)
      return contextCopy.filter(utterance => utterance.timestamp >= cutoffTime);
    } catch (error) {
      console.error('Error getting recent context:', error);
      return [];
    }
  }

  /**
   * Get full conversation context as a single string
   * @param {string} patientId - Patient ID
   * @param {number} lookBackMinutes - How many minutes back to look
   * @returns {string} - Combined context text
   */
  getContextText(patientId, lookBackMinutes = null) {
    const recentContext = this.getRecentContext(patientId, lookBackMinutes);
    if (recentContext.length === 0) return '';

    return recentContext
      .map(u => `${u.role === 'user' ? 'Patient' : 'Bianca'}: ${u.text}`)
      .join('\n');
  }

  /**
   * Remove utterances outside the time window for a patient
   * Thread-safe: Atomic read-modify-write operation
   * @private
   */
  trimToWindow(patientId) {
    try {
      // Atomic read
      const context = this.contextWindows.get(patientId);
      if (!context) return;

      const cutoffTime = Date.now() - (this.config.windowSizeMinutes * 60 * 1000);

      // Create filtered copy (don't mutate original array directly)
      const filtered = context.filter(utterance => utterance.timestamp >= cutoffTime);

      // Atomic write: Replace entire array atomically
      if (filtered.length === 0) {
        this.contextWindows.delete(patientId);
      } else {
        this.contextWindows.set(patientId, filtered);
      }
    } catch (error) {
      console.error('Error trimming context window:', error);
    }
  }

  /**
   * Check if emergency phrase is in narrative context (story about the past)
   * @param {string} patientId - Patient ID
   * @param {string} emergencyText - The text that triggered emergency detection
   * @returns {Object} - { isNarrative: boolean, confidence: number, reason: string }
   */
  classifyNarrativeVsPresent(patientId, emergencyText) {
    try {
      const recentContext = this.getRecentContext(patientId, 3); // Last 3 minutes
      
      if (recentContext.length === 0) {
        return {
          isNarrative: false,
          confidence: 0.5,
          reason: 'No recent context available'
        };
      }

      // Combine recent context
      const contextText = recentContext
        .map(u => u.text)
        .join(' ')
        .toLowerCase();

      const emergencyLower = emergencyText.toLowerCase();

      // Indicators of narrative (past story):
      // - Past tense words before emergency phrase
      // - Time references (yesterday, last year, years ago, when I was)
      // - Story-telling phrases (let me tell you, I remember, back when)
      
      const narrativeIndicators = [
        /(yesterday|last (week|month|year)|years? ago|when i was|used to|had|was having)/i,
        /(let me tell you|i remember|back when|this one time|once)/i,
        /(my (dad|mom|friend|neighbor)|someone else|they)/i, // Third person
        /(i (had|was|used to|would))/i // Past tense
      ];

      // Indicators of present-tense (current emergency):
      // - Present tense words (am, is, having, feeling)
      // - Immediate urgency (right now, currently, happening)
      // - First person present (I am, I'm having, I feel)
      
      const presentTenseIndicators = [
        /(right now|currently|happening|as we speak|at this moment)/i,
        /(i (am|'m|feel|feel like|think i'm|think i have))/i,
        /(i'm (having|feeling|experiencing))/i,
        /(help|emergency|please|call|need (help|to|assistance))/i
      ];

      // Check context for narrative indicators
      let narrativeScore = 0;
      let presentScore = 0;

      for (const indicator of narrativeIndicators) {
        if (indicator.test(contextText)) {
          narrativeScore += 1;
        }
      }

      for (const indicator of presentTenseIndicators) {
        if (indicator.test(emergencyText)) {
          presentScore += 1;
        }
      }

      // Calculate confidence based on score difference
      const totalScore = narrativeScore + presentScore;
      if (totalScore === 0) {
        return {
          isNarrative: false,
          confidence: 0.5,
          reason: 'No clear narrative or present-tense indicators found'
        };
      }

      const narrativeRatio = narrativeScore / totalScore;
      const isNarrative = narrativeRatio > 0.5;
      const confidence = Math.abs(narrativeRatio - 0.5) * 2; // Scale to 0-1

      const classification = {
        isNarrative,
        confidence,
        reason: isNarrative 
          ? `Narrative context detected (${narrativeScore} indicators vs ${presentScore} present)` 
          : `Present-tense context detected (${presentScore} indicators vs ${narrativeScore} narrative)`
      };
      
      // Only include scores if they exist and are meaningful
      if (totalScore > 0) {
        classification.narrativeScore = narrativeScore;
        classification.presentScore = presentScore;
      }
      
      return classification;
    } catch (error) {
      console.error('Error classifying narrative vs present:', error);
      return {
        isNarrative: false,
        confidence: 0.5,
        reason: `Error in classification: ${error.message}`
      };
    }
  }

  /**
   * Start cleanup interval
   * @private
   */
  startCleanupInterval() {
    const cleanupIntervalMs = this.config.cleanupIntervalMinutes * 60 * 1000;
    
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupOldContexts();
    }, cleanupIntervalMs);
  }

  /**
   * Clean up old contexts outside the time window
   * Thread-safe: Uses snapshot of entries to avoid iteration issues during concurrent modifications
   * @private
   */
  cleanupOldContexts() {
    try {
      const cutoffTime = Date.now() - (this.config.windowSizeMinutes * 60 * 1000);
      
      // Create snapshot of entries to iterate over (prevents issues if Map is modified during iteration)
      const entries = Array.from(this.contextWindows.entries());
      
      for (const [patientId, context] of entries) {
        // Atomic read-modify-write per patient
        // Create filtered copy (don't mutate original array)
        const filtered = context.filter(utterance => utterance.timestamp >= cutoffTime);
        
        // Atomic write
        if (filtered.length === 0) {
          this.contextWindows.delete(patientId);
        } else {
          this.contextWindows.set(patientId, filtered);
        }
      }
    } catch (error) {
      console.error('Error cleaning up contexts:', error);
    }
  }

  /**
   * Stop cleanup interval (useful for testing)
   */
  stopCleanupInterval() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Clear all context for a patient
   */
  clearPatientContext(patientId) {
    this.contextWindows.delete(patientId);
  }

  /**
   * Clear all contexts
   */
  clearAll() {
    this.contextWindows.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalPatients: this.contextWindows.size,
      totalUtterances: Array.from(this.contextWindows.values())
        .reduce((sum, context) => sum + context.length, 0),
      config: this.config
    };
  }
}

// Lazy singleton instance
let contextWindowInstance = null;

function getConversationContextWindow() {
  if (!contextWindowInstance) {
    contextWindowInstance = new ConversationContextWindow();
  }
  return contextWindowInstance;
}

module.exports = {
  ConversationContextWindow,
  getConversationContextWindow
};

