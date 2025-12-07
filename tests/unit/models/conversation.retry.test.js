const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Conversation, Patient, Org } = require('../../../src/models');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Conversation Model - Retry Fields', () => {
  let org;
  let patient;

  beforeAll(async () => {
    org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
    });

    patient = await Patient.create({
      name: 'Test Patient',
      email: 'patient@example.com',
      phone: '5551234567',
      org: org._id,
    });
  });

  beforeEach(async () => {
    await Conversation.deleteMany({});
  });

  it('should create conversation with default retryAttempt of 0', async () => {
    const conversation = await Conversation.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
    });

    expect(conversation.retryAttempt).toBe(0);
  });

  it('should allow setting retryAttempt', async () => {
    const conversation = await Conversation.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: 1,
    });

    expect(conversation.retryAttempt).toBe(1);
  });

  it('should allow setting originalCallId', async () => {
    const originalConversation = await Conversation.create({
      callSid: 'CA1111111111',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'failed',
    });

    const retryConversation = await Conversation.create({
      callSid: 'CA2222222222',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: 1,
      originalCallId: originalConversation._id,
    });

    expect(retryConversation.originalCallId.toString()).toBe(originalConversation._id.toString());
  });

  it('should allow setting retryScheduledAt', async () => {
    const scheduledTime = new Date(Date.now() + 15 * 60 * 1000);
    const conversation = await Conversation.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryScheduledAt: scheduledTime,
    });

    expect(conversation.retryScheduledAt).toEqual(scheduledTime);
  });

  it('should allow setting maxRetries', async () => {
    const conversation = await Conversation.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      maxRetries: 3,
    });

    expect(conversation.maxRetries).toBe(3);
  });

  it('should enforce minimum retryAttempt of 0', async () => {
    const conversation = new Conversation({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: -1,
    });

    await expect(conversation.save()).rejects.toThrow();
  });

  it('should allow querying conversations by originalCallId', async () => {
    const originalConversation = await Conversation.create({
      callSid: 'CA1111111111',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'failed',
    });

    const retry1 = await Conversation.create({
      callSid: 'CA2222222222',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: 1,
      originalCallId: originalConversation._id,
    });

    const retry2 = await Conversation.create({
      callSid: 'CA3333333333',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: 2,
      originalCallId: originalConversation._id,
    });

    const retries = await Conversation.find({
      originalCallId: originalConversation._id,
    });

    expect(retries).toHaveLength(2);
    expect(retries.map(r => r._id.toString())).toEqual(
      expect.arrayContaining([retry1._id.toString(), retry2._id.toString()])
    );
  });
});



