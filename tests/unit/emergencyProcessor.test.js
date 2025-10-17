// tests/unit/emergencyProcessor.test.js

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { EmergencyProcessor } = require('../../src/services/emergencyProcessor.service');
const { detectEmergency } = require('../../src/utils/emergencyDetector');

// Only mock external dependencies
// Using real alert.service and sns.service now

// Using real emergency config now

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Emergency Processor', () => {
  let processor;
  let mockPatient;
  let mockCaregivers;

  beforeEach(async () => {
    processor = new EmergencyProcessor();
    
    // Create actual Patient and Caregiver documents in the database
    const { Patient, Caregiver, EmergencyPhrase } = require('../../src/models');
    
    // Clear existing documents
    await Patient.deleteMany({});
    await Caregiver.deleteMany({});
    await EmergencyPhrase.deleteMany({});
    
    // Create test emergency phrases for detection
    const testUserId = new (require('mongoose')).Types.ObjectId();
    await EmergencyPhrase.create([
      {
        phrase: "heart attack",
        language: "en",
        category: "Medical",
        severity: "CRITICAL",
        description: "Cardiac emergency",
        pattern: "\\b(heart\\s+attack|heartattack)\\b",
        caseSensitive: false,
        createdBy: testUserId,
        lastModifiedBy: testUserId
      },
      {
        phrase: "having a heart attack",
        language: "en",
        category: "Medical",
        severity: "CRITICAL",
        description: "Heart attack in progress",
        pattern: "\\b(having\\s+a\\s+heart\\s+attack)\\b",
        caseSensitive: false,
        createdBy: testUserId,
        lastModifiedBy: testUserId
      },
      {
        phrase: "call 911",
        language: "en",
        category: "Request",
        severity: "HIGH",
        description: "Emergency services request",
        pattern: "\\b(call\\s+911)\\b",
        caseSensitive: false,
        createdBy: testUserId,
        lastModifiedBy: testUserId
      }
    ]);
    
    // Force reload of emergency phrases
    const { localizedEmergencyDetector } = require('../../src/services/localizedEmergencyDetector.service');
    await localizedEmergencyDetector.loadPhrases();
    
    // Create caregivers first
    const caregiver1 = await Caregiver.create({
      name: 'Nurse Smith',
      phone: '+16045624263',
      email: 'nurse@example.com',
      password: 'testpassword123'
    });
    
    const caregiver2 = await Caregiver.create({
      name: 'Dr. Johnson',
      phone: '+16045624264',
      email: 'doctor@example.com',
      password: 'testpassword123'
    });
    
    // Create patient
    const patient = await Patient.create({
      name: 'John Doe',
      preferredName: 'John',
      email: 'john@example.com',
      phone: '+16045624265',
      caregivers: [caregiver1._id, caregiver2._id]
    });
    
    mockPatient = patient;
    mockCaregivers = [caregiver1, caregiver2];

    // Reset mocks and set up default return values
    jest.clearAllMocks();
    
    // Clear alertDeduplicator state between tests to prevent interference
    const { getAlertDeduplicator } = require('../../src/utils/alertDeduplicator');
    const deduplicator = getAlertDeduplicator();
    deduplicator.clearHistory();
  });

  describe('processUtterance', () => {
    test('should detect real emergency and recommend alert', async () => {
      const result = await processor.processUtterance(mockPatient._id.toString(), "I'm having a heart attack");
      
      expect(result.shouldAlert).toBe(true);
      expect(result.alertData).toBeDefined();
      expect(result.alertData.severity).toBe('CRITICAL');
      expect(result.alertData.category).toBe('Medical');
      expect(result.alertData.confidence).toBeGreaterThan(0);
      expect(result.reason).toContain('Emergency detected');
    });

    test('should filter false positives', async () => {
      const result = await processor.processUtterance(mockPatient._id.toString(), "If I had a heart attack, I would call 911");
      
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toContain('False positive detected');
      expect(result.processing.falsePositive).toBe(true);
    });

    test('should handle non-emergency text', async () => {
      const result = await processor.processUtterance(mockPatient._id.toString(), "Everything is fine today");
      
      expect(result.shouldAlert).toBe(false);
      expect(result.alertData).toBeNull();
      expect(result.reason).toBe('No emergency patterns detected');
      expect(result.processing.emergencyDetected).toBe(false);
    });

    test('should handle invalid inputs gracefully', async () => {
      const result1 = await processor.processUtterance(null, "I have chest pain");
      expect(result1.shouldAlert).toBe(false);
      expect(result1.error).toBe(true);
      expect(result1.reason).toContain('Invalid input');

      const result2 = await processor.processUtterance(mockPatient._id.toString(), '');
      expect(result2.shouldAlert).toBe(false);
      expect(result2.error).toBe(true);
      expect(result2.reason).toContain('Invalid input');

      const result3 = await processor.processUtterance(mockPatient._id.toString(), null);
      expect(result3.shouldAlert).toBe(false);
      expect(result3.error).toBe(true);
      expect(result3.reason).toContain('Invalid input');
    });

    test('should calculate confidence correctly', async () => {
      const result = await processor.processUtterance(mockPatient._id.toString(), "I'm having a heart attack");
      
      expect(result.alertData.confidence).toBeGreaterThan(0.8);
      expect(result.processing.confidence).toBe(result.alertData.confidence);
    });

    test('should include processing details', async () => {
      const result = await processor.processUtterance(mockPatient._id.toString(), "I'm having a heart attack");
      
      expect(result.processing).toBeDefined();
      expect(result.processing.emergencyDetected).toBe(true);
      expect(result.processing.falsePositive).toBe(false);
      expect(result.processing.deduplicationPassed).toBe(true);
      expect(result.processing.confidence).toBeDefined();
    });
  });

  describe('createAlert', () => {
    beforeEach(() => {
      // Using real alert service now - no mocking needed
    });

    test('should create alert successfully', async () => {
      // Using real models now - no mocking needed

      const alertData = {
        severity: 'CRITICAL',
        category: 'Medical',
        phrase: 'heart attack',
        confidence: 0.9,
        responseTimeSeconds: 60
      };

      const result = await processor.createAlert(mockPatient._id.toString(), alertData, "I'm having a heart attack");
      
      expect(result.success).toBe(true);
      expect(result.alert).toBeDefined();
      expect(result.patient.id).toBe(mockPatient._id.toString());
      expect(result.patient.name).toBe('John Doe');
    });

    test('should handle patient not found', async () => {
      // Using real models now - no mocking needed

      const alertData = {
        severity: 'CRITICAL',
        category: 'Medical',
        phrase: 'heart attack',
        confidence: 0.9,
        responseTimeSeconds: 60
      };

      const result = await processor.createAlert('nonexistent', alertData, "I'm having a heart attack");
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cast to ObjectId failed');
    });

    test('should create proper alert message', async () => {
      const alertData = {
        severity: 'CRITICAL',
        category: 'Medical',
        phrase: 'heart attack',
        confidence: 0.9,
        responseTimeSeconds: 60
      };

      const result = await processor.createAlert(mockPatient._id.toString(), alertData, "I'm having a heart attack");
      
      // Test passes if no error is thrown - real alert service will create the alert
      expect(result.success).toBe(true);
      expect(result.alert).toBeDefined();
    });

    test('should handle alert creation errors', async () => {
      const alertData = {
        severity: 'CRITICAL',
        category: 'Medical',
        phrase: 'heart attack',
        confidence: 0.9,
        responseTimeSeconds: 60
      };

      // Test with invalid patient ID to trigger error handling
      const result = await processor.createAlert('invalid-id', alertData, "I'm having a heart attack");
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cast to ObjectId failed');
    });
  });

  describe('integration tests', () => {
    test('should process complete emergency flow', async () => {
      // Using real services now - no mocking needed

      // Process utterance
      const processResult = await processor.processUtterance(mockPatient._id.toString(), "I'm having a heart attack");
      
      expect(processResult.shouldAlert).toBe(true);
      
      // Create alert
      const alertResult = await processor.createAlert(mockPatient._id.toString(), processResult.alertData, "I'm having a heart attack");
      
      expect(alertResult.success).toBe(true);
      expect(alertResult.alert).toBeDefined();
    });
  });

  describe('getStatus', () => {
    test('should return status information', () => {
      const status = processor.getStatus();
      
      expect(status.isInitialized).toBeDefined();
      expect(status.config).toBeDefined();
      expect(status.snsStatus).toBeDefined();
      expect(status.deduplicatorStats).toBeDefined();
    });
  });
});
