/**
 * Simulates OpenAI Realtime user-transcription events without a live WebSocket.
 * Run: yarn test tests/unit/services/openai.realtime.user-transcript.mock.test.js
 */
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = 'test-twilio-auth-token';
process.env.OPENAI_API_KEY = 'test-openai-api-key';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Message, Conversation, Call } = require('../../../src/models');

jest.mock('../../../src/services/emergencyProcessor.service', () => {
  const emergencyProcessor = {
    processUtterance: jest.fn().mockResolvedValue({
      shouldAlert: false,
      reason: 'No emergency detected',
    }),
    createAlert: jest.fn().mockResolvedValue({ success: true }),
  };
  return { emergencyProcessor };
});

const { OpenAIRealtimeService } = require('../../../src/services/openai.realtime.service');

const SPEAKING_PLACEHOLDER = '[Speaking...]';

describe('OpenAI Realtime user transcript (mocked server events)', () => {
  let mongoServer;
  let service;
  let conversationId;
  const callId = 'mock-call-transcript';

  /** Fails if emergency runs before live transcript path (regression guard for caregiver UI lag). */
  async function assertTranscriptPathBeforeEmergency(serviceInstance, callIdKey, completedPayload) {
    const { emergencyProcessor } = require('../../../src/services/emergencyProcessor.service');
    const order = [];

    emergencyProcessor.processUtterance.mockClear();
    emergencyProcessor.processUtterance.mockImplementation(async () => {
      order.push('emergency');
      return { shouldAlert: false, reason: 'ok' };
    });

    serviceInstance.setNotificationCallback((cid, type) => {
      if (type === 'user_transcript_updated') order.push('notify');
    });

    const origUpdate = Message.findByIdAndUpdate.bind(Message);
    const updateSpy = jest.spyOn(Message, 'findByIdAndUpdate').mockImplementation(async (...args) => {
      order.push('db');
      return origUpdate(...args);
    });

    try {
      await serviceInstance.handleInputAudioTranscriptionCompleted(callIdKey, completedPayload);
    } finally {
      updateSpy.mockRestore();
    }

    expect(order).toEqual(['notify', 'db', 'emergency']);
  }

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    await mongoose.connect(await mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await Call.deleteMany({});

    conversationId = new mongoose.Types.ObjectId();
    const call = await Call.create({
      callSid: callId,
      clientId: new mongoose.Types.ObjectId(),
      status: 'in-progress',
      duration: 0,
    });
    await Conversation.create({
      _id: conversationId,
      clientId: new mongoose.Types.ObjectId(),
      callId: call._id,
      messages: [],
    });

    service = new OpenAIRealtimeService();
    service.connections = new Map();
  });

  function baseConn(overrides = {}) {
    return {
      conversationId: conversationId.toString(),
      clientId: new mongoose.Types.ObjectId(),
      pendingUserTranscript: '',
      activeUserMessageId: null,
      _waitingForInitialGreeting: false,
      _waitingForUserTranscript: false,
      ...overrides,
    };
  }

  it('handleInputAudioTranscriptionCompleted stores top-level transcript', async () => {
    service.connections.set(callId, baseConn());
    await service.handleInputAudioTranscriptionCompleted(callId, {
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'I feel fine today.',
    });
    expect(service.connections.get(callId).pendingUserTranscript).toBe('I feel fine today.');
  });

  it('handleInputAudioTranscriptionCompleted updates placeholder content in DB (final state only)', async () => {
    const conn = baseConn();
    service.connections.set(callId, conn);
    await service.createPlaceholderUserMessage(callId);
    const mid = conn.activeUserMessageId;
    expect((await Message.findById(mid)).content).toBe('[Speaking...]');

    await service.handleInputAudioTranscriptionCompleted(callId, {
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'Live update text.',
    });

    const saved = await Message.findById(mid);
    expect(saved.content).toBe('Live update text.');
    expect(conn.pendingUserTranscript).toBe('Live update text.');
  });

  it('createPlaceholderUserMessage does not duplicate rows when active turn already has transcript', async () => {
    const conn = baseConn();
    service.connections.set(callId, conn);
    await service.createPlaceholderUserMessage(callId);
    const mid = conn.activeUserMessageId;

    await Message.findByIdAndUpdate(mid, { content: 'Everything has been going well.' });
    await service.createPlaceholderUserMessage(callId);

    const clientMessages = await Message.find({ conversationId, role: 'client' }).lean();
    expect(clientMessages).toHaveLength(1);
    expect(clientMessages[0].content).toBe('Everything has been going well.');
    expect(conn.activeUserMessageId.toString()).toBe(mid.toString());
  });

  it('handleInputAudioTranscriptionCompleted runs notify + DB persist before emergencyProcessor.processUtterance', async () => {
    const conn = baseConn();
    service.connections.set(callId, conn);
    await service.createPlaceholderUserMessage(callId);

    await assertTranscriptPathBeforeEmergency(service, callId, {
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'User said something long enough for emergency path to run.',
    });
  });

  it('deferred assistant queues are isolated per callId (concurrent calls)', async () => {
    const callA = 'mock-concurrent-a';
    const callB = 'mock-concurrent-b';
    const convA = new mongoose.Types.ObjectId();
    const convB = new mongoose.Types.ObjectId();

    const clientA = new mongoose.Types.ObjectId();
    const clientB = new mongoose.Types.ObjectId();
    const callRowA = await Call.create({ callSid: callA, clientId: clientA, status: 'in-progress', duration: 0 });
    const callRowB = await Call.create({ callSid: callB, clientId: clientB, status: 'in-progress', duration: 0 });
    await Conversation.create({ _id: convA, clientId: clientA, callId: callRowA._id, messages: [] });
    await Conversation.create({ _id: convB, clientId: clientB, callId: callRowB._id, messages: [] });

    const svc = new OpenAIRealtimeService();
    svc.connections = new Map();

    const minimalConn = (convId, clientId) => ({
      conversationId: convId.toString(),
      clientId,
      pendingUserTranscript: '',
      pendingAssistantTranscript: '',
      activeUserMessageId: null,
      activeAssistantMessageId: null,
      _waitingForInitialGreeting: false,
      _deferredAssistantQueue: [],
      conversationState: null,
      stateHistory: [],
    });

    svc.connections.set(callA, minimalConn(convA, clientA));
    svc.connections.set(callB, minimalConn(convB, clientB));

    const connA = svc.connections.get(callA);
    const connB = svc.connections.get(callB);

    connA._deferredAssistantQueue.push({ assistantMessageId: null, transcript: 'Deferred for call A only.' });

    await svc.flushDeferredAssistantQueue(callB, { force: true });
    expect(connA._deferredAssistantQueue).toHaveLength(1);

    await svc.flushDeferredAssistantQueue(callA, { force: true });
    expect(connA._deferredAssistantQueue).toHaveLength(0);
    expect(connB._deferredAssistantQueue).toHaveLength(0);
  });

  it('defers assistant final transcript in DB until user row is no longer [Speaking...]', async () => {
    const conn = baseConn();
    service.connections.set(callId, conn);
    await service.createPlaceholderUserMessage(callId);
    await service.createPlaceholderAssistantMessage(callId);
    const userMid = conn.activeUserMessageId;
    const asstMid = conn.activeAssistantMessageId;

    expect((await Message.findById(userMid)).content).toBe(SPEAKING_PLACEHOLDER);
    expect((await Message.findById(asstMid)).content).toBe(SPEAKING_PLACEHOLDER);

    conn.pendingAssistantTranscript = 'Bianca says hello and this is long enough.';
    await service.handleResponseDone(callId, { response: { status: 'completed' } });

    const assistantRow = await Message.findById(asstMid);
    expect(assistantRow.content).toBe(SPEAKING_PLACEHOLDER);
    expect(service.connections.get(callId)._deferredAssistantQueue).toHaveLength(1);

    await service.persistUserTranscriptToPlaceholder(callId, 'User line appears first in the UI.');

    expect((await Message.findById(userMid)).content).toBe('User line appears first in the UI.');
    expect((await Message.findById(asstMid)).content).toBe('Bianca says hello and this is long enough.');
    expect(service.connections.get(callId)._deferredAssistantQueue || []).toHaveLength(0);
  });

  it('handleInputAudioTranscriptionCompleted reads nested transcript shape', async () => {
    service.connections.set(callId, baseConn());
    await service.handleInputAudioTranscriptionCompleted(callId, {
      type: 'conversation.item.input_audio_transcription.completed',
      item: {
        input_audio_transcription: { transcript: 'Nested payload works.' },
      },
    });
    expect(service.connections.get(callId).pendingUserTranscript).toBe('Nested payload works.');
  });

  it('handleInputAudioTranscriptionFailed removes [Speaking...] placeholder', async () => {
    const conn = baseConn();
    service.connections.set(callId, conn);

    await service.createPlaceholderUserMessage(callId);
    const placeholderId = conn.activeUserMessageId;
    expect(placeholderId).toBeTruthy();
    expect((await Message.findById(placeholderId)).content).toBe('[Speaking...]');

    await service.handleInputAudioTranscriptionFailed(callId, {
      type: 'conversation.item.input_audio_transcription.failed',
      error: { message: 'mock failure', code: 'transcription_error' },
    });

    expect(await Message.findById(placeholderId)).toBeNull();
    expect(conn.activeUserMessageId).toBeNull();
    expect(conn.pendingUserTranscript).toBe('');
  });

  it('hangup flush force-commits mid-utterance audio and keeps transcript instead of orphan delete', async () => {
    const conn = baseConn({
      _userIsSpeaking: true,
      sessionReady: true,
      status: 'connected',
      pendingAssistantTranscript: '',
      webSocket: { readyState: 1, removeAllListeners() {}, close() {} },
    });
    service.connections.set(callId, conn);
    await service.createPlaceholderUserMessage(callId);
    const mid = conn.activeUserMessageId;

    const sent = [];
    service.sendJsonMessage = jest.fn(async (_id, msg) => {
      sent.push(msg);
      if (msg.type === 'input_audio_buffer.commit') {
        setImmediate(() => {
          service.handleInputAudioTranscriptionCompleted(callId, {
            type: 'conversation.item.input_audio_transcription.completed',
            item_id: 'item_hangup_flush_1',
            transcript: 'I spoke for a long time about how I am settling in.',
          });
        });
      }
    });

    await service.disconnect(callId);

    expect(sent.some((m) => m.type === 'input_audio_buffer.commit')).toBe(true);
    const saved = await Message.findById(mid);
    expect(saved).toBeTruthy();
    expect(saved.content).toBe('I spoke for a long time about how I am settling in.');
  });

  it('hangup flush persists live ASR buffer when commit times out', async () => {
    const prevMs = require('../../../src/services/ai/realtime/constants').HANGUP_TRANSCRIPT_FLUSH_MS;
    const constants = require('../../../src/services/ai/realtime/constants');
    constants.HANGUP_TRANSCRIPT_FLUSH_MS = 30;

    const conn = baseConn({
      _userIsSpeaking: true,
      sessionReady: true,
      status: 'connected',
      _userTranscriptLiveBuffer: 'Partial words from deltas',
      pendingAssistantTranscript: '',
      webSocket: { readyState: 1, removeAllListeners() {}, close() {} },
    });
    service.connections.set(callId, conn);
    await service.createPlaceholderUserMessage(callId);
    const mid = conn.activeUserMessageId;

    service.sendJsonMessage = jest.fn(async () => {});

    try {
      await service.disconnect(callId);
      const saved = await Message.findById(mid);
      expect(saved).toBeTruthy();
      expect(saved.content).toBe('Partial words from deltas');
    } finally {
      constants.HANGUP_TRANSCRIPT_FLUSH_MS = prevMs;
    }
  });

  it('_needsHangupUserTranscriptFlush is false when transcript already pending', () => {
    const conn = baseConn({ pendingUserTranscript: 'Already have it', _userIsSpeaking: true });
    expect(service._needsHangupUserTranscriptFlush(conn)).toBe(false);
  });
});
