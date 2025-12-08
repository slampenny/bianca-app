// tests/unit/telemetry.service.test.js
// Unit tests for telemetry service

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Mock PostHog before requiring the service
const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockShutdown = jest.fn();

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    identify: mockIdentify,
    shutdown: mockShutdown,
  })),
}));

// Mock logger
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCapture.mockClear();
  mockIdentify.mockClear();
  mockShutdown.mockClear();
  // Set up test environment
  process.env.TELEMETRY_ENABLED = 'true';
  process.env.POSTHOG_API_KEY = 'test-api-key';
  process.env.POSTHOG_HOST = 'http://localhost:8000';
  process.env.NODE_ENV = 'test';
});

describe('Telemetry Service', () => {
  // Test sanitization function directly by accessing it through the module
  describe('PII Sanitization', () => {
    let telemetryService;
    let sanitizeProperties;

    beforeEach(() => {
      jest.resetModules();
      telemetryService = require('../../src/services/telemetry.service');
      // Access the sanitize function through the service's internal implementation
      // We'll test it indirectly through the track method
    });

    it('should remove email from properties', async () => {
      const properties = {
        email: 'test@example.com',
        screenName: 'ReportsScreen',
        action: 'viewed',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.email).toBeUndefined();
      expect(callArgs.properties.screenName).toBe('ReportsScreen');
    });

    it('should remove phone from properties', async () => {
      const properties = {
        phone: '+1234567890',
        feature: 'reports',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.phone).toBeUndefined();
      expect(callArgs.properties.feature).toBe('reports');
    });

    it('should remove patientName from properties', async () => {
      const properties = {
        patientName: 'John Doe',
        reportType: 'medical',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.patientName).toBeUndefined();
      expect(callArgs.properties.reportType).toBe('medical');
    });

    it('should remove patientId from properties', async () => {
      const properties = {
        patientId: '507f1f77bcf86cd799439011',
        action: 'viewed',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.patientId).toBeUndefined();
    });

    it('should remove conversationContent from properties', async () => {
      const properties = {
        conversationContent: 'Patient said: I feel unwell',
        screenName: 'ConversationScreen',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.conversationContent).toBeUndefined();
    });

    it('should remove medicalData from properties', async () => {
      const properties = {
        medicalData: { diagnosis: 'diabetes', medication: 'insulin' },
        reportType: 'medical',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.medicalData).toBeUndefined();
    });

    it('should remove nested PII from objects', async () => {
      const properties = {
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
        screenName: 'ReportsScreen',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.user).toBeUndefined();
      expect(callArgs.properties.screenName).toBe('ReportsScreen');
    });

    it('should hash sensitive fields', async () => {
      const properties = {
        userId: 'user123',
        sessionId: 'session456',
        ipAddress: '192.168.1.1',
        screenName: 'ReportsScreen',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.userId).toMatch(/^hashed_\d+_\d+$/);
      expect(callArgs.properties.sessionId).toMatch(/^hashed_\d+_\d+$/);
      expect(callArgs.properties.ipAddress).toMatch(/^hashed_\d+_\d+$/);
    });

    it('should preserve non-PII fields', async () => {
      const properties = {
        screenName: 'ReportsScreen',
        feature: 'fraud_abuse_analysis',
        action: 'opened',
        platform: 'web',
        version: '1.0.0',
      };

      await telemetryService.track('user123', 'test.event', properties);

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.screenName).toBe('ReportsScreen');
      expect(callArgs.properties.feature).toBe('fraud_abuse_analysis');
      expect(callArgs.properties.action).toBe('opened');
      expect(callArgs.properties.platform).toBe('web');
      expect(callArgs.properties.version).toBe('1.0.0');
    });

    it('should handle empty properties', async () => {
      await telemetryService.track('user123', 'test.event', {});

      expect(mockCapture).toHaveBeenCalled();
      const callArgs = mockCapture.mock.calls[0][0];
      expect(callArgs.properties.timestamp).toBeDefined();
      expect(callArgs.properties.environment).toBeDefined();
    });

    it('should handle null properties', async () => {
      await telemetryService.track('user123', 'test.event', null);

      expect(mockCapture).toHaveBeenCalled();
    });
  });

  describe('Event Tracking', () => {
    let telemetryService;

    beforeEach(() => {
      jest.resetModules();
      telemetryService = require('../../src/services/telemetry.service');
    });

    it('should track event with sanitized properties', async () => {
      const properties = {
        screenName: 'ReportsScreen',
        feature: 'medical_analysis',
      };

      await telemetryService.track('user123', 'screen.viewed', properties);

      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: 'user123',
        event: 'screen.viewed',
        properties: expect.objectContaining({
          screenName: 'ReportsScreen',
          feature: 'medical_analysis',
          timestamp: expect.any(String),
          environment: expect.any(String),
        }),
      });
    });

    it('should track anonymous events', async () => {
      await telemetryService.track(null, 'session.started', {});

      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: 'anonymous',
        event: 'session.started',
        properties: expect.any(Object),
      });
    });

    it('should not track when telemetry is disabled', async () => {
      process.env.TELEMETRY_ENABLED = 'false';
      jest.resetModules();
      const disabledService = require('../../src/services/telemetry.service');

      await disabledService.track('user123', 'test.event', {});

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe('User Identification', () => {
    let telemetryService;

    beforeEach(() => {
      jest.resetModules();
      telemetryService = require('../../src/services/telemetry.service');
    });

    it('should identify user with sanitized traits', async () => {
      const traits = {
        email: 'test@example.com', // Should be removed
        role: 'caregiver',
        accountType: 'premium',
      };

      await telemetryService.identify('user123', traits);

      expect(mockIdentify).toHaveBeenCalledWith({
        distinctId: 'user123',
        properties: expect.objectContaining({
          role: 'caregiver',
          accountType: 'premium',
        }),
      });
      const callArgs = mockIdentify.mock.calls[0][0];
      expect(callArgs.properties.email).toBeUndefined();
    });

    it('should not identify when userId is missing', async () => {
      await telemetryService.identify(null, {});

      expect(mockIdentify).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    let telemetryService;

    beforeEach(() => {
      jest.resetModules();
      telemetryService = require('../../src/services/telemetry.service');
    });

    it('should handle PostHog errors gracefully', async () => {
      mockCapture.mockImplementation(() => {
        throw new Error('PostHog error');
      });

      // Should not throw
      await expect(telemetryService.track('user123', 'test.event', {})).resolves.not.toThrow();
    });

    it('should handle missing PostHog configuration', async () => {
      delete process.env.POSTHOG_API_KEY;
      process.env.TELEMETRY_ENABLED = 'false';
      jest.resetModules();
      const serviceWithoutConfig = require('../../src/services/telemetry.service');

      // Should not throw
      await expect(serviceWithoutConfig.track('user123', 'test.event', {})).resolves.not.toThrow();
    });
  });
});
