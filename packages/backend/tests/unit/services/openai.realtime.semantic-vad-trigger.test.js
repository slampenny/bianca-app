/**
 * speech_stopped → response.create under semantic_vad (create_response: false).
 * Exercises the real OpenAIRealtimeService trigger path; only WebSocket / Mongo models are stubbed.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = 'test-twilio-auth-token';
process.env.TURN_DETECTION_MODE = 'semantic_vad';
process.env.TURN_DETECTION_EAGERNESS = 'low';
process.env.RESPONSE_TRIGGER_WATCHDOG_MS = '500';

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
  const { Types } = require('mongoose');
  return {
    Conversation: {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    },
    Message: {
      create: jest.fn().mockImplementation(async (doc) => ({
        _id: new Types.ObjectId(),
        ...doc,
      })),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      findByIdAndDelete: jest.fn(),
    },
    Client: {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ preferredLanguage: 'en' }),
        }),
      }),
      find: jest.fn(),
      findOne: jest.fn(),
    },
    Org: {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ debugAudioUploadEnabled: false }),
        }),
      }),
    },
    Call: {
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    },
  };
});

jest.mock('../../../src/services/emergencyProcessor.service', () => ({
  processUtterance: jest.fn(),
  createAlert: jest.fn(),
}));

jest.mock('ws');

const WebSocket = require('ws');
const {
  buildAudioTurnDetectionConfig,
  resolveTurnDetectionPayload,
} = require('../../../src/config/audioTurn.config');
const MessageHandler = require('../../../src/services/ai/realtime/message.handler');
const config = require('../../../src/config/config');

const CONVERSATION_STATES = {
  INITIALIZING: 'initializing',
  WAITING_FOR_GREETING: 'waiting_for_greeting',
  GREETING_ACTIVE: 'greeting_active',
  GREETING_COMPLETE: 'greeting_complete',
  USER_SPEAKING: 'user_speaking',
  AI_RESPONDING: 'ai_responding',
  CONVERSATION_ACTIVE: 'conversation_active',
};

describe('semantic_vad response trigger path', () => {
  let OpenAIRealtimeService;
  let mockWebSocket;
  let service;
  let callId;
  let logger;

  beforeAll(() => {
    jest.resetModules();
    // Re-require after env so config refresh paths and service see semantic_vad
    process.env.TURN_DETECTION_MODE = 'semantic_vad';
    process.env.TURN_DETECTION_EAGERNESS = 'low';
    process.env.RESPONSE_TRIGGER_WATCHDOG_MS = '500';
    const openAIService = require('../../../src/services/openai.realtime.service');
    OpenAIRealtimeService = openAIService.OpenAIRealtimeService;
    logger = require('../../../src/config/logger');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ advanceTimers: true });

    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
    };
    WebSocket.mockImplementation(() => mockWebSocket);

    service = new OpenAIRealtimeService();
    callId = 'semantic-vad-call-1';

    // Ensure live config matches semantic_vad A/B default for this suite
    config.audio.turnDetection = buildAudioTurnDetectionConfig({
      TURN_DETECTION_MODE: 'semantic_vad',
      TURN_DETECTION_EAGERNESS: 'low',
      RESPONSE_TRIGGER_WATCHDOG_MS: '500',
    });

    service.connections.set(callId, {
      status: 'ready',
      webSocket: mockWebSocket,
      sessionReady: true,
      sessionId: 'sess_semantic_test_1',
      conversationId: 'conv-semantic-1',
      clientId: 'client-semantic-1',
      asteriskChannelId: 'chan-semantic-1',
      preferredLanguage: 'en',
      conversationState: null,
      stateHistory: [],
      pendingUserTranscript: 'I was thinking about lunch today',
      activeUserMessageId: null,
      pendingAssistantTranscript: '',
      activeAssistantMessageId: null,
      _deferredAssistantQueue: [],
      _pendingUserResponseAfterAiStops: false,
      _userTurnResponseCreateSent: false,
      _responseCreateInFlight: false,
      _responseCreated: false,
      _aiIsSpeaking: false,
      _aiOutputAudioDeltaSeen: false,
      _aiAudioComplete: false,
      _aiAudioCompleteDebounceTimer: null,
      _aiAudioPlaybackComplete: true,
      _speechStoppedFinalizePending: false,
      _speechStoppedFinalizeTimer: null,
      _speechStoppedCommittedAiResponding: false,
      _waitingForUserTranscript: false,
      _processedTranscriptItemIds: new Set(),
      _asrTranscriptionEventHandledThisTurn: false,
      _turnSpeechStartTime: null,
      _turnSpeechDurationMs: 0,
      _lastResponseDoneAt: null,
      _pendingStopsSetAt: null,
      _userIsSpeaking: false,
      _waitingForInitialGreeting: false,
      _initialGreetingTriggered: true,
      _initialGreetingCompletedAt: Date.now() - 10_000,
      _responseCanceled: false,
      _responseCanceledAt: null,
      _responseStartTime: null,
      voiceTurnTracking: null,
      vadSilenceDurationMs: undefined,
      pendingCommit: false,
    });

    service.initializeConversationState(callId);
    service.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready');
    service.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'greeting_triggered');
    service.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'greeting_completed');
  });

  afterEach(() => {
    if (service?.connections) {
      for (const id of service.connections.keys()) {
        try {
          service.cleanup(id);
        } catch (_) {
          /* ignore */
        }
      }
    }
    jest.useRealTimers();
  });

  it('session turn_detection is semantic_vad with create_response false', () => {
    const tdCfg = buildAudioTurnDetectionConfig({
      TURN_DETECTION_MODE: 'semantic_vad',
      TURN_DETECTION_EAGERNESS: 'low',
    });
    const payload = resolveTurnDetectionPayload(tdCfg, { vadSilenceDurationMs: 750 });
    expect(payload).toEqual({
      type: 'semantic_vad',
      eagerness: 'low',
      create_response: false,
    });

    const session = MessageHandler.buildSessionConfig(service.connections.get(callId));
    expect(session.session.audio.input.turn_detection.type).toBe('semantic_vad');
    expect(session.session.audio.input.turn_detection.create_response).toBe(false);
    expect(session.session.audio.input.turn_detection.silence_duration_ms).toBeUndefined();
  });

  it('speech_stopped schedules exactly one response.create after 200ms (no silence/personalization gates)', async () => {
    const conn = service.connections.get(callId);
    expect(config.audio.turnDetection.mode).toBe('semantic_vad');
    expect(config.audio.turnDetection.createResponse).toBe(false);

    await service.handleOpenAIMessageInternal(
      callId,
      JSON.stringify({ type: 'input_audio_buffer.speech_started' })
    );
    expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.USER_SPEAKING);

    // Utterance long enough for MIN_SPEECH_DURATION_FOR_RESPONSE_MS (1200)
    conn._turnSpeechStartTime = Date.now() - 2000;
    conn.pendingUserTranscript = 'I was thinking about lunch today';
    conn.activeUserMessageId = '507f1f77bcf86cd799439011';

    await service.handleOpenAIMessageInternal(
      callId,
      JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
    );

    expect(mockWebSocket.send).not.toHaveBeenCalled();
    expect(conn._responseTriggerWatchdogTimer).toBeTruthy();
    expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.AI_RESPONDING);

    // Canonical debounce — not dependent on silence_duration_ms or pendingCommit
    expect(conn.pendingCommit).toBe(false);
    jest.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();

    const responseCreates = mockWebSocket.send.mock.calls
      .map(([raw]) => {
        try {
          return JSON.parse(raw);
        } catch (_) {
          return null;
        }
      })
      .filter((msg) => msg?.type === 'response.create');

    expect(responseCreates).toHaveLength(1);
    expect(conn._userTurnResponseCreateSent).toBe(true);
    expect(conn._responseTriggerWatchdogTimer).toBeNull();

    // Duplicate speech_stopped must not send a second response.create
    await service.handleOpenAIMessageInternal(
      callId,
      JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
    );
    jest.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();

    const afterDup = mockWebSocket.send.mock.calls
      .map(([raw]) => {
        try {
          return JSON.parse(raw);
        } catch (_) {
          return null;
        }
      })
      .filter((msg) => msg?.type === 'response.create');
    expect(afterDup).toHaveLength(1);
  });

  it('watchdog logs error with session id when response.create never fires', async () => {
    const conn = service.connections.get(callId);
    const errorSpy = jest.spyOn(logger, 'error');

    await service.handleOpenAIMessageInternal(
      callId,
      JSON.stringify({ type: 'input_audio_buffer.speech_started' })
    );
    conn._turnSpeechStartTime = Date.now() - 2000;
    conn.pendingUserTranscript = 'Hello there friend';
    conn.activeUserMessageId = '507f1f77bcf86cd799439012';

    // Drop the WebSocket so the scheduled send never lands on the wire
    mockWebSocket.readyState = WebSocket.CLOSED;

    await service.handleOpenAIMessageInternal(
      callId,
      JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
    );

    expect(conn._responseTriggerWatchdogTimer).toBeTruthy();

    jest.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /RESPONSE_TRIGGER_WATCHDOG: speech_stopped but no response\.create within 500ms.*sessionId=sess_semantic_test_1/
      )
    );
  });

  describe('short utterance duration gate (Bug 2)', () => {
    const responseCreateCount = () =>
      mockWebSocket.send.mock.calls
        .map(([raw]) => {
          try {
            return JSON.parse(raw);
          } catch (_) {
            return null;
          }
        })
        .filter((msg) => msg?.type === 'response.create').length;

    it('400ms "yes" with transcript → exactly one response.create on the canonical path', async () => {
      const conn = service.connections.get(callId);

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_started' })
      );
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = 'yes';
      conn._substantiveAsrThisTurn = true;
      conn.activeUserMessageId = '507f1f77bcf86cd799439021';

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.AI_RESPONDING);

      jest.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();

      expect(responseCreateCount()).toBe(1);
      expect(conn._userTurnResponseCreateSent).toBe(true);
      expect(conn._speechTooShortAwaitingTranscript).toBe(false);
    });

    it('400ms cough with empty transcript → no response.create and no watchdog error', async () => {
      const conn = service.connections.get(callId);
      const errorSpy = jest.spyOn(logger, 'error');
      const infoSpy = jest.spyOn(logger, 'info');

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_started' })
      );
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = '';
      conn._substantiveAsrThisTurn = false;
      conn.activeUserMessageId = '507f1f77bcf86cd799439022';

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();

      expect(responseCreateCount()).toBe(0);
      expect(conn._speechTooShortAwaitingTranscript).toBe(true);
      expect(service.getConversationState(callId)).toBe(CONVERSATION_STATES.CONVERSATION_ACTIVE);

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(responseCreateCount()).toBe(0);
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/RESPONSE_TRIGGER_WATCHDOG: speech_stopped but no response\.create/)
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/RESPONSE_TRIGGER_WATCHDOG expired quietly after speech-too-short with no transcript/)
      );
    });

    it('hu session: Bianca finishes question → user "igen" (400ms) → exactly one response.create', async () => {
      const conn = service.connections.get(callId);
      conn.preferredLanguage = 'hu';
      conn._aiIsSpeaking = false;
      conn._responseCreated = false;
      conn._responseCreateInFlight = false;
      conn._userUtteranceDuringAiWithoutBargeIn = false;

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_started' })
      );
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = 'igen';
      conn._substantiveAsrThisTurn = true;
      conn.activeUserMessageId = '507f1f77bcf86cd799439041';

      expect(service._shouldSuppressUserTranscriptAsFiller(conn, 'igen')).toBe(false);

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();

      expect(responseCreateCount()).toBe(1);
    });

    it('hu session: "aha" during AI speech without barge-in → suppressed, no deferred reply', async () => {
      const conn = service.connections.get(callId);
      const errorSpy = jest.spyOn(logger, 'error');
      conn.preferredLanguage = 'hu';

      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'prep');
      service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'ai_speaking');
      conn._aiIsSpeaking = true;
      conn._responseCreated = true;
      conn._responseCreateInFlight = false;
      conn._responseCanceled = false;
      conn._userUtteranceDuringAiWithoutBargeIn = true;
      conn._userIsSpeaking = true;
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = 'aha';
      conn._substantiveAsrThisTurn = false;
      conn.activeUserMessageId = '507f1f77bcf86cd799439042';

      expect(service._shouldSuppressUserTranscriptAsFiller(conn, 'aha')).toBe(true);

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(700);
      await Promise.resolve();

      expect(responseCreateCount()).toBe(0);
      expect(conn._pendingUserResponseAfterAiStops).toBe(false);
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/RESPONSE_TRIGGER_WATCHDOG: speech_stopped but no response\.create/)
      );
    });

    it('ja session: "はい" during AI speech without barge-in → suppressed, no deferred reply', async () => {
      const conn = service.connections.get(callId);
      const errorSpy = jest.spyOn(logger, 'error');
      conn.preferredLanguage = 'ja';

      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'prep');
      service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'ai_speaking');
      conn._aiIsSpeaking = true;
      conn._responseCreated = true;
      conn._responseCreateInFlight = false;
      conn._responseCanceled = false;
      conn._userUtteranceDuringAiWithoutBargeIn = true;
      conn._userIsSpeaking = true;
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = 'はい';
      conn._substantiveAsrThisTurn = false;
      conn.activeUserMessageId = '507f1f77bcf86cd799439043';

      expect(service._shouldSuppressUserTranscriptAsFiller(conn, 'はい')).toBe(true);

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(700);
      await Promise.resolve();

      expect(responseCreateCount()).toBe(0);
      expect(conn._pendingUserResponseAfterAiStops).toBe(false);
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/RESPONSE_TRIGGER_WATCHDOG: speech_stopped but no response\.create/)
      );
    });

    it('ja session: Bianca finishes question → user "はい" (400ms) → exactly one response.create', async () => {
      const conn = service.connections.get(callId);
      conn.preferredLanguage = 'ja';
      conn._aiIsSpeaking = false;
      conn._responseCreated = false;
      conn._responseCreateInFlight = false;
      conn._userUtteranceDuringAiWithoutBargeIn = false;

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_started' })
      );
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = 'はい';
      conn._substantiveAsrThisTurn = true;
      conn.activeUserMessageId = '507f1f77bcf86cd799439044';

      expect(service._shouldSuppressUserTranscriptAsFiller(conn, 'はい')).toBe(false);

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();

      expect(responseCreateCount()).toBe(1);
    });

    it('zh session: "嗯嗯" during AI speech without barge-in → suppressed, no deferred reply', async () => {
      const conn = service.connections.get(callId);
      const errorSpy = jest.spyOn(logger, 'error');
      conn.preferredLanguage = 'zh';

      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'prep');
      service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'ai_speaking');
      conn._aiIsSpeaking = true;
      conn._responseCreated = true;
      conn._responseCreateInFlight = false;
      conn._responseCanceled = false;
      conn._userUtteranceDuringAiWithoutBargeIn = true;
      conn._userIsSpeaking = true;
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = '嗯嗯';
      conn._substantiveAsrThisTurn = false;
      conn.activeUserMessageId = '507f1f77bcf86cd799439045';

      expect(service._shouldSuppressUserTranscriptAsFiller(conn, '嗯嗯')).toBe(true);

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(700);
      await Promise.resolve();

      expect(responseCreateCount()).toBe(0);
      expect(conn._pendingUserResponseAfterAiStops).toBe(false);
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/RESPONSE_TRIGGER_WATCHDOG: speech_stopped but no response\.create/)
      );
    });

    it('Bianca finishes question → user "yes" (400ms) → exactly one response.create', async () => {
      const conn = service.connections.get(callId);
      // AI finished; turn is with the user
      conn._aiIsSpeaking = false;
      conn._responseCreated = false;
      conn._responseCreateInFlight = false;
      conn._userUtteranceDuringAiWithoutBargeIn = false;

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_started' })
      );
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = 'yes';
      conn._substantiveAsrThisTurn = true;
      conn.activeUserMessageId = '507f1f77bcf86cd799439031';

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();

      expect(responseCreateCount()).toBe(1);
    });

    it('mm-hmm while Bianca mid-response without barge-in → no response.create, no watchdog error', async () => {
      const conn = service.connections.get(callId);
      const errorSpy = jest.spyOn(logger, 'error');

      // Soft overlap already in progress: AI still owns the turn, user uttered without barge-in cancel
      service.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'prep');
      service.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'ai_speaking');
      conn._aiIsSpeaking = true;
      conn._responseCreated = true;
      conn._responseCreateInFlight = false;
      conn._responseCanceled = false;
      conn._userUtteranceDuringAiWithoutBargeIn = true;
      conn._userIsSpeaking = true;
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = 'mm-hmm';
      conn._substantiveAsrThisTurn = false;
      conn.activeUserMessageId = '507f1f77bcf86cd799439032';

      expect(service._shouldSuppressUserTranscriptAsFiller(conn, 'mm-hmm')).toBe(true);

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(responseCreateCount()).toBe(0);
      expect(conn._pendingUserResponseAfterAiStops).toBe(false);
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/RESPONSE_TRIGGER_WATCHDOG: speech_stopped but no response\.create/)
      );
    });

    it('short utterance + transcript with recovery unavailable → watchdog fires', async () => {
      const conn = service.connections.get(callId);
      const errorSpy = jest.spyOn(logger, 'error');

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_started' })
      );
      // No transcript at speech_stopped → acoustic short abort keeps watchdog
      conn._turnSpeechStartTime = Date.now() - 400;
      conn.pendingUserTranscript = '';
      conn._substantiveAsrThisTurn = false;
      conn.activeUserMessageId = '507f1f77bcf86cd799439023';

      await service.handleOpenAIMessageInternal(
        callId,
        JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })
      );

      jest.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();

      expect(responseCreateCount()).toBe(0);
      expect(conn._speechTooShortAwaitingTranscript).toBe(true);

      // Simulate late ASR evidence without ASR recovery paths (stuck / recovery unavailable)
      conn.pendingUserTranscript = 'yes';
      conn._substantiveAsrThisTurn = true;
      conn._userTurnResponseCreateSent = false;
      conn._responseCreateInFlight = false;
      conn._responseCreated = false;

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(responseCreateCount()).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /RESPONSE_TRIGGER_WATCHDOG: speech_stopped but no response\.create within 500ms.*sessionId=sess_semantic_test_1.*hasTranscript=true/
        )
      );
    });
  });
});
