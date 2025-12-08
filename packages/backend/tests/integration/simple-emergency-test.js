// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const { EmergencyPhrase } = require('../../src/models');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Simple Emergency Test', () => {
  beforeEach(async () => {
    await EmergencyPhrase.deleteMany();
  });

  afterEach(async () => {
    await EmergencyPhrase.deleteMany();
  });

  test('should create emergency phrase directly', async () => {
    const phrase = await EmergencyPhrase.create({
      phrase: 'heart attack',
      language: 'en',
      severity: 'CRITICAL',
      category: 'Medical',
      pattern: '\\b(heart\\s+attack|heartattack)\\b',
      createdBy: '000000000000000000000000',
      lastModifiedBy: '000000000000000000000000'
    });

    expect(phrase.phrase).toBe('heart attack');
    expect(phrase.language).toBe('en');
    expect(phrase.severity).toBe('CRITICAL');
  });

  test('should test localized detector directly', async () => {
    // Create test phrase
    await EmergencyPhrase.create({
      phrase: 'heart attack',
      language: 'en',
      severity: 'CRITICAL',
      category: 'Medical',
      pattern: '\\b(heart\\s+attack|heartattack)\\b',
      createdBy: '000000000000000000000000',
      lastModifiedBy: '000000000000000000000000'
    });

    const { localizedEmergencyDetector } = require('../../src/services/localizedEmergencyDetector.service');
    
    const result = await localizedEmergencyDetector.detectEmergency(
      'I think I am having a heart attack',
      'en'
    );

    console.log('Detection result:', result);
    expect(result.isEmergency).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    expect(result.category).toBe('Medical');
    expect(result.phrase).toBe('heart attack');
  });
});
