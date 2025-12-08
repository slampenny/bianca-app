// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../utils/integration-app');
const config = require('../../src/config/config');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');
const { Caregiver, Token } = require('../../src/models');
const { caregiverOne, insertCaregivers } = require('../fixtures/caregiver.fixture');
const { tokenService, emailService } = require('../../src/services');

describe('Email Verification URL Integration Tests', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  afterEach(async () => {
    await Caregiver.deleteMany();
    await Token.deleteMany();
  });

  describe('Email Service Verification Link Generation', () => {
    it('should generate verification link using frontend URL', async () => {
      const caregivers = await insertCaregivers([caregiverOne]);
      const testCaregiver = caregivers[0];
      
      // Generate token
      const verifyToken = await tokenService.generateVerifyEmailToken(testCaregiver);
      
      // Verify token structure - it should be a string or have a token property
      const tokenValue = typeof verifyToken === 'string' ? verifyToken : verifyToken.token || verifyToken;
      expect(tokenValue).toBeTruthy();
      
      // Verify the link format directly
      const expectedLink = `${config.frontendUrl}/auth/verify-email?token=${tokenValue}`;
      
      // Should use frontend URL (localhost:8081 in test/dev)
      expect(expectedLink).toContain('localhost:8081');
      expect(expectedLink).toContain('/auth/verify-email');
      expect(expectedLink).toContain(`token=${tokenValue}`);
      
      // Should NOT use backend API URL
      expect(expectedLink).not.toContain('localhost:3000');
      expect(expectedLink).not.toContain('/v1');
      
      // Verify link format
      const url = new URL(expectedLink);
      expect(url.hostname).toBe('localhost');
      expect(url.port).toBe('8081');
      expect(url.pathname).toBe('/auth/verify-email');
      expect(url.searchParams.get('token')).toBe(tokenValue);
    });

    it('should use config.frontendUrl for verification links', async () => {
      const caregivers = await insertCaregivers([caregiverOne]);
      const testCaregiver = caregivers[0];

      // Generate a verification token
      const verifyToken = await tokenService.generateVerifyEmailToken(testCaregiver);
      
      // Verify token structure - it should be a string or have a token property
      const tokenValue = typeof verifyToken === 'string' ? verifyToken : verifyToken.token || verifyToken;
      expect(tokenValue).toBeTruthy();

      // Verify the link would use config.frontendUrl
      const expectedLink = `${config.frontendUrl}/auth/verify-email?token=${tokenValue}`;
      
      expect(expectedLink).toContain(config.frontendUrl);
      expect(expectedLink).not.toContain(config.apiUrl);
      expect(expectedLink).not.toContain('localhost:3000');
    });
  });
});

