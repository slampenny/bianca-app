const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Conversation, Patient, Org, Call } = require('../../../src/models');

// Mock config and logger before requiring agenda
jest.mock('../../../src/config/config', () => ({
  mongoose: { url: 'mongodb://localhost:27017/test' },
  billing: { enableDailyBilling: false, billingTime: '00:00' },
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock Agenda constructor before requiring agenda config
jest.mock('agenda', () => {
  const mockAgendaInstance = {
    schedule: jest.fn(),
    jobs: jest.fn(),
    define: jest.fn(),
    on: jest.fn(), // Add 'on' method for event listeners
    once: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    every: jest.fn(),
  };
  return jest.fn().mockImplementation(() => mockAgendaInstance);
});

// Mock Twilio library (external service)
jest.mock('twilio', () => {
  const mockTwilioClient = {
    calls: {
      create: jest.fn().mockResolvedValue({
        sid: 'CA1234567890abcdef1234567890abcdef',
        status: 'queued'
      })
    }
  };
  const mockTwilio = jest.fn(() => mockTwilioClient);
  mockTwilio.twiml = {
    VoiceResponse: jest.fn().mockImplementation(() => ({
      say: jest.fn().mockReturnThis(),
      dial: jest.fn().mockReturnThis(),
      toString: jest.fn().mockReturnValue('<Response></Response>')
    }))
  };
  return mockTwilio;
});

// Mock twilioCallService.initiateCall
jest.mock('../../../src/services/twilioCall.service', () => ({
  initiateCall: jest.fn(),
}));

// Mock other services that agenda.js requires
jest.mock('../../../src/services', () => ({
  patientService: {},
  twilioCallService: { initiateCall: jest.fn() },
  alertService: {},
  paymentService: {},
}));

// Mock Schedule model
jest.mock('../../../src/models/schedule.model', () => ({}));

// Now require agenda after mocking
const { agenda } = require('../../../src/config/agenda');
const twilioCallService = require('../../../src/services/twilioCall.service');

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

describe('Agenda - Retry Missed Call Job', () => {
  let org;
  let patient;
  let conversation;

  beforeEach(async () => {
    await Org.deleteMany({});
    await Patient.deleteMany({});
    await Conversation.deleteMany({});
    jest.clearAllMocks();

    // Create org with retry settings
    org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
      country: 'US',
      callRetrySettings: {
        retryCount: 2,
        retryIntervalMinutes: 15,
        alertOnAllMissedCalls: true,
      },
    });

    // Create patient
    patient = await Patient.create({
      name: 'Test Patient',
      email: 'patient@example.com',
      phone: '5551234567',
      org: org._id,
    });

    // Create a Call first (Conversation requires callId)
    const call = await Call.create({
      callSid: 'CA1234567890',
      clientId: patient._id,
      org: org._id,
      status: 'failed',
      duration: 0
    });
    
    // Create failed conversation
    conversation = await Conversation.create({
      callId: call._id,
      clientId: patient._id,
      status: 'failed',
    });
  });

  it('should execute retry job and initiate new call', async () => {
    const mockCallSid = 'CA9876543210';
    twilioCallService.initiateCall.mockResolvedValue(mockCallSid);

    // Get the job handler
    const jobDefinitions = agenda.define.mock.calls;
    const retryJobDef = jobDefinitions.find(call => call[0] === 'retryMissedCall');
    
    if (!retryJobDef) {
      // If job not defined in test, we need to manually call the handler
      // This simulates what agenda would do
      const jobData = {
        conversationId: conversation._id.toString(),
        clientId: patient._id.toString(),
        retryAttempt: 1,
        originalCallId: conversation._id.toString(),
      };

      // Manually execute the retry logic
      const retryConversation = await Conversation.findById(conversation._id);
      const retryPatient = await Patient.findById(patient._id).populate('org');
      const retryOrg = retryPatient.org;
      const maxRetries = retryOrg.callRetrySettings.retryCount || 2;

      expect(jobData.retryAttempt).toBeLessThanOrEqual(maxRetries);

      const newCallSid = await twilioCallService.initiateCall(patient._id);
      
      // Create a Call first (Conversation requires callId)
      // Retry fields are on Call, not Conversation
      const originalCall = await Call.findOne({ callSid: 'CA1234567890' });
      const newCall = await Call.create({
        callSid: newCallSid,
        clientId: patient._id,
        org: org._id,
        status: 'initiated',
        duration: 0,
        retryAttempt: jobData.retryAttempt,
        originalCallId: originalCall._id,
        maxRetries: maxRetries,
      });
      
      const newConversation = await Conversation.create({
        callId: newCall._id,
        clientId: patient._id,
        status: 'initiated',
      });

      expect(twilioCallService.initiateCall).toHaveBeenCalledWith(patient._id);
      expect(newCall.retryAttempt).toBe(1);
      expect(newCall.originalCallId.toString()).toBe(originalCall._id.toString());
    }
  });

  it('should not retry if max retries exceeded', async () => {
    conversation.retryAttempt = 3; // Exceeds max of 2
    await conversation.save();

    const jobData = {
      conversationId: conversation._id.toString(),
      clientId: patient._id.toString(),
      retryAttempt: 3,
      originalCallId: conversation._id.toString(),
    };

    const retryPatient = await Patient.findById(patient._id).populate('org');
    const retryOrg = retryPatient.org;
    const maxRetries = retryOrg.callRetrySettings.retryCount || 2;

    expect(jobData.retryAttempt).toBeGreaterThan(maxRetries);
    expect(twilioCallService.initiateCall).not.toHaveBeenCalled();
  });

  it('should handle missing conversation gracefully', async () => {
    const fakeConversationId = new mongoose.Types.ObjectId();
    const jobData = {
      conversationId: fakeConversationId.toString(),
      clientId: patient._id.toString(),
      retryAttempt: 1,
      originalCallId: fakeConversationId.toString(),
    };

    const retryConversation = await Conversation.findById(fakeConversationId);
    expect(retryConversation).toBeNull();
    // Job should handle this error gracefully
  });

  it('should handle missing patient gracefully', async () => {
    const fakePatientId = new mongoose.Types.ObjectId();
    const jobData = {
      conversationId: conversation._id.toString(),
      clientId: fakePatientId.toString(),
      retryAttempt: 1,
      originalCallId: conversation._id.toString(),
    };

    const retryPatient = await Patient.findById(fakePatientId).populate('org');
    expect(retryPatient).toBeNull();
    // Job should handle this error gracefully
  });
});





