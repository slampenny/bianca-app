// src/services/__tests__/emergencyProcessor.test.js

const { EmergencyProcessor } = require('../emergencyProcessor.service');
const { detectEmergency } = require('../../utils/emergencyDetector');

// Mock dependencies
jest.mock('../../models', () => ({
  Patient: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn()
  },
  Caregiver: {
    findById: jest.fn()
  }
}));

jest.mock('../alert.service', () => ({
  createAlert: jest.fn()
}));

jest.mock('../../utils/alertDeduplicator', () => ({
  alertDeduplicator: {
    shouldAlert: jest.fn(),
    recordAlert: jest.fn()
  }
}));

jest.mock('../sns.service', () => ({
  snsService: {
    testConnectivity: jest.fn(),
    sendEmergencyAlert: jest.fn(),
    getStatus: jest.fn()
  }
}));

jest.mock('../../config/emergency.config', () => ({
  config: {
    enableFalsePositiveFilter: true,
    enableAlertsAPI: true,
    enableSNSPushNotifications: false,
    logging: {
      logAllDetections: false,
      logFalsePositives: true,
      logAlertDecisions: true
    },
    confidence: {
      baseConfidence: 0.8,
      severityMultiplier: {
        CRITICAL: 1.2,
        HIGH: 1.0,
        MEDIUM: 0.8
      },
      categoryMultiplier: {
        Medical: 1.1,
        Safety: 1.0,
        Physical: 0.9,
        Request: 0.8
      }
    },
    severityResponseTimes: {
      CRITICAL: 60,
      HIGH: 300,
      MEDIUM: 900
    }
  }
}));

describe('Emergency Processor', () => {
  let processor;
  let mockPatient;
  let mockCaregivers;

  beforeEach(() => {
    processor = new EmergencyProcessor();
    
    mockPatient = {
      _id: 'patient123',
      name: 'John Doe',
      preferredName: 'John',
      caregivers: ['caregiver1', 'caregiver2']
    };

    mockCaregivers = [
      { _id: 'caregiver1', name: 'Nurse Smith', phone: '+1234567890' },
      { _id: 'caregiver2', name: 'Dr. Johnson', phone: '+1987654321' }
    ];

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('processUtterance', () => {
    test('should detect real emergency and recommend alert', async () => {
      const result = await processor.processUtterance('patient123', "I'm having a heart attack");
      
      expect(result.shouldAlert).toBe(true);
      expect(result.alertData).toBeDefined();
      expect(result.alertData.severity).toBe('CRITICAL');
      expect(result.alertData.category).toBe('Medical');
      expect(result.alertData.confidence).toBeGreaterThan(0);
      expect(result.reason).toContain('Emergency detected');
    });

    test('should filter false positives', async () => {
      const result = await processor.processUtterance('patient123', "If I had a heart attack, I would call 911");
      
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toContain('False positive detected');
      expect(result.processing.falsePositive).toBe(true);
    });

    test('should handle non-emergency text', async () => {
      const result = await processor.processUtterance('patient123', "Everything is fine today");
      
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

      const result2 = await processor.processUtterance('patient123', '');
      expect(result2.shouldAlert).toBe(false);
      expect(result2.error).toBe(true);
      expect(result2.reason).toContain('Invalid input');

      const result3 = await processor.processUtterance('patient123', null);
      expect(result3.shouldAlert).toBe(false);
      expect(result3.error).toBe(true);
      expect(result3.reason).toContain('Invalid input');
    });

    test('should calculate confidence correctly', async () => {
      const result = await processor.processUtterance('patient123', "I'm having a heart attack");
      
      expect(result.alertData.confidence).toBeGreaterThan(0.8);
      expect(result.processing.confidence).toBe(result.alertData.confidence);
    });

    test('should include processing details', async () => {
      const result = await processor.processUtterance('patient123', "I'm having a heart attack");
      
      expect(result.processing).toBeDefined();
      expect(result.processing.emergencyDetected).toBe(true);
      expect(result.processing.falsePositive).toBe(false);
      expect(result.processing.deduplicationPassed).toBe(true);
      expect(result.processing.confidence).toBeDefined();
    });
  });

  describe('createAlert', () => {
    beforeEach(() => {
      const { Patient, Caregiver } = require('../../models');
      Patient.findById.mockResolvedValue(mockPatient);
      Patient.findById.mockImplementation(() => ({
        populate: jest.fn().mockResolvedValue({
          ...mockPatient,
          caregivers: mockCaregivers
        })
      }));

      const alertService = require('../alert.service');
      alertService.createAlert.mockResolvedValue({
        _id: 'alert123',
        message: 'Test alert',
        importance: 'urgent'
      });
    });

    test('should create alert successfully', async () => {
      const alertData = {
        severity: 'CRITICAL',
        category: 'Medical',
        phrase: 'heart attack',
        confidence: 0.9,
        responseTimeSeconds: 60
      };

      const result = await processor.createAlert('patient123', alertData, "I'm having a heart attack");
      
      expect(result.success).toBe(true);
      expect(result.alert).toBeDefined();
      expect(result.patient.id).toBe('patient123');
      expect(result.patient.name).toBe('John Doe');
    });

    test('should handle patient not found', async () => {
      const { Patient } = require('../../models');
      Patient.findById.mockResolvedValue(null);

      const alertData = {
        severity: 'CRITICAL',
        category: 'Medical',
        phrase: 'heart attack',
        confidence: 0.9,
        responseTimeSeconds: 60
      };

      const result = await processor.createAlert('nonexistent', alertData, "I'm having a heart attack");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Patient not found');
    });

    test('should create proper alert message', async () => {
      const alertData = {
        severity: 'CRITICAL',
        category: 'Medical',
        phrase: 'heart attack',
        confidence: 0.9,
        responseTimeSeconds: 60
      };

      await processor.createAlert('patient123', alertData, "I'm having a heart attack");
      
      const alertService = require('../alert.service');
      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('🚨 CRITICAL Medical Emergency'),
          message: expect.stringContaining('John'),
          message: expect.stringContaining('heart attack'),
          importance: 'urgent',
          alertType: 'patient',
          relatedPatient: 'patient123',
          visibility: 'assignedCaregivers'
        })
      );
    });

    test('should handle alert creation errors', async () => {
      const alertService = require('../alert.service');
      alertService.createAlert.mockRejectedValue(new Error('Database error'));

      const alertData = {
        severity: 'CRITICAL',
        category: 'Medical',
        phrase: 'heart attack',
        confidence: 0.9,
        responseTimeSeconds: 60
      };

      const result = await processor.createAlert('patient123', alertData, "I'm having a heart attack");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('integration tests', () => {
    test('should process complete emergency flow', async () => {
      const { Patient, Caregiver } = require('../../models');
      Patient.findById.mockResolvedValue(mockPatient);
      Patient.findById.mockImplementation(() => ({
        populate: jest.fn().mockResolvedValue({
          ...mockPatient,
          caregivers: mockCaregivers
        })
      }));

      const alertService = require('../alert.service');
      alertService.createAlert.mockResolvedValue({
        _id: 'alert123',
        message: 'Test alert',
        importance: 'urgent'
      });

      // Process utterance
      const processResult = await processor.processUtterance('patient123', "I'm having a heart attack");
      
      expect(processResult.shouldAlert).toBe(true);
      
      // Create alert
      const alertResult = await processor.createAlert('patient123', processResult.alertData, "I'm having a heart attack");
      
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
