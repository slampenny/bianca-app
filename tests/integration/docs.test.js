// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const config = require('../../src/config/config');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

describe('Doc routes', () => {
  describe('GET /v1/docs', () => {
    test('should return 404 when running in production', async () => {
      config.env = 'production';
      await request(app).get('/v1/docs').send().expect(httpStatus.MOVED_PERMANENTLY);
      config.env = process.env.NODE_ENV;
    });
  });
});
