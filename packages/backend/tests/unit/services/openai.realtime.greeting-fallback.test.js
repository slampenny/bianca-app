// Set required environment variables for tests (before any app code loads)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = 'test-twilio-auth-token';
process.env.GREETING_FALLBACK_MS = '5000';
process.env.GREETING_MAX_REARMS = '2';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
  },
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 0 }),
}));

jest.mock('../../../src/models', () => {
  const makeFindByIdChain = (leanResult = null) => {
    const chain = {};
    chain.populate = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.lean = jest.fn().mockResolvedValue(leanResult);
    return chain;
  };
  return {
    Conversation: {
      findById: jest.fn().mockImplementation(() => makeFindByIdChain()),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    },
    Message: {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    },
    Client: {
      findById: jest.fn().mockImplementation(() =>
        makeFindByIdChain({ org: '507f1f77bcf86cd799439011', preferredName: 'Jordan', name: 'Jordan L' })
      ),
      find: jest.fn(),
      findOne: jest.fn(),
    },
    Org: {
      findById: jest.fn().mockImplementation(() => makeFindByIdChain({ debugAudioUploadEnabled: false })),
      find: jest.fn(),
      findOne: jest.fn(),
    },
    Call: {
      findById: jest.fn().mockImplementation(() => makeFindByIdChain()),
      findOne: jest.fn(),
      create: jest.fn(),
    },
  };
});

jest.mock('../../../src/services/emergencyProcessor.service', () => ({
  processUtterance: jest.fn(),
  createAlert: jest.fn(),
}));

jest.mock('../../../src/services/rtp.sender.service', () => ({
  clearBuffer: jest.fn(),
  isPlaybackComplete: jest.fn().mockReturnValue(true),
}));

jest.mock('ws');

const WebSocket = require('ws');
const CONSTANTS = require('../../../src/services/ai/realtime/constants');
const { CONVERSATION_STATES } = require('../../../src/services/ai/realtime/state.machine');

