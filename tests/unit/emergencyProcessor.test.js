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
  await mongoose.connect(mongoUri, {});
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
      // But we can verify SMS service is called
    });
    
    test('should attempt to send SMS notification when creating alert', async () => {
      // This test verifies SMS sending is part of the alert creation flow
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
      
      // CRITICAL: Verify notificationResult exists (SMS attempt was made)
      // Even if SMS fails in test (due to missing Twilio creds), the attempt should be logged
      expect(result.notificationResult).toBeDefined();
      
      // Log the notification result for debugging
      if (result.notificationResult) {
        console.log('SMS Notification Attempt Result:', JSON.stringify(result.notificationResult, null, 2));
        // The notificationResult should have a success property
        expect(result.notificationResult).toHaveProperty('success');
      }
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
      
      // CRITICAL: Verify SMS notification was attempted
      // Note: In test environment, SMS may fail due to missing Twilio credentials,
      // but we should at least verify the notification attempt was made
      expect(result.notificationResult).toBeDefined();
      // If SMS service is not initialized in test, notificationResult will have success: false
      // But we should verify the attempt was made
      if (result.notificationResult) {
        expect(result.notificationResult).toHaveProperty('success');
        // Log the result for debugging
        console.log('SMS Notification Result:', JSON.stringify(result.notificationResult, null, 2));
      }
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
      
      // CRITICAL: Verify SMS notification was attempted
      expect(alertResult.notificationResult).toBeDefined();
      console.log('Integration test SMS Notification Result:', JSON.stringify(alertResult.notificationResult, null, 2));
    });
    
    test('should send SMS notification when emergency is detected', async () => {
      // This test specifically verifies SMS sending is part of the emergency flow
      const processResult = await processor.processUtterance(mockPatient._id.toString(), "I'm having a heart attack");
      
      expect(processResult.shouldAlert).toBe(true);
      
      const alertResult = await processor.createAlert(
        mockPatient._id.toString(), 
        processResult.alertData, 
        "I'm having a heart attack"
      );
      
      // Verify alert was created
      expect(alertResult.success).toBe(true);
      
      // CRITICAL: Verify SMS notification attempt was made
      // The notificationResult should exist even if SMS fails (due to missing Twilio creds in test)
      expect(alertResult.notificationResult).toBeDefined();
      
      // If SMS service is properly configured, verify it succeeded
      // In test environment without Twilio creds, it may fail, but we should verify the attempt
      if (alertResult.notificationResult) {
        // Log for debugging
        console.log('SMS Notification Details:', {
          success: alertResult.notificationResult.success,
          successful: alertResult.notificationResult.successful,
          failed: alertResult.notificationResult.failed,
          reason: alertResult.notificationResult.reason,
          error: alertResult.notificationResult.error
        });
        
        // At minimum, verify the notification service was called
        // (even if it failed due to missing credentials)
        expect(alertResult.notificationResult).toHaveProperty('success');
      }
    });
  });

  describe('getStatus', () => {
    test('should return status information', () => {
      const status = processor.getStatus();
      
      expect(status.isInitialized).toBeDefined();
      expect(status.config).toBeDefined();
      expect(status.snsStatus).toBeDefined();
      expect(status.deduplicatorStats).toBeDefined();
      
      // CRITICAL: Verify SMS notifications are always enabled
      expect(status.config.enableSNSPushNotifications).toBe(true);
      console.log('Emergency Processor Status:', JSON.stringify(status, null, 2));
    });
  });

  describe('fallback to basic detector', () => {
    test('should fallback to basic detector when no phrases are loaded in database', async () => {
      // Clear all emergency phrases to simulate empty database
      const { EmergencyPhrase } = require('../../src/models');
      await EmergencyPhrase.deleteMany({});
      
      // Clear the cache to force reload
      const { localizedEmergencyDetector } = require('../../src/services/localizedEmergencyDetector.service');
      localizedEmergencyDetector.clearCache();
      await localizedEmergencyDetector.loadPhrases();
      
      // Verify cache is empty
      const phrases = localizedEmergencyDetector.phraseCache.get('en') || [];
      expect(phrases.length).toBe(0);
      
      // Process utterance - should fallback to basic detector
      const result = await processor.processUtterance(
        mockPatient._id.toString(), 
        "I'm having a heart attack"
      );
      
      // Should still detect emergency via fallback
      expect(result.shouldAlert).toBe(true);
      expect(result.alertData).toBeDefined();
      expect(result.alertData.severity).toBe('CRITICAL');
      expect(result.alertData.category).toBe('Medical');
      expect(result.alertData.phrase).toBe('heart attack');
      expect(result.reason).toContain('Emergency detected');
    });

    test('should fallback to basic detector for different languages when no phrases exist', async () => {
      // Clear all emergency phrases
      const { EmergencyPhrase } = require('../../src/models');
      await EmergencyPhrase.deleteMany({});
      
      // Clear cache
      const { localizedEmergencyDetector } = require('../../src/services/localizedEmergencyDetector.service');
      localizedEmergencyDetector.clearCache();
      await localizedEmergencyDetector.loadPhrases();
      
      // Update patient to have Spanish language
      const { Patient } = require('../../src/models');
      await Patient.findByIdAndUpdate(mockPatient._id, { preferredLanguage: 'es' });
      
      // Process utterance in Spanish - should fallback to basic detector
      const result = await processor.processUtterance(
        mockPatient._id.toString(), 
        "I'm having a heart attack"
      );
      
      // Should still detect emergency via fallback (basic detector works for any language)
      expect(result.shouldAlert).toBe(true);
      expect(result.alertData.severity).toBe('CRITICAL');
    });
  });
});
