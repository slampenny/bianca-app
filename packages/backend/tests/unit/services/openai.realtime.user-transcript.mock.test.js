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

describe('OpenAI Realtime user transcript (mocked server events)', () => {
  let mongoServer;
  let service;
  let conversationId;
  const callId = 'mock-call-transcript';

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

  it('handleInputAudioTranscriptionCompleted writes message to DB immediately (live)', async () => {
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
});
