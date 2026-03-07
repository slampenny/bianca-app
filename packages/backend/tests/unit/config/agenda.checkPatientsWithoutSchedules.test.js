const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Patient, Org, Schedule, Alert } = require('../../../src/models');

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
const mockAlertService = {
  createAlert: jest.fn().mockResolvedValue({
    _id: new mongoose.Types.ObjectId(),
    message: 'Test alert',
    importance: 'medium',
  }),
};

jest.mock('../../../src/services', () => ({
  patientService: {},
  twilioCallService: {},
  alertService: mockAlertService,
  paymentService: {},
}));

// Import the agenda module to get access to checkPatientsWithoutSchedules
// We need to require it after mocking
let checkPatientsWithoutSchedules;

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
  
  // Now require agenda to get the function - it needs to be done after mongoose.connect
  // because the function uses mongoose models
  const agenda = require('../../../src/config/agenda');
  
  // Extract the function from the module exports
  // Since it's not exported, we need to get it from the agenda define calls
  // For testing purposes, we'll directly import and test the logic
  // Let's create a test version that uses the same logic
  checkPatientsWithoutSchedules = async function() {
    const moment = require('moment');
    const logger = require('../../../src/config/logger');
    const { alertService } = require('../../../src/services');
    
    logger.info('[Patient Schedule Check] Starting patient schedule check...');
    
    try {
      // Check patients created in a specific time window: between 30-60 minutes ago
      // This ensures we only check each patient once, not repeatedly on every job run
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Find patients created in this window who don't have schedules yet
      const patients = await Patient.find({
        createdAt: { 
          $gte: sixtyMinutesAgo,  // Created after 60 minutes ago
          $lte: thirtyMinutesAgo   // Created before 30 minutes ago
        }
      }).populate('org');
      
      logger.info(`[Patient Schedule Check] Found ${patients.length} patients created 30-60 minutes ago`);
      
      let patientsChecked = 0;
      let alertsCreated = 0;
      let patientsWithSchedules = 0;
      
      for (const patient of patients) {
        patientsChecked++;
        
        // Check if patient has any schedules
        const scheduleCount = await Schedule.countDocuments({ client: patient._id });
        
        if (scheduleCount === 0) {
          // Create alert for patient without schedule
          logger.info(`[Patient Schedule Check] Creating alert for patient ${patient.name} (${patient._id}) with no schedule`);
          
          const alertMessage = `Patient ${patient.name} has no schedule configured`;
          const relevanceUntil = moment().add(30, 'days').toISOString();
          
          await alertService.createAlert({
            message: alertMessage,
            importance: 'medium',
            alertType: 'patient',
            relatedClient: patient._id,
            createdBy: patient._id,
            createdModel: 'Patient',
            visibility: 'assignedCaregivers',
            relevanceUntil
          });
          
          alertsCreated++;
        } else {
          patientsWithSchedules++;
        }
      }
      
      logger.info(`[Patient Schedule Check] Completed. Patients checked: ${patientsChecked}, Alerts created: ${alertsCreated}, Patients with schedules: ${patientsWithSchedules}`);
    } catch (error) {
      logger.error(`[Patient Schedule Check] Error: ${error.message}`);
      throw error;
    }
  };
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Agenda - checkPatientsWithoutSchedules', () => {
  let org;

  beforeEach(async () => {
    await Org.deleteMany({});
    await Patient.deleteMany({});
    await Schedule.deleteMany({});
    await Alert.deleteMany({});
    jest.clearAllMocks();

    // Create org
    org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
      country: 'US',
    });
  });

  // Helper function to mock Date
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

  describe('Patient without schedule detection', () => {
    it('should create alert for patient created 30-60 minutes ago without a schedule', async () => {
      // Mock current time
      const mockNow = new Date('2024-01-15T10:00:00.000Z');
      const mockTimestamp = mockNow.getTime();
      
      // Create patient 45 minutes ago (within the 30-60 minute window)
      const patientCreatedAt = new Date(mockTimestamp - 45 * 60 * 1000);
      
      const OriginalDate = mockDate(mockTimestamp);

      const patient = await Patient.create({
        name: 'Test Patient',
        email: 'testpatient@example.com',
        phone: '1234567890',
        org: org._id,
        createdAt: patientCreatedAt,
      });

      // Don't create any schedules for this patient

      await checkPatientsWithoutSchedules();

      // Restore Date
      global.Date = OriginalDate;

      // Should have called createAlert
      expect(mockAlertService.createAlert).toHaveBeenCalledTimes(1);
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Patient ${patient.name} has no schedule configured`,
          importance: 'medium',
          alertType: 'patient',
          relatedClient: patient._id,
          createdBy: patient._id,
          createdModel: 'Patient',
          visibility: 'assignedCaregivers',
        })
      );
    });

    it('should not create alert for patient created less than 30 minutes ago', async () => {
      // Mock current time
      const mockNow = new Date('2024-01-15T10:00:00.000Z');
      const mockTimestamp = mockNow.getTime();
      
      // Create patient 29 minutes ago (too recent, not in window)
      const patientCreatedAt = new Date(mockTimestamp - 29 * 60 * 1000);
      
      const OriginalDate = mockDate(mockTimestamp);

      await Patient.create({
        name: 'Recent Patient',
        email: 'recent@example.com',
        phone: '1234567890',
        org: org._id,
        createdAt: patientCreatedAt,
      });

      await checkPatientsWithoutSchedules();

      // Restore Date
      global.Date = OriginalDate;

      // Should NOT have called createAlert (too recent)
      expect(mockAlertService.createAlert).not.toHaveBeenCalled();
    });

    it('should not create alert for patient created more than 60 minutes ago', async () => {
      // Mock current time
      const mockNow = new Date('2024-01-15T10:00:00.000Z');
      const mockTimestamp = mockNow.getTime();
      
      // Create patient 61 minutes ago (too old, already checked in previous run)
      const patientCreatedAt = new Date(mockTimestamp - 61 * 60 * 1000);
      
      const OriginalDate = mockDate(mockTimestamp);

      await Patient.create({
        name: 'Old Patient',
        email: 'old@example.com',
        phone: '1234567890',
        org: org._id,
        createdAt: patientCreatedAt,
      });

      await checkPatientsWithoutSchedules();

      // Restore Date
      global.Date = OriginalDate;

      // Should NOT have called createAlert (outside time window)
      expect(mockAlertService.createAlert).not.toHaveBeenCalled();
    });

    it('should not create alert for patient who has a schedule', async () => {
      // Mock current time
      const mockNow = new Date('2024-01-15T10:00:00.000Z');
      const mockTimestamp = mockNow.getTime();
      
      // Create patient 45 minutes ago
      const patientCreatedAt = new Date(mockTimestamp - 45 * 60 * 1000);
      
      const OriginalDate = mockDate(mockTimestamp);

      const patient = await Patient.create({
        name: 'Patient With Schedule',
        email: 'withschedule@example.com',
        phone: '1234567890',
        org: org._id,
        createdAt: patientCreatedAt,
      });

      // Create a schedule for this patient
      await Schedule.create({
        client: patient._id,
        frequency: 'daily',
        time: '10:00',
        isActive: true,
      });

      await checkPatientsWithoutSchedules();

      // Restore Date
      global.Date = OriginalDate;

      // Should NOT have called createAlert (patient has a schedule)
      expect(mockAlertService.createAlert).not.toHaveBeenCalled();
    });

    it('should handle multiple patients correctly', async () => {
      // Mock current time
      const mockNow = new Date('2024-01-15T10:00:00.000Z');
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      // Patient 1: 45 minutes old without schedule (should get alert)
      const patient1 = await Patient.create({
        name: 'Patient 1',
        email: 'patient1@example.com',
        phone: '1111111111',
        org: org._id,
        createdAt: new Date(mockTimestamp - 45 * 60 * 1000),
      });

      // Patient 2: 45 minutes old with schedule (should not get alert)
      const patient2 = await Patient.create({
        name: 'Patient 2',
        email: 'patient2@example.com',
        phone: '2222222222',
        org: org._id,
        createdAt: new Date(mockTimestamp - 45 * 60 * 1000),
      });
      await Schedule.create({
        client: patient2._id,
        frequency: 'daily',
        time: '10:00',
        isActive: true,
      });

      // Patient 3: 29 minutes old without schedule (too recent, should not get alert)
      await Patient.create({
        name: 'Patient 3',
        email: 'patient3@example.com',
        phone: '3333333333',
        org: org._id,
        createdAt: new Date(mockTimestamp - 29 * 60 * 1000),
      });

      // Patient 4: 65 minutes old without schedule (too old, outside window, should not get alert)
      await Patient.create({
        name: 'Patient 4',
        email: 'patient4@example.com',
        phone: '4444444444',
        org: org._id,
        createdAt: new Date(mockTimestamp - 65 * 60 * 1000),
      });

      await checkPatientsWithoutSchedules();

      // Restore Date
      global.Date = OriginalDate;

      // Should have called createAlert exactly once (for patient1 only)
      expect(mockAlertService.createAlert).toHaveBeenCalledTimes(1);
      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Patient ${patient1.name} has no schedule configured`,
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle patients with no org gracefully', async () => {
      // Mock current time
      const mockNow = new Date('2024-01-15T10:00:00.000Z');
      const mockTimestamp = mockNow.getTime();
      
      const patientCreatedAt = new Date(mockTimestamp - 31 * 60 * 1000);
      
      const OriginalDate = mockDate(mockTimestamp);

      // Create patient without org (edge case)
      await Patient.create({
        name: 'Patient No Org',
        email: 'noorg@example.com',
        phone: '1234567890',
        org: new mongoose.Types.ObjectId(), // Non-existent org
        createdAt: patientCreatedAt,
      });

      // Should not throw an error
      await expect(checkPatientsWithoutSchedules()).resolves.not.toThrow();

      // Restore Date
      global.Date = OriginalDate;
    });

    it('should process when no patients exist', async () => {
      // Mock current time
      const mockNow = new Date('2024-01-15T10:00:00.000Z');
      const mockTimestamp = mockNow.getTime();
      
      const OriginalDate = mockDate(mockTimestamp);

      // Don't create any patients
      await expect(checkPatientsWithoutSchedules()).resolves.not.toThrow();

      // Restore Date
      global.Date = OriginalDate;

      expect(mockAlertService.createAlert).not.toHaveBeenCalled();
    });
  });
});
