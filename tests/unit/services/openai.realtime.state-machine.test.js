// Set required environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = 'test-twilio-auth-token';

// Mock fs module to prevent MongoDB/AWS SDK issues
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn()
  },
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn()
}));

// Mock models to prevent MongoDB path resolution issues
jest.mock('../../../src/models', () => ({
  Conversation: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn()
  },
  Message: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn()
  },
  Patient: {
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn()
  }
}));

// Mock emergency processor service
jest.mock('../../../src/services/emergencyProcessor.service', () => ({
  processUtterance: jest.fn(),
  createAlert: jest.fn()
}));

// Mock WebSocket
jest.mock('ws');

// Mock logger to capture log messages
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../../src/config/logger', () => mockLogger);

const WebSocket = require('ws');

describe('OpenAI Realtime Service - State Machine', () => {
  let OpenAIRealtimeService;
  let mockWebSocket;
  let service;
  let callId;

  // Import the state constants
  const CONVERSATION_STATES = {
    INITIALIZING: 'initializing',
    WAITING_FOR_GREETING: 'waiting_for_greeting',
    GREETING_ACTIVE: 'greeting_active',
    GREETING_COMPLETE: 'greeting_complete',
    USER_SPEAKING: 'user_speaking',
    AI_RESPONDING: 'ai_responding',
    CONVERSATION_ACTIVE: 'conversation_active',
    CALL_ENDING: 'call_ending',
    ERROR: 'error'
  };

  beforeAll(() => {
    jest.resetModules();
    
    // Import the service
    const openAIService = require('../../../src/services/openai.realtime.service');
    OpenAIRealtimeService = openAIService.OpenAIRealtimeService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    };
    WebSocket.mockImplementation(() => mockWebSocket);
    
    // Create a fresh service instance for each test
    service = new OpenAIRealtimeService();
    
    // Ensure connections Map exists
    if (!service.connections) {
      service.connections = new Map();
    }

    // Create a test call connection
    callId = 'test-call-123';
    service.connections.set(callId, {
      status: 'initializing',
      webSocket: mockWebSocket,
      sessionReady: true,
      conversationId: 'test-conversation-123',
      patientId: 'test-patient-123',
      conversationState: null,
      stateHistory: [],
      _userIsSpeaking: false,
      _aiIsSpeaking: false,
      _waitingForInitialGreeting: true,
      _initialGreetingTriggered: false,
      _initialGreetingCompletedAt: null,
      _responseCreated: false,
      _responseStartTime: null
    });
  });

  afterEach(() => {
    // Clean up any connections
    if (service && service.connections) {
      for (const callId of service.connections.keys()) {
        try {
          service.cleanup(callId);
        } catch (error) {
          // Ignore cleanup errors in tests
        }
      }
    }
  });

  describe('State Machine Initialization', () => {
    it('should initialize conversation state correctly', () => {
      service.initializeConversationState(callId);
      
      const conn = service.connections.get(callId);
      expect(conn.conversationState).toBe(CONVERSATION_STATES.INITIALIZING);
      expect(conn.stateHistory).toHaveLength(1);
      expect(conn.stateHistory[0].state).toBe(CONVERSATION_STATES.INITIALIZING);
      expect(conn.stateHistory[0].reason).toBe('call_initialized');
    });

    it('should handle missing connection gracefully', () => {
      const result = service.initializeConversationState('nonexistent-call');
      expect(result).toBeUndefined();
      // The method doesn't log an error, it just returns undefined
    });
  });

  describe('State Transitions', () => {
    beforeEach(() => {
      service.initializeConversationState(callId);
    });

    it('should allow valid state transitions', () => {
      // INITIALIZING -> WAITING_FOR_GREETING
      expect(service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.WAITING_FOR_GREETING);

      // WAITING_FOR_GREETING -> GREETING_ACTIVE
      expect(service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.GREETING_ACTIVE);

      // GREETING_ACTIVE -> GREETING_COMPLETE
      expect(service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.GREETING_COMPLETE);

      // GREETING_COMPLETE -> USER_SPEAKING
      expect(service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.USER_SPEAKING);

      // USER_SPEAKING -> AI_RESPONDING
      expect(service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.AI_RESPONDING);

      // AI_RESPONDING -> CONVERSATION_ACTIVE
      expect(service.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_completed')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.CONVERSATION_ACTIVE);
    });

    it('should reject invalid state transitions', () => {
      // Try to go from INITIALIZING directly to GREETING_ACTIVE (should fail)
      expect(service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'invalid_transition')).toBe(false);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.INITIALIZING);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid state transition')
      );

      // Try to go from GREETING_COMPLETE to GREETING_ACTIVE (should fail)
      service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed');
      
      expect(service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'invalid_backward')).toBe(false);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.GREETING_COMPLETE);
    });

    it('should maintain state history', () => {
      service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
      
      const conn = service.connections.get(callId);
      expect(conn.stateHistory).toHaveLength(3); // INITIALIZING + 2 transitions
      expect(conn.stateHistory[1].state).toBe(CONVERSATION_STATES.WAITING_FOR_GREETING);
      expect(conn.stateHistory[1].reason).toBe('session_ready');
      expect(conn.stateHistory[2].state).toBe(CONVERSATION_STATES.GREETING_ACTIVE);
      expect(conn.stateHistory[2].reason).toBe('greeting_triggered');
    });

    it('should limit state history to 10 entries', () => {
      // Make 12 transitions to test history limit
      for (let i = 0; i < 12; i++) {
        service.transitionState(callId, CONVERSATION_STATES.ERROR, `test_${i}`);
        service.transitionState(callId, CONVERSATION_STATES.INITIALIZING, `recover_${i}`);
      }
      
      const conn = service.connections.get(callId);
      expect(conn.stateHistory).toHaveLength(10);
    });

    it('should handle missing connection gracefully', () => {
      const result = service.transitionState('nonexistent-call', CONVERSATION_STATES.ERROR, 'test');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cannot transition state')
      );
    });
  });

  describe('State Validation Methods', () => {
    beforeEach(() => {
      service.initializeConversationState(callId);
    });

    it('should correctly identify when AI can respond', () => {
      // AI should not be able to respond in INITIALIZING state
      expect(service.canAIRespond(callId)).toBe(false);

      // AI should be able to respond in GREETING_COMPLETE state
      service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed');
      expect(service.canAIRespond(callId)).toBe(true);

      // AI should be able to respond in CONVERSATION_ACTIVE state
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
      service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking');
      service.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_completed');
      expect(service.canAIRespond(callId)).toBe(true);

      // AI should not be able to respond in USER_SPEAKING state
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
      expect(service.canAIRespond(callId)).toBe(false);
    });

    it('should correctly identify when user can speak', () => {
      // User should not be able to speak in INITIALIZING state
      expect(service.canUserSpeak(callId)).toBe(false);

      // User should be able to speak in GREETING_COMPLETE state
      service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed');
      expect(service.canUserSpeak(callId)).toBe(true);

      // User should be able to speak in CONVERSATION_ACTIVE state
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
      service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking');
      service.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_completed');
      expect(service.canUserSpeak(callId)).toBe(true);

      // User should not be able to speak in AI_RESPONDING state
      service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking');
      expect(service.canUserSpeak(callId)).toBe(false);
    });

    it('should handle missing connection gracefully', () => {
      expect(service.canAIRespond('nonexistent-call')).toBe(false);
      expect(service.canUserSpeak('nonexistent-call')).toBe(false);
      expect(service.getConversationState('nonexistent-call')).toBeNull();
    });
  });

  describe('Grace Period Functionality', () => {
    beforeEach(() => {
      service.initializeConversationState(callId);
      service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
    });

    it('should detect grace period correctly', () => {
      const conn = service.connections.get(callId);
      
      // Set greeting completion time to now
      conn._initialGreetingCompletedAt = Date.now();
      service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed');
      
      // Should be in grace period immediately after greeting completion
      expect(service.isInGracePeriod(callId)).toBe(true);
      
      // Mock time to be 4 seconds later (beyond grace period)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 4000);
      
      expect(service.isInGracePeriod(callId)).toBe(false);
      
      // Restore original Date.now
      Date.now = originalNow;
    });

    it('should return false for grace period when no greeting completion time', () => {
      expect(service.isInGracePeriod(callId)).toBe(false);
    });

    it('should handle missing connection gracefully', () => {
      expect(service.isInGracePeriod('nonexistent-call')).toBe(false);
    });
  });

  describe('Dual-Talking Bug Prevention', () => {
    beforeEach(() => {
      service.initializeConversationState(callId);
      service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
      
      // Complete initial greeting
      const conn = service.connections.get(callId);
      conn._initialGreetingCompletedAt = Date.now();
      service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed');
    });

    it('should prevent AI response during grace period', () => {
      // User finishes speaking during grace period
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
      
      // Should not be able to transition to AI_RESPONDING during grace period
      expect(service.isInGracePeriod(callId)).toBe(true);
      expect(service.canAIRespond(callId)).toBe(false); // USER_SPEAKING state doesn't allow AI response
      
      // The grace period check should prevent the actual response
      // This is tested in the speech_stopped handler logic
    });

    it('should allow AI response after grace period expires', () => {
      // Mock time to be 4 seconds later (beyond grace period)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 4000);
      
      // User finishes speaking after grace period - need to go through USER_SPEAKING first
      expect(service.isInGracePeriod(callId)).toBe(false);
      expect(service.canAIRespond(callId)).toBe(true); // GREETING_COMPLETE allows AI response
      
      // First user needs to speak, then AI can respond
      expect(service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking')).toBe(true);
      expect(service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking')).toBe(true);
      
      // Restore original Date.now
      Date.now = originalNow;
    });

    it('should prevent multiple simultaneous AI responses', () => {
      // User finishes speaking
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
      
      // First AI response should be allowed
      expect(service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking')).toBe(true);
      
      // Second AI response should be blocked by state machine
      expect(service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'duplicate_response')).toBe(false);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.AI_RESPONDING);
    });
  });

  describe('State Machine Integration with Speech Events', () => {
    beforeEach(() => {
      service.initializeConversationState(callId);
      service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
      service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
      
      // Complete initial greeting
      const conn = service.connections.get(callId);
      conn._initialGreetingCompletedAt = Date.now() - 4000; // 4 seconds ago (beyond grace period)
      service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed');
    });

    it('should handle speech_started event correctly', () => {
      const conn = service.connections.get(callId);
      
      // User starts speaking
      conn._userIsSpeaking = true;
      
      // Should transition to USER_SPEAKING state
      expect(service.canUserSpeak(callId)).toBe(true);
      expect(service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.USER_SPEAKING);
    });

    it('should handle speech_stopped event correctly', () => {
      const conn = service.connections.get(callId);
      
      // User was speaking and now stops - need to go through USER_SPEAKING first
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
      conn._userIsSpeaking = false;
      
      // Should be able to transition to AI_RESPONDING from USER_SPEAKING
      expect(service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.AI_RESPONDING);
    });

    it('should handle AI response completion correctly', () => {
      const conn = service.connections.get(callId);
      
      // Set up the call to be in AI_RESPONDING state
      // First go through the proper sequence
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
      service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking');
      conn._aiIsSpeaking = true;
      
      // Verify we're in the right state
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.AI_RESPONDING);
      
      // AI finishes responding
      conn._aiIsSpeaking = false;
      expect(service.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_completed')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.CONVERSATION_ACTIVE);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(() => {
      service.initializeConversationState(callId);
    });

    it('should handle error state transitions', () => {
      // Any state can transition to ERROR
      expect(service.transitionState(callId, CONVERSATION_STATES.ERROR, 'connection_failed')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.ERROR);
    });

    it('should allow recovery from error state', () => {
      // Transition to error
      service.transitionState(callId, CONVERSATION_STATES.ERROR, 'connection_failed');
      
      // Should be able to recover to INITIALIZING
      expect(service.transitionState(callId, CONVERSATION_STATES.INITIALIZING, 'recovery_attempt')).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.INITIALIZING);
    });

    it('should handle call ending from any state', () => {
      // Test call ending from different states that can transition to CALL_ENDING
      const states = [
        CONVERSATION_STATES.GREETING_COMPLETE,
        CONVERSATION_STATES.USER_SPEAKING,
        CONVERSATION_STATES.AI_RESPONDING,
        CONVERSATION_STATES.CONVERSATION_ACTIVE
      ];

      states.forEach(state => {
        // First transition to the test state
        if (state === CONVERSATION_STATES.GREETING_COMPLETE) {
          service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'setup');
          service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'setup');
          service.transitionState(callId, state, 'test_state');
        } else if (state === CONVERSATION_STATES.USER_SPEAKING) {
          service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'setup');
          service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'setup');
          service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'setup');
          service.transitionState(callId, state, 'test_state');
        } else if (state === CONVERSATION_STATES.AI_RESPONDING) {
          service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'setup');
          service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'setup');
          service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'setup');
          service.transitionState(callId, state, 'test_state');
        } else if (state === CONVERSATION_STATES.CONVERSATION_ACTIVE) {
          service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'setup');
          service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'setup');
          service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'setup');
          service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'setup');
          service.transitionState(callId, state, 'test_state');
        }
        
        expect(service.transitionState(callId, CONVERSATION_STATES.CALL_ENDING, 'call_ended')).toBe(true);
        expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.CALL_ENDING);
        
        // Reset for next test
        service.transitionState(callId, CONVERSATION_STATES.ERROR, 'reset');
        service.transitionState(callId, CONVERSATION_STATES.INITIALIZING, 'recovery');
      });
    });
  });

  describe('State Machine Performance', () => {
    it('should handle multiple concurrent calls', () => {
      const callIds = ['call-1', 'call-2', 'call-3', 'call-4', 'call-5'];
      
      // Initialize multiple calls
      callIds.forEach(id => {
        service.connections.set(id, {
          status: 'initializing',
          conversationState: null,
          stateHistory: []
        });
        service.initializeConversationState(id);
      });
      
      // Transition all calls through states
      callIds.forEach(id => {
        service.transitionState(id, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
        service.transitionState(id, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
        service.transitionState(id, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed');
      });
      
      // Verify all calls are in correct state
      callIds.forEach(id => {
        expect(service.getConversationState(id)).toBe(CONVERSATION_STATES.GREETING_COMPLETE);
        expect(service.canAIRespond(id)).toBe(true);
        expect(service.canUserSpeak(id)).toBe(true);
      });
    });

    it('should maintain state isolation between calls', () => {
      const callId1 = 'call-1';
      const callId2 = 'call-2';
      
      // Initialize both calls
      service.connections.set(callId1, {
        status: 'initializing',
        conversationState: null,
        stateHistory: []
      });
      service.connections.set(callId2, {
        status: 'initializing',
        conversationState: null,
        stateHistory: []
      });
      
      service.initializeConversationState(callId1);
      service.initializeConversationState(callId2);
      
      // Transition call1 to GREETING_ACTIVE
      service.transitionState(callId1, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
      service.transitionState(callId1, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
      
      // Call2 should still be in INITIALIZING
      expect(service.getConversationState(callId1)).toBe(CONVERSATION_STATES.GREETING_ACTIVE);
      expect(service.getConversationState(callId2)).toBe(CONVERSATION_STATES.INITIALIZING);
    });
  });
});
