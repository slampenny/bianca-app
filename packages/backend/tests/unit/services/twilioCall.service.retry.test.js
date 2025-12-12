const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Call, Conversation, Patient, Org, Caregiver } = require('../../../src/models');

// Mock agenda before importing twilioCallService
jest.mock('../../../src/config/agenda', () => ({
  agenda: {
    schedule: jest.fn().mockResolvedValue({}),
    jobs: jest.fn().mockResolvedValue([]),
    define: jest.fn(),
  },
}));

// Mock alert service before importing twilioCallService
jest.mock('../../../src/services/alert.service', () => ({
  createAlert: jest.fn().mockResolvedValue({ _id: 'test-alert-id' }),
}));

// Mock chat service
jest.mock('../../../src/services/chat.service', () => ({
  summarize: jest.fn().mockResolvedValue('Test summary'),
}));

// Now import the service (mocks are in place)
const twilioCallService = require('../../../src/services/twilioCall.service');
const { agenda } = require('../../../src/config/agenda');
const alertService = require('../../../src/services/alert.service');

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

describe('TwilioCallService - Call Retry Functionality', () => {
  let org;
  let patient;
  let call;

  beforeEach(async () => {
    // Clean up
    await Org.deleteMany({});
    await Patient.deleteMany({});
    await Call.deleteMany({});
    await Conversation.deleteMany({});
    await Caregiver.deleteMany({});
    jest.clearAllMocks();

    // Create org with retry settings
    org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
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

    // Create Call record (Call tracks call metadata, not Conversation)
    call = await Call.create({
      callSid: 'CA1234567890',
      patientId: patient._id,
      startTime: new Date(),
      callStartTime: new Date(),
      callType: 'wellness-check',
      status: 'initiated',
      callStatus: 'initiating',
      retryAttempt: 0,
    });
  });

  describe('scheduleRetryCall', () => {
    it('should schedule a retry call when max retries not reached', async () => {
      const retryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

      await twilioCallService.scheduleRetryCall(call, org);

      expect(agenda.schedule).toHaveBeenCalledWith(
        expect.any(Date),
        'retryMissedCall',
        {
          callId: call._id.toString(),
          patientId: patient._id.toString(),
          retryAttempt: 1,
          originalCallId: call._id.toString(),
        }
      );

      // Verify call was updated
      const updatedCall = await Call.findById(call._id);
      expect(updatedCall.retryScheduledAt).toBeDefined();
    });

    it('should not schedule retry when max retries already reached', async () => {
      call.retryAttempt = 2; // Already at max
      await call.save();

      await twilioCallService.scheduleRetryCall(call, org);

      expect(agenda.schedule).not.toHaveBeenCalled();
    });

    it('should use correct retry attempt number', async () => {
      call.retryAttempt = 1; // First retry already done
      await call.save();

      await twilioCallService.scheduleRetryCall(call, org);

      expect(agenda.schedule).toHaveBeenCalledWith(
        expect.any(Date),
        'retryMissedCall',
        expect.objectContaining({
          retryAttempt: 2, // Should be second retry
        })
      );
    });

    it('should use originalCallId for retry attempts', async () => {
      const originalCallId = new mongoose.Types.ObjectId();
      call.originalCallId = originalCallId;
      call.retryAttempt = 1;
      await call.save();

      await twilioCallService.scheduleRetryCall(call, org);

      expect(agenda.schedule).toHaveBeenCalledWith(
        expect.any(Date),
        'retryMissedCall',
        expect.objectContaining({
          originalCallId: originalCallId.toString(),
        })
      );
    });

    it('should calculate retry time based on org settings', async () => {
      org.callRetrySettings.retryIntervalMinutes = 30;
      await org.save();

      const beforeSchedule = Date.now();
      await twilioCallService.scheduleRetryCall(call, org);
      const afterSchedule = Date.now();

      const scheduledTime = agenda.schedule.mock.calls[0][0];
      const expectedTime = beforeSchedule + 30 * 60 * 1000;
      const actualTime = scheduledTime.getTime();

      // Allow 1 second tolerance
      expect(actualTime).toBeGreaterThanOrEqual(expectedTime - 1000);
      expect(actualTime).toBeLessThanOrEqual(afterSchedule + 30 * 60 * 1000 + 1000);
    });
  });

  describe('handleCallStatus - missed calls with retries', () => {
    it('should schedule retry for no-answer call', async () => {
      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'no-answer',
          CallDuration: '0',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(agenda.schedule).toHaveBeenCalled();
      const updatedCall = await Call.findById(call._id);
      expect(updatedCall.status).toBe('failed');
      expect(updatedCall.callOutcome).toBe('no_answer');
    });

    it('should schedule retry for busy call', async () => {
      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'busy',
          CallDuration: '0',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(agenda.schedule).toHaveBeenCalled();
    });

    it('should schedule retry for voicemail call', async () => {
      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'completed',
          CallDuration: '10',
          AnsweredBy: 'machine_start',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(agenda.schedule).toHaveBeenCalled();
      const updatedCall = await Call.findById(call._id);
      expect(updatedCall.status).toBe('failed');
      expect(updatedCall.callOutcome).toBe('voicemail');
    });

    it('should create alert when alertOnAllMissedCalls is true', async () => {
      org.callRetrySettings.alertOnAllMissedCalls = true;
      await org.save();

      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'no-answer',
          CallDuration: '0',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(alertService.createAlert).toHaveBeenCalled();
    });

    it('should not create alert when alertOnAllMissedCalls is false and retries remaining', async () => {
      org.callRetrySettings.alertOnAllMissedCalls = false;
      org.callRetrySettings.retryCount = 2;
      await org.save();

      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'no-answer',
          CallDuration: '0',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(alertService.createAlert).not.toHaveBeenCalled();
    });

    it('should create alert when alertOnAllMissedCalls is false but all retries exhausted', async () => {
      org.callRetrySettings.alertOnAllMissedCalls = false;
      org.callRetrySettings.retryCount = 2;
      await org.save();

      call.retryAttempt = 2; // All retries done
      await call.save();

      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'no-answer',
          CallDuration: '0',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(alertService.createAlert).toHaveBeenCalled();
    });

    it('should correctly use populated patientId and retrieve org settings', async () => {
      // This test verifies that we're correctly using the already-populated patientId
      // and that org settings are properly retrieved for alert logic
      org.callRetrySettings.alertOnAllMissedCalls = true;
      org.callRetrySettings.retryCount = 3;
      await org.save();

      // Reload patient to ensure org is populated
      await patient.populate('org');
      
      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'no-answer',
          CallDuration: '0',
        },
      };

      await twilioCallService.handleCallStatus(req);

      // Verify alert was created (proving org settings were correctly retrieved)
      expect(alertService.createAlert).toHaveBeenCalled();
      const alertCall = alertService.createAlert.mock.calls[0][0];
      expect(alertCall.relatedPatient.toString()).toBe(patient._id.toString());
      expect(alertCall.alertType).toBe('patient');
    });

    it('should correctly retrieve org settings from populated patient', async () => {
      // Verify that org settings are correctly retrieved and used for alert logic
      org.callRetrySettings.alertOnAllMissedCalls = true;
      org.callRetrySettings.retryCount = 3;
      await org.save();

      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'no-answer',
          CallDuration: '0',
        },
      };

      await twilioCallService.handleCallStatus(req);

      // Verify alert was created with correct settings
      expect(alertService.createAlert).toHaveBeenCalled();
      const alertCall = alertService.createAlert.mock.calls[0][0];
      expect(alertCall.relatedPatient.toString()).toBe(patient._id.toString());
    });

    it('should cancel remaining retries when retry call succeeds', async () => {
      const originalCallId = new mongoose.Types.ObjectId();
      call.originalCallId = originalCallId;
      call.retryAttempt = 1; // This is a retry
      await call.save();

      // Mock agenda.jobs to return remaining retry jobs
      const mockJob1 = {
        attrs: {
          data: {
            retryAttempt: 2,
            originalCallId: originalCallId.toString(),
          },
        },
        remove: jest.fn(),
      };
      agenda.jobs = jest.fn().mockResolvedValue([mockJob1]);

      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'completed',
          CallDuration: '120',
          AnsweredBy: 'human',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(agenda.jobs).toHaveBeenCalledWith({
        name: 'retryMissedCall',
        'data.originalCallId': originalCallId.toString(),
      });
      expect(mockJob1.remove).toHaveBeenCalled();
    });

    it('should not cancel retries when original call succeeds (not a retry)', async () => {
      call.retryAttempt = 0; // Original call
      await call.save();

      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'completed',
          CallDuration: '120',
          AnsweredBy: 'human',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(agenda.jobs).not.toHaveBeenCalled();
    });
  });

  describe('handleCallStatus - successful calls', () => {
    it('should not schedule retry for successful call', async () => {
      const req = {
        body: {
          CallSid: call.callSid,
          CallStatus: 'completed',
          CallDuration: '120',
          AnsweredBy: 'human',
        },
      };

      await twilioCallService.handleCallStatus(req);

      expect(agenda.schedule).not.toHaveBeenCalled();
      const updatedCall = await Call.findById(call._id);
      expect(updatedCall.status).toBe('completed');
    });
  });
});



