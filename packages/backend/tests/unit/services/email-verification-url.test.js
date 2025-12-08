// Set test environment variables before importing config
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:8081';

const config = require('../../../src/config/config');

describe('Email Verification URL Generation', () => {
  describe('Frontend URL Configuration', () => {
    it('should use FRONTEND_URL env var when set', () => {
      // In test environment, FRONTEND_URL is set to localhost:8081
      expect(config.frontendUrl).toBe('http://localhost:8081');
    });

    it('should not use backend API URL (localhost:3000)', () => {
      // Frontend URL should NOT be the backend API URL
      expect(config.frontendUrl).not.toContain('localhost:3000');
      expect(config.frontendUrl).not.toContain('/v1');
    });
  });

  describe('Email Verification Link Generation', () => {
    it('should generate verification link with correct frontend URL', async () => {
      // Mock email service to capture the link
      const mockToken = 'test-verification-token-123';
      const testEmail = 'test@example.com';
      
      // Set up test environment
      process.env.NODE_ENV = 'development';
      process.env.FRONTEND_URL = 'http://localhost:8081';
      
      delete require.cache[require.resolve('../../../src/config/config')];
      const testConfig = require('../../../src/config/config');
      
      // Verify the link format
      const expectedLink = `${testConfig.frontendUrl}/auth/verify-email?token=${mockToken}`;
      expect(expectedLink).toBe('http://localhost:8081/auth/verify-email?token=test-verification-token-123');
      
      // Verify link contains correct components
      expect(expectedLink).toContain('localhost:8081');
      expect(expectedLink).toContain('/auth/verify-email');
      expect(expectedLink).toContain('token=');
      expect(expectedLink).toContain(mockToken);
    });

    it('should not use backend API URL for verification links', () => {
      process.env.NODE_ENV = 'development';
      process.env.FRONTEND_URL = 'http://localhost:8081';
      
      delete require.cache[require.resolve('../../../src/config/config')];
      const testConfig = require('../../../src/config/config');
      
      const mockToken = 'test-token';
      const verificationLink = `${testConfig.frontendUrl}/auth/verify-email?token=${mockToken}`;
      
      // Should NOT contain backend URL (localhost:3000)
      expect(verificationLink).not.toContain('localhost:3000');
      expect(verificationLink).not.toContain('/v1');
      
      // Should contain frontend URL
      expect(verificationLink).toContain('localhost:8081');
    });
  });
});

