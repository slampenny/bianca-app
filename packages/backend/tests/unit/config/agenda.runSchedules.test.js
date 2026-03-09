const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Client, Org, Schedule } = require('../../../src/models');

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
    on: jest.fn(),
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

// Mock services
const mockTwilioCallService = {
  initiateCall: jest.fn().mockResolvedValue('CA1234567890abcdef1234567890abcdef'),
};

const mockClientService = {
  checkClientConsent: jest.fn().mockResolvedValue(true), // Default to consent granted
};

const mockAlertService = {
  createAlert: jest.fn().mockResolvedValue({}),
};

jest.mock('../../../src/services', () => ({
  clientService: mockClientService,
  twilioCallService: mockTwilioCallService,
  alertService: mockAlertService,
  paymentService: {},
}));

// Now require agenda after mocking
const { runSchedules } = require('../../../src/config/agenda');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Agenda - runSchedules', () => {
  let org;
  let client;

  beforeEach(async () => {
    await Org.deleteMany({});
    await Client.deleteMany({});
    await Schedule.deleteMany({});
    jest.clearAllMocks();

    // Create org
    org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
      country: 'US',
    });

    // Create client
    client = await Client.create({
      name: 'Test Client',
      email: 'testclient@example.com',
      phone: '1234567890',
      org: org._id,
    });
  });

  // Helper function to mock Date consistently
  const mockDate = (mockTimestamp) => {
    const OriginalDate = global.Date;
    const MockDate = function(...args) {
      if (args.length === 0) {
        return new OriginalDate(mockTimestamp);
      }
      return new OriginalDate(...args);
    };
    MockDate.now = jest.fn(() => mockTimestamp);
    MockDate.UTC = OriginalDate.UTC.bind(OriginalDate);
    MockDate.parse = OriginalDate.parse;
    MockDate.prototype = OriginalDate.prototype;
    Object.setPrototypeOf(MockDate, OriginalDate);
    global.Date = MockDate;
    return OriginalDate;
  };

  describe('Daily schedule execution', () => {
    it('should run a daily schedule when nextCallDate is in the past and time matches', async () => {
      // Create a daily schedule for 2:00 AM UTC
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      pastDate.setUTCHours(2, 0, 0, 0);

      // Create schedule with nextCallDate, then update it directly in DB to bypass validation
      // Create schedule - let the hook set nextCallDate, then update it directly in DB
      const schedule = await Schedule.create({
        client: client._id,
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '02:00',
      });
      // Update directly in DB to bypass pre-validate hook
      await Schedule.updateOne({ _id: schedule._id }, { $set: { nextCallDate: pastDate } });
      
      // Verify the update worked
      const updatedSchedule = await Schedule.findById(schedule._id);
      expect(updatedSchedule.nextCallDate.getTime()).toBe(pastDate.getTime());

      // Mock current time to be within 15 minutes of 02:00 UTC
      // Set mockNow to be today at 2:05 AM UTC (pastDate is yesterday at 2:00 AM UTC)
      const mockNow = new Date();
      mockNow.setUTCDate(mockNow.getUTCDate()); // Today
      mockNow.setUTCHours(2, 5, 0, 0); // 2:05 AM UTC
      mockNow.setUTCMinutes(5);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      // Ensure pastDate is definitely in the past relative to mockNow
      expect(pastDate.getTime()).toBeLessThan(mockNow.getTime());
      
      // Mock Date constructor and Date.now using the same pattern as consent tests
      const OriginalDate = global.Date;
      
      const MockDate = function(...args) {
        if (args.length === 0) {
          return new OriginalDate(mockTimestamp);
        }
        return new OriginalDate(...args);
      };
      
      MockDate.now = jest.fn(() => mockTimestamp);
      MockDate.UTC = OriginalDate.UTC.bind(OriginalDate);
      MockDate.parse = OriginalDate.parse;
      MockDate.prototype = OriginalDate.prototype;
      Object.setPrototypeOf(MockDate, OriginalDate);
      
      global.Date = MockDate;
      
      // Verify Date mocking is working - both should return the mocked time
      const testDate1 = new Date();
      const testDate2 = new Date(Date.now());
      expect(testDate1.getTime()).toBe(mockTimestamp);
      expect(testDate2.getTime()).toBe(mockTimestamp);
      expect(Date.now()).toBe(mockTimestamp);
      
      // Verify schedule exists and nextCallDate is in the past
      const scheduleBeforeRun = await Schedule.findOne({ _id: schedule._id });
      expect(scheduleBeforeRun).toBeDefined();
      expect(scheduleBeforeRun.nextCallDate.getTime()).toBeLessThan(mockTimestamp);
      
      // Manually verify the query that runSchedules() will use (with mocked Date)
      const testNowUTC = new Date(Date.now());
      const testSchedules = await Schedule.find({
        isActive: true,
        nextCallDate: { $lte: testNowUTC },
      });
      expect(testSchedules.length).toBeGreaterThan(0);
      expect(testSchedules[0]._id.toString()).toBe(schedule._id.toString());

      // Ensure client has org populated in the database
      const clientWithOrg = await Client.findById(client._id).populate('org');
      expect(clientWithOrg.org).toBeDefined();
      expect(clientWithOrg.org._id.toString()).toBe(org._id.toString());
      
      // Mock checkClientConsent to return true (consent granted)
      mockClientService.checkClientConsent.mockResolvedValue(true);

      await runSchedules();

      // checkClientConsent doesn't call getClientById, it uses Client.findById
      // Verify that the call was initiated with schedule.client (ObjectId)
      expect(mockTwilioCallService.initiateCall).toHaveBeenCalled();
      const callArgs = mockTwilioCallService.initiateCall.mock.calls[0];
      expect(callArgs[0].toString()).toBe(client._id.toString());
      expect(mockAlertService.createAlert).toHaveBeenCalled();

      // Restore Date
      global.Date = OriginalDate;
    });

    it('should skip a schedule when current time is more than 15 minutes from scheduled time', async () => {
      // Create a daily schedule for 2:00 AM UTC
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      pastDate.setUTCHours(2, 0, 0, 0);

      // Create schedule - let the hook set nextCallDate, then update it directly in DB
      const schedule = await Schedule.create({
        client: client._id,
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '02:00',
      });
      // Update directly in DB to bypass pre-validate hook
      await Schedule.updateOne({ _id: schedule._id }, { $set: { nextCallDate: pastDate } });

      // Mock current time to be more than 15 minutes from 02:00 UTC
      const mockNow = new Date();
      mockNow.setUTCHours(2, 20, 0, 0); // 2:20 AM UTC (20 minutes past)
      mockNow.setUTCMinutes(20);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      expect(mockTwilioCallService.initiateCall).not.toHaveBeenCalled();

      global.Date = OriginalDate;
    });

    it('should skip inactive schedules', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      pastDate.setUTCHours(2, 0, 0, 0);

      const inactiveSchedule = await Schedule.create({
        client: client._id,
        frequency: 'daily',
        intervals: [],
        isActive: false, // Inactive
        time: '02:00',
      });
      await Schedule.updateOne({ _id: inactiveSchedule._id }, { $set: { nextCallDate: pastDate } });

      const mockNow = new Date();
      mockNow.setUTCHours(2, 5, 0, 0);
      mockNow.setUTCMinutes(5);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      expect(mockTwilioCallService.initiateCall).not.toHaveBeenCalled();

      global.Date = OriginalDate;
    });

    it('should skip schedules where nextCallDate is in the future', async () => {
      const futureDate = new Date();
      futureDate.setUTCDate(futureDate.getUTCDate() + 1);
      futureDate.setUTCHours(2, 0, 0, 0);

      const futureSchedule = await Schedule.create({
        client: client._id,
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '02:00',
      });
      await Schedule.updateOne({ _id: futureSchedule._id }, { $set: { nextCallDate: futureDate } });

      const mockNow = new Date();
      mockNow.setUTCHours(2, 5, 0, 0);
      mockNow.setUTCMinutes(5);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      expect(mockTwilioCallService.initiateCall).not.toHaveBeenCalled();

      global.Date = OriginalDate;
    });
  });

  describe('Weekly schedule execution', () => {
    it('should run a weekly schedule when day matches and time is within window', async () => {
      // Mock current time to be Monday at 2:05 AM UTC first, so we can calculate pastDate relative to it
      const mockNow = new Date();
      // Set to a specific Monday (January 1, 2024 is actually a Monday, day 1)
      mockNow.setUTCFullYear(2024, 0, 1); // January 1, 2024
      mockNow.setUTCHours(2, 5, 0, 0);
      mockNow.setUTCMinutes(5);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      // Verify it's actually a Monday (day 1)
      expect(mockNow.getUTCDay()).toBe(1);
      
      // Set pastDate relative to the mocked time (7 days before)
      const pastDate = new Date(mockTimestamp - 7 * 24 * 60 * 60 * 1000);
      pastDate.setUTCHours(2, 0, 0, 0);

      const schedule = await Schedule.create({
        client: client._id,
        frequency: 'weekly',
        intervals: [{ day: 1, weeks: 1 }], // Monday
        isActive: true,
        time: '02:00',
      });
      await Schedule.updateOne({ _id: schedule._id }, { $set: { nextCallDate: pastDate } });
      
      const OriginalDate = mockDate(mockTimestamp);

      // Ensure client has org populated
      const clientWithOrg = await Client.findById(client._id).populate('org');
      expect(clientWithOrg.org).toBeDefined();

      await runSchedules();

      expect(mockTwilioCallService.initiateCall).toHaveBeenCalled();

      global.Date = OriginalDate;
    });

    it('should skip a weekly schedule when day does not match', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      pastDate.setUTCHours(2, 0, 0, 0);

      const schedule = await Schedule.create({
        client: client._id,
        frequency: 'weekly',
        intervals: [{ day: 1, weeks: 1 }], // Monday
        isActive: true,
        time: '02:00',
      });
      await Schedule.updateOne({ _id: schedule._id }, { $set: { nextCallDate: pastDate } });

      // Mock current time to be Tuesday (day 2) at 2:05 AM UTC
      const mockNow = new Date();
      // Set to a specific Tuesday
      mockNow.setUTCFullYear(2024, 0, 2); // January 2, 2024 is a Tuesday
      mockNow.setUTCHours(2, 5, 0, 0);
      mockNow.setUTCMinutes(5);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      expect(mockTwilioCallService.initiateCall).not.toHaveBeenCalled();

      global.Date = OriginalDate;
    });
  });

  describe('Monthly schedule execution', () => {
    it('should run a monthly schedule when day matches and time is within window', async () => {
      // Create a monthly schedule for the 15th at 2:00 AM UTC
      const now = new Date();
      const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      pastDate.setUTCHours(2, 0, 0, 0);

      const schedule = await Schedule.create({
        client: client._id,
        frequency: 'monthly',
        intervals: [{ day: 15, weeks: 0 }],
        isActive: true,
        time: '02:00',
      });
      await Schedule.updateOne({ _id: schedule._id }, { $set: { nextCallDate: pastDate } });

      // Mock current time to be the 15th at 2:05 AM UTC
      const mockNow = new Date();
      mockNow.setUTCDate(15);
      mockNow.setUTCHours(2, 5, 0, 0);
      mockNow.setUTCMinutes(5);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      expect(mockTwilioCallService.initiateCall).toHaveBeenCalled();

      global.Date = OriginalDate;
    });
  });

  describe('Error handling', () => {
    it('should handle errors when client is not found', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      pastDate.setUTCHours(2, 0, 0, 0);

      const schedule = await Schedule.create({
        client: new mongoose.Types.ObjectId(), // Non-existent client
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '02:00',
      });
      await Schedule.updateOne({ _id: schedule._id }, { $set: { nextCallDate: pastDate } });

      // Schedule has non-existent client id; Client.findById returns null in agenda

      const mockNow = new Date();
      mockNow.setUTCHours(2, 5, 0, 0);
      mockNow.setUTCMinutes(5);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      expect(mockTwilioCallService.initiateCall).not.toHaveBeenCalled();

      global.Date = OriginalDate;
    });

    it('should handle errors when initiateCall fails', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      pastDate.setUTCHours(2, 0, 0, 0);

      const schedule = await Schedule.create({
        client: client._id,
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '02:00',
        nextCallDate: pastDate,
      });
      await Schedule.updateOne({ _id: schedule._id }, { $set: { nextCallDate: pastDate } });

      mockTwilioCallService.initiateCall.mockRejectedValue(new Error('Twilio API error'));

      const mockNow = new Date();
      mockNow.setUTCHours(2, 5, 0, 0);
      mockNow.setUTCMinutes(5);
      mockNow.setUTCSeconds(0);
      mockNow.setUTCMilliseconds(0);
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      expect(mockTwilioCallService.initiateCall).toHaveBeenCalled();
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          importance: 'high',
          alertType: 'system',
        })
      );

      global.Date = OriginalDate;
    });
  });

  describe('Client consent checks', () => {
    it('should skip call and alert caregivers when org requires consent but client has not consented', async () => {
      // Create org that requires client consent
      const consentOrg = await Org.create({
        name: 'Consent Required Org',
        email: 'consent@example.com',
        country: 'US',
        requirePatientConsent: true,
      });

      // Create client without consent
      const unconsentedClient = await Client.create({
        name: 'Unconsented Client',
        email: 'unconsented@example.com',
        phone: '1234567891',
        org: consentOrg._id,
        consented: false,
      });

      // Set up dates: schedule should run at 2:00 AM, we'll set nextCallDate to be in the past
      // and use a time that's within the 15-minute window
      const baseDate = new Date('2024-01-15T02:00:00.000Z'); // 2:00 AM UTC
      const pastDate = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const mockNow = new Date(baseDate.getTime() + 5 * 60 * 1000); // 2:05 AM UTC (5 minutes past, within 15 min window)

      const schedule = await Schedule.create({
        client: unconsentedClient._id,
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '02:00',
      });
      
      // The pre-validate hook recalculates nextCallDate, so we need to update it directly
      // Use updateOne to bypass the hook
      await Schedule.updateOne(
        { _id: schedule._id },
        { $set: { nextCallDate: pastDate } }
      );

      // Mock checkClientConsent to return false
      mockClientService.checkClientConsent = jest.fn().mockResolvedValue(false);

      // Verify the schedule exists and nextCallDate is in the past
      const foundSchedule = await Schedule.findById(schedule._id);
      expect(foundSchedule).toBeDefined();
      expect(foundSchedule.nextCallDate.getTime()).toBeLessThan(mockNow.getTime());

      // Mock Date constructor and Date.now
      const mockTimestamp = mockNow.getTime();
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      // Restore Date
      global.Date = OriginalDate;

      // Should NOT initiate call
      expect(mockTwilioCallService.initiateCall).not.toHaveBeenCalled();
      
      // Should alert caregivers about missing consent
      expect(mockAlertService.createAlert).toHaveBeenCalled();
      
      // Check for the consent alert
      const consentAlertCall = mockAlertService.createAlert.mock.calls.find(call => 
        call[0].message && call[0].message.includes('consent is required but has not been obtained')
      );
      expect(consentAlertCall).toBeDefined();
      expect(consentAlertCall[0]).toMatchObject({
        importance: 'medium',
        alertType: 'system',
        visibility: 'assignedCaregivers',
      });
    });

    it('should make call when org requires consent and client has consented', async () => {
      // Create org that requires client consent
      const consentOrg = await Org.create({
        name: 'Consent Required Org',
        email: 'consent@example.com',
        country: 'US',
        requirePatientConsent: true,
      });

      // Create client with consent
      const consentedClient = await Client.create({
        name: 'Consented Client',
        email: 'consented@example.com',
        phone: '1234567892',
        org: consentOrg._id,
        consented: true,
      });

      // Set up dates: schedule should run at 2:00 AM
      const baseDate = new Date('2024-01-15T02:00:00.000Z'); // 2:00 AM UTC
      const pastDate = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const mockNow = new Date(baseDate.getTime() + 5 * 60 * 1000); // 2:05 AM UTC

      const schedule = await Schedule.create({
        client: consentedClient._id,
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '02:00',
      });
      
      // Use updateOne to bypass the pre-validate hook
      await Schedule.updateOne(
        { _id: schedule._id },
        { $set: { nextCallDate: pastDate } }
      );

      // Mock checkClientConsent to return true
      mockClientService.checkClientConsent = jest.fn().mockResolvedValue(true);
      
      // Reset initiateCall mock to ensure it's not throwing an error from a previous test
      mockTwilioCallService.initiateCall.mockReset();
      mockTwilioCallService.initiateCall.mockResolvedValue('CA1234567890abcdef1234567890abcdef');

      // Ensure client has org populated
      const clientWithOrg = await Client.findById(consentedClient._id).populate('org');
      expect(clientWithOrg.org).toBeDefined();
      expect(clientWithOrg.org._id.toString()).toBe(consentOrg._id.toString());

      // Mock Date constructor and Date.now
      const mockTimestamp = mockNow.getTime();
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      // Restore Date
      global.Date = OriginalDate;

      // Should initiate call (check that it was called with the client ID)
      expect(mockTwilioCallService.initiateCall).toHaveBeenCalled();
      const callArgs = mockTwilioCallService.initiateCall.mock.calls[0][0];
      expect(callArgs.toString()).toBe(consentedClient._id.toString());
      
      // Should create success alert
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Called'),
          importance: 'low',
          alertType: 'client',
        })
      );
    });

    it('should make call when org does not require consent regardless of client consent status', async () => {
      // Create org that does NOT require client consent
      const noConsentOrg = await Org.create({
        name: 'No Consent Required Org',
        email: 'noconsent@example.com',
        country: 'US',
        requirePatientConsent: false,
      });

      // Create client without consent (but org doesn't require it)
      const clientNoConsent = await Client.create({
        name: 'Client No Consent',
        email: 'noconsent@example.com',
        phone: '1234567893',
        org: noConsentOrg._id,
        consented: false,
      });

      // Set up dates: schedule should run at 2:00 AM
      const baseDate = new Date('2024-01-15T02:00:00.000Z'); // 2:00 AM UTC
      const pastDate = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const mockNow = new Date(baseDate.getTime() + 5 * 60 * 1000); // 2:05 AM UTC

      const schedule = await Schedule.create({
        client: clientNoConsent._id,
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '02:00',
      });
      
      // Use updateOne to bypass the pre-validate hook
      await Schedule.updateOne(
        { _id: schedule._id },
        { $set: { nextCallDate: pastDate } }
      );

      // Mock checkClientConsent to return true (because org doesn't require it)
      mockClientService.checkClientConsent = jest.fn().mockResolvedValue(true);

      // Mock Date constructor and Date.now
      const mockTimestamp = mockNow.getTime();
      const OriginalDate = mockDate(mockTimestamp);

      await runSchedules();

      // Restore Date
      global.Date = OriginalDate;

      // Should initiate call even though client hasn't consented (org doesn't require it)
      expect(mockTwilioCallService.initiateCall).toHaveBeenCalled();
      const callArgs = mockTwilioCallService.initiateCall.mock.calls[0][0];
      expect(callArgs.toString()).toBe(clientNoConsent._id.toString());
    });
  });
});