describe('OpenAI Realtime — silence-fallback greeting', () => {
  let OpenAIRealtimeService;
  let service;
  let mockWebSocket;
  const callId = 'greeting-fallback-call';

  function seedConnection(overrides = {}) {
    service.connections.set(callId, {
      status: 'connected',
      sessionReady: true,
      webSocket: mockWebSocket,
      conversationState: CONVERSATION_STATES.INITIALIZING,
      stateHistory: [{ state: CONVERSATION_STATES.INITIALIZING, timestamp: Date.now(), reason: 'test' }],
      residentName: 'Jordan',
      conversationId: 'conv-1',
      _waitingForInitialGreeting: true,
      _initialGreetingTriggered: false,
      _greetingFallbackCancelled: false,
      _greetingFallbackTimer: null,
      _greetingSpeechConfirmTimer: null,
      _greetingSpeechHadCommit: false,
      _greetingSpeechHadTranscript: false,
      _greetingRearmCount: 0,
      _userInputToOpenAIAllowed: false,
      _userIsSpeaking: false,
      _responseCreateInFlight: false,
      _responseCreated: false,
      _aiIsSpeaking: false,
      _aiAudioPlaybackComplete: true,
      _aiOutputAudioDeltaSeen: false,
      _aiAudioComplete: false,
      _turnSpeechDurationMs: 0,
      _currentAssistantItemId: null,
      _lastAiSpeechStart: null,
      pendingUserTranscript: '',
      pendingAssistantTranscript: '',
      activeUserMessageId: null,
      _responseStuckRecoveryTimeout: null,
      _responseStuckRecoveryInnerTimeout: null,
      _responseAggressiveInterval: null,
      ...overrides,
    });
  }

  beforeAll(() => {
    jest.resetModules();
    ({ OpenAIRealtimeService } = require('../../../src/services/openai.realtime.service'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
    };
    WebSocket.mockImplementation(() => mockWebSocket);

    service = new OpenAIRealtimeService();
    seedConnection();
  });

  afterEach(() => {
    if (service?.connections?.has(callId)) {
      service.cleanup(callId);
    }
    jest.useRealTimers();
  });

  it('reports open-window confirm duration threshold below short hello length', () => {
    // Historically used MIN_SPEECH_DURATION_MS (800), which rejected ~400–600ms "hello?"
    expect(CONSTANTS.GREETING_MIN_SPEECH_CONFIRM_DURATION_MS).toBe(350);
    expect(CONSTANTS.GREETING_MIN_SPEECH_CONFIRM_DURATION_MS).toBeLessThan(400);
    expect(CONSTANTS.MIN_SPEECH_DURATION_MS).toBe(800);
    expect(service._getGreetingMinSpeechConfirmDurationMs()).toBe(350);
  });

  it('fires response.create with greeting instructions after silence fallback timeout', async () => {
    const sendSpy = jest.spyOn(service, 'sendResponseCreate').mockResolvedValue(true);

    service._armGreetingFallbackIfNeeded(callId);

    const conn = service.connections.get(callId);
    expect(conn._greetingFallbackTimer).toBeTruthy();
    expect(conn._userInputToOpenAIAllowed).toBe(true);
    expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.WAITING_FOR_GREETING);
    expect(sendSpy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_FALLBACK_MS);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      callId,
      expect.objectContaining({
        instructions: expect.stringMatching(/Jordan/i),
      })
    );
    expect(conn._initialGreetingTriggered).toBe(true);
    expect(conn._greetingFallbackTimer).toBeNull();
  });

  it('cancels silence-fallback timer on real speech (confirmed by transcription)', async () => {
    const sendSpy = jest.spyOn(service, 'sendResponseCreate').mockResolvedValue(true);

    service._armGreetingFallbackIfNeeded(callId);
    const conn = service.connections.get(callId);

    service._onGreetingPhaseSpeechStarted(callId, conn);
    expect(conn._greetingFallbackTimer).toBeNull();
    expect(conn._greetingSpeechConfirmTimer).toBeTruthy();

    service._noteGreetingPhaseSpeechEvidence(callId, conn, 'transcript');

    expect(conn._greetingFallbackCancelled).toBe(true);
    expect(conn._waitingForInitialGreeting).toBe(false);
    expect(conn._greetingSpeechConfirmTimer).toBeNull();

    await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_FALLBACK_MS + CONSTANTS.GREETING_SPEECH_CONFIRM_MS);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('confirms short "hello" (~500ms) commit as real speech', async () => {
    const sendSpy = jest.spyOn(service, 'sendResponseCreate').mockResolvedValue(true);

    service._armGreetingFallbackIfNeeded(callId);
    const conn = service.connections.get(callId);
    service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
    service._onGreetingPhaseSpeechStarted(callId, conn);

    conn._turnSpeechDurationMs = 500; // single-word greeting
    service._noteGreetingPhaseSpeechEvidence(callId, conn, 'commit');

    expect(conn._greetingFallbackCancelled).toBe(true);
    expect(conn._waitingForInitialGreeting).toBe(false);
    expect(conn._greetingSpeechConfirmTimer).toBeNull();

    await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_FALLBACK_MS + CONSTANTS.GREETING_SPEECH_CONFIRM_MS);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('retroactively cancels re-armed fallback when late non-empty ASR arrives', async () => {
    const sendSpy = jest.spyOn(service, 'sendResponseCreate').mockResolvedValue(true);

    service._armGreetingFallbackIfNeeded(callId);
    const conn = service.connections.get(callId);
    service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
    service._onGreetingPhaseSpeechStarted(callId, conn);

    // Confirm window closes as noise (no ASR yet)
    conn._turnSpeechDurationMs = 40;
    await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_SPEECH_CONFIRM_MS);

    expect(conn._greetingFallbackCancelled).toBe(false);
    expect(conn._greetingFallbackTimer).toBeTruthy();
    expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.WAITING_FOR_GREETING);

    // Late ASR for the utterance that confirm missed
    await service.handleInputAudioTranscriptionCompleted(callId, {
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'hello?',
      item_id: 'item_late_1',
    });

    expect(conn._greetingFallbackCancelled).toBe(true);
    expect(conn._waitingForInitialGreeting).toBe(false);
    expect(conn._greetingFallbackTimer).toBeNull();
    // Non-empty ASR must be kept (may already be cleared if ASR path finalized the turn)
    expect(conn.pendingUserTranscript === 'hello?' || conn._asrTranscriptionEventHandledThisTurn).toBe(true);
    // Cancel leaves conversation_active; ASR recovery may advance to ai_responding
    expect([
      CONVERSATION_STATES.CONVERSATION_ACTIVE,
      CONVERSATION_STATES.AI_RESPONDING,
    ]).toContain(service.getConversationState(callId));

    await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_FALLBACK_MS);
    // Normal ASR response path may sendResponseCreate; silence-fallback greeting must not
    const greetingSends = sendSpy.mock.calls.filter(
      ([, opts]) => typeof opts?.instructions === 'string' && /greet/i.test(opts.instructions)
    );
    expect(greetingSends).toHaveLength(0);
  });

  it('re-arms silence-fallback after speech_started with no commit/transcription (connect noise)', async () => {
    const sendSpy = jest.spyOn(service, 'sendResponseCreate').mockResolvedValue(true);

    service._armGreetingFallbackIfNeeded(callId);
    const conn = service.connections.get(callId);

    service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
    service._onGreetingPhaseSpeechStarted(callId, conn);
    expect(conn._greetingFallbackTimer).toBeNull();
    expect(conn._greetingSpeechConfirmTimer).toBeTruthy();

    conn._greetingSpeechHadCommit = false;
    conn._greetingSpeechHadTranscript = false;
    conn._turnSpeechDurationMs = 50;

    await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_SPEECH_CONFIRM_MS);

    expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.WAITING_FOR_GREETING);
    expect(conn._greetingFallbackTimer).toBeTruthy();
    expect(conn._greetingFallbackCancelled).toBe(false);
    expect(conn._greetingRearmCount).toBe(1);
    expect(sendSpy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_FALLBACK_MS);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]?.instructions).toMatch(/greet/i);
  });

  it('forces greeting when GREETING_MAX_REARMS is exceeded', async () => {
    const sendSpy = jest.spyOn(service, 'sendResponseCreate').mockResolvedValue(true);

    service._armGreetingFallbackIfNeeded(callId);
    const conn = service.connections.get(callId);
    const maxRearms = service._getGreetingMaxRearms();
    expect(maxRearms).toBe(2);

    // Exhaust allowed re-arms
    for (let i = 0; i < maxRearms; i += 1) {
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, `noise_${i}`);
      service._onGreetingPhaseSpeechStarted(callId, conn);
      conn._turnSpeechDurationMs = 30;
      conn._greetingSpeechHadCommit = false;
      conn._greetingSpeechHadTranscript = false;
      await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_SPEECH_CONFIRM_MS);
      expect(conn._greetingRearmCount).toBe(i + 1);
      expect(sendSpy).not.toHaveBeenCalled();
    }

    // Next noise exceeds cap → force greeting immediately (no silence delay)
    service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'noise_cap');
    service._onGreetingPhaseSpeechStarted(callId, conn);
    conn._turnSpeechDurationMs = 30;
    conn._greetingSpeechHadCommit = false;
    conn._greetingSpeechHadTranscript = false;
    await jest.advanceTimersByTimeAsync(CONSTANTS.GREETING_SPEECH_CONFIRM_MS);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]?.instructions).toMatch(/greet/i);
    expect(conn._initialGreetingTriggered).toBe(true);
  });

  it('barge-in cancels and truncates when resident speaks during fallback greeting', async () => {
    jest.spyOn(service, 'sendJsonMessage').mockResolvedValue();
    jest.spyOn(service, 'createPlaceholderUserMessage').mockResolvedValue();

    seedConnection({
      conversationState: CONVERSATION_STATES.GREETING_ACTIVE,
      stateHistory: [
        { state: CONVERSATION_STATES.INITIALIZING, timestamp: Date.now(), reason: 'test' },
        { state: CONVERSATION_STATES.WAITING_FOR_GREETING, timestamp: Date.now(), reason: 'test' },
        { state: CONVERSATION_STATES.GREETING_ACTIVE, timestamp: Date.now(), reason: 'greeting' },
      ],
      _waitingForInitialGreeting: true,
      _initialGreetingTriggered: true,
      _greetingFallbackCancelled: false,
      _responseCreateInFlight: false,
      _responseCreated: true,
      _aiIsSpeaking: true,
      _aiAudioPlaybackComplete: false,
      _currentAssistantItemId: 'item_greeting_1',
      _lastAiSpeechStart: Date.now() - 800,
      _userInputToOpenAIAllowed: true,
    });

    await service.handleOpenAIMessageInternal(
      callId,
      JSON.stringify({ type: 'input_audio_buffer.speech_started' })
    );

    const conn = service.connections.get(callId);
    expect(service.sendJsonMessage).toHaveBeenCalledWith(callId, { type: 'response.cancel' });
    expect(service.sendJsonMessage).toHaveBeenCalledWith(
      callId,
      expect.objectContaining({
        type: 'conversation.item.truncate',
        item_id: 'item_greeting_1',
        content_index: 0,
      })
    );
    expect(conn._waitingForInitialGreeting).toBe(false);
    expect(conn._responseCanceled).toBe(true);
    // Barge-in completes greeting → GREETING_COMPLETE, then speech_started advances to USER_SPEAKING
    expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.USER_SPEAKING);
    expect(conn.stateHistory.some((h) => h.state === CONVERSATION_STATES.GREETING_COMPLETE)).toBe(true);
  });

  it('barge-in during greeting in-flight (before audio) still cancels', async () => {
    jest.spyOn(service, 'sendJsonMessage').mockResolvedValue();
    jest.spyOn(service, 'createPlaceholderUserMessage').mockResolvedValue();

    seedConnection({
      conversationState: CONVERSATION_STATES.GREETING_ACTIVE,
      stateHistory: [
        { state: CONVERSATION_STATES.INITIALIZING, timestamp: Date.now(), reason: 'test' },
        { state: CONVERSATION_STATES.WAITING_FOR_GREETING, timestamp: Date.now(), reason: 'test' },
        { state: CONVERSATION_STATES.GREETING_ACTIVE, timestamp: Date.now(), reason: 'greeting' },
      ],
      _waitingForInitialGreeting: true,
      _initialGreetingTriggered: true,
      _responseCreateInFlight: true,
      _responseCreated: false,
      _aiIsSpeaking: false,
      // RTP looks idle — previous bug skipped barge-in before first audio delta
      _aiAudioPlaybackComplete: true,
      _currentAssistantItemId: null,
      _userInputToOpenAIAllowed: true,
    });

    await service.handleOpenAIMessageInternal(
      callId,
      JSON.stringify({ type: 'input_audio_buffer.speech_started' })
    );

    expect(service.sendJsonMessage).toHaveBeenCalledWith(callId, { type: 'response.cancel' });
    expect(service.sendJsonMessage).toHaveBeenCalledWith(callId, { type: 'output_audio_buffer.clear' });
    expect(service.connections.get(callId)._responseCanceled).toBe(true);
  });

  it('does not send immediate greeting on arm (only arms timer)', () => {
    const sendSpy = jest.spyOn(service, 'sendResponseCreate').mockResolvedValue(true);
    service._armGreetingFallbackIfNeeded(callId);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(service.connections.get(callId)._greetingFallbackTimer).toBeTruthy();
  });
});
