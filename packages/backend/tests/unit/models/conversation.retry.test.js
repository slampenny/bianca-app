const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Call, Conversation, Patient, Org } = require('../../../src/models');

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

describe('Call Model - Retry Fields', () => {
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
    await Call.deleteMany({});
    await Conversation.deleteMany({});
  });

  it('should create call with default retryAttempt of 0', async () => {
    const call = await Call.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
    });

    expect(call.retryAttempt).toBe(0);
  });

  it('should allow setting retryAttempt', async () => {
    const call = await Call.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: 1,
    });

    expect(call.retryAttempt).toBe(1);
  });

  it('should allow setting originalCallId', async () => {
    const originalCall = await Call.create({
      callSid: 'CA1111111111',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'failed',
    });

    const retryCall = await Call.create({
      callSid: 'CA2222222222',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: 1,
      originalCallId: originalCall._id,
    });

    expect(retryCall.originalCallId.toString()).toBe(originalCall._id.toString());
  });

  it('should allow setting retryScheduledAt', async () => {
    const scheduledTime = new Date(Date.now() + 15 * 60 * 1000);
    const call = await Call.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryScheduledAt: scheduledTime,
    });

    expect(call.retryScheduledAt).toEqual(scheduledTime);
  });

  it('should allow setting maxRetries', async () => {
    const call = await Call.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      maxRetries: 3,
    });

    expect(call.maxRetries).toBe(3);
  });

  it('should enforce minimum retryAttempt of 0', async () => {
    const call = new Call({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: -1,
    });

    await expect(call.save()).rejects.toThrow();
  });

  it('should allow querying calls by originalCallId', async () => {
    const originalCall = await Call.create({
      callSid: 'CA1111111111',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'failed',
    });

    const retry1 = await Call.create({
      callSid: 'CA2222222222',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: 1,
      originalCallId: originalCall._id,
    });

    const retry2 = await Call.create({
      callSid: 'CA3333333333',
      patientId: patient._id,
      startTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      retryAttempt: 2,
      originalCallId: originalCall._id,
    });

    const retries = await Call.find({
      originalCallId: originalCall._id,
    });

    expect(retries).toHaveLength(2);
    expect(retries.map(r => r._id.toString())).toEqual(
      expect.arrayContaining([retry1._id.toString(), retry2._id.toString()])
    );
  });
});
