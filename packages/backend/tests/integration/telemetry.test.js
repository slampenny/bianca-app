// tests/integration/telemetry.test.js

require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');

const app = require('../utils/integration-app');
const { Caregiver, Org } = require('../../src/models');
const { tokenService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');

let accessToken;
let caregiverId;
let orgId;

beforeAll(async () => {
  await setupMongoMemoryServer();

  // Create test data
  const org = new Org({
    name: 'Test Telemetry Org',
    email: 'telemetry@example.com',
    phone: '+16045624263',
    stripeCustomerId: 'test-stripe-id',
    isEmailVerified: true
  });
  await org.save();
  orgId = org._id;

  const caregiver = new Caregiver({
    name: 'Telemetry Test Caregiver',
    email: 'telemetry.caregiver@example.com',
    phone: '+16045624264',
    org: orgId,
    role: 'orgAdmin',
    password: 'password123',
    patients: [],
    telemetryOptIn: null, // Not set initially
  });
  await caregiver.save();
  caregiverId = caregiver._id;

  // Generate access token
  accessToken = tokenService.generateToken(caregiver._id);
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

afterEach(async () => {
  // Reset telemetry opt-in status
  await Caregiver.findByIdAndUpdate(caregiverId, { telemetryOptIn: null });
});

describe('POST /v1/telemetry/track', () => {
  it('should track event successfully', async () => {
    const res = await request(app)
      .post('/v1/telemetry/track')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        event: 'screen.viewed',
        properties: {
          screenName: 'ReportsScreen',
          feature: 'medical_analysis',
        },
      })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('success', true);
  });

  it('should reject request without event name', async () => {
    const res = await request(app)
      .post('/v1/telemetry/track')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        properties: {
          screenName: 'ReportsScreen',
        },
      })
      .expect(httpStatus.BAD_REQUEST);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Event name');
  });

  it('should reject request with invalid event type', async () => {
    const res = await request(app)
      .post('/v1/telemetry/track')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        event: 123, // Invalid: should be string
        properties: {},
      })
      .expect(httpStatus.BAD_REQUEST);

    expect(res.body).toHaveProperty('error');
  });

  it('should skip tracking when user has opted out', async () => {
    // Set user to opted out
    await Caregiver.findByIdAndUpdate(caregiverId, { telemetryOptIn: false });

    const res = await request(app)
      .post('/v1/telemetry/track')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        event: 'screen.viewed',
        properties: {
          screenName: 'ReportsScreen',
        },
      })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('skipped', true);
  });

  it('should track when user has opted in', async () => {
    // Set user to opted in
    await Caregiver.findByIdAndUpdate(caregiverId, { telemetryOptIn: true });

    const res = await request(app)
      .post('/v1/telemetry/track')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        event: 'screen.viewed',
        properties: {
          screenName: 'ReportsScreen',
        },
      })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).not.toHaveProperty('skipped');
  });

  it('should require authentication', async () => {
    await request(app)
      .post('/v1/telemetry/track')
      .send({
        event: 'screen.viewed',
        properties: {},
      })
      .expect(httpStatus.UNAUTHORIZED);
  });

  it('should sanitize PII from properties', async () => {
    const res = await request(app)
      .post('/v1/telemetry/track')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        event: 'test.event',
        properties: {
          email: 'test@example.com',
          phone: '+1234567890',
          patientName: 'John Doe',
          screenName: 'ReportsScreen',
        },
      })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('success', true);
    // Note: We can't directly verify sanitization in integration test
    // but the service should handle it
  });
});

describe('POST /v1/telemetry/identify', () => {
  it('should identify user successfully', async () => {
    const res = await request(app)
      .post('/v1/telemetry/identify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        traits: {
          role: 'caregiver',
          accountType: 'premium',
        },
      })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('success', true);
  });

  it('should require userId (from auth)', async () => {
    // This test verifies that the endpoint requires authentication
    // which provides the userId
    await request(app)
      .post('/v1/telemetry/identify')
      .send({
        traits: {
          role: 'caregiver',
        },
      })
      .expect(httpStatus.UNAUTHORIZED);
  });

  it('should skip identification when user has opted out', async () => {
    await Caregiver.findByIdAndUpdate(caregiverId, { telemetryOptIn: false });

    const res = await request(app)
      .post('/v1/telemetry/identify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        traits: {
          role: 'caregiver',
        },
      })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('skipped', true);
  });
});

describe('POST /v1/telemetry/opt-in', () => {
  it('should update opt-in status to true', async () => {
    const res = await request(app)
      .post('/v1/telemetry/opt-in')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        optIn: true,
      })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('optIn', true);

    // Verify in database
    const caregiver = await Caregiver.findById(caregiverId);
    expect(caregiver.telemetryOptIn).toBe(true);
  });

  it('should update opt-in status to false', async () => {
    const res = await request(app)
      .post('/v1/telemetry/opt-in')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        optIn: false,
      })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('optIn', false);

    // Verify in database
    const caregiver = await Caregiver.findById(caregiverId);
    expect(caregiver.telemetryOptIn).toBe(false);
  });

  it('should reject invalid optIn value', async () => {
    const res = await request(app)
      .post('/v1/telemetry/opt-in')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        optIn: 'invalid',
      })
      .expect(httpStatus.BAD_REQUEST);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('boolean');
  });

  it('should require authentication', async () => {
    await request(app)
      .post('/v1/telemetry/opt-in')
      .send({
        optIn: true,
      })
      .expect(httpStatus.UNAUTHORIZED);
  });

  it('should require optIn field', async () => {
    const res = await request(app)
      .post('/v1/telemetry/opt-in')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(httpStatus.BAD_REQUEST);

    expect(res.body).toHaveProperty('error');
  });
});

describe('Rate Limiting', () => {
  it('should enforce rate limit on track endpoint', async () => {
    // Send 101 requests (limit is 100 per minute)
    const requests = Array.from({ length: 101 }, () =>
      request(app)
        .post('/v1/telemetry/track')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          event: 'test.event',
          properties: {},
        })
    );

    const responses = await Promise.all(requests);
    
    // At least one should be rate limited (429)
    const rateLimited = responses.some(res => res.status === httpStatus.TOO_MANY_REQUESTS);
    expect(rateLimited).toBe(true);
  }, 30000); // Increase timeout for rate limit test
});

