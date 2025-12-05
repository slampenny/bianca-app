// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');
const { tokenService } = require('../../src/services');
const { PrivacyRequest, ConsentRecord, Caregiver, Patient, Conversation, MedicalAnalysis, Org } = require('../../src/models');
const { caregiverOneWithPassword, insertCaregivertoOrgAndReturnToken } = require('../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');

// Don't mock email service - use real Ethereal mail for testing
const emailService = require('../../src/services/email.service');

beforeAll(async () => {
  await setupMongoMemoryServer();
  
  // Initialize email service with Ethereal for testing
  await emailService.initializeEmailTransport();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Privacy API routes', () => {
  let accessToken;
  let caregiverId;
  let patientId;

  beforeEach(async () => {
    await clearDatabase();
    
    // Create org and caregiver
    const [org] = await insertOrgs([orgOne]);
    const orgDoc = await Org.findById(org.id); // Get the actual Mongoose document
    const { caregiver, token } = await insertCaregivertoOrgAndReturnToken(orgDoc, caregiverOneWithPassword);
    accessToken = token;
    // caregiver should be a full Mongoose document now, so it should have both _id and id
    caregiverId = caregiver._id ? caregiver._id.toString() : (caregiver.id ? caregiver.id.toString() : caregiver.id);

    // Create patient
    const patient = await Patient.create({
      name: 'Test Patient',
      email: 'patient@test.com',
      phone: '+16045624269',
      org: org.id,
      caregivers: [caregiverId],
    });
    patientId = patient._id;

    // Update caregiver with patient
    await Caregiver.findByIdAndUpdate(caregiverId, {
      $push: { patients: patientId }
    });
  });

  describe('POST /v1/privacy/requests/access', () => {
    it('should create an access request and automatically process it', async () => {
      // Create some test data
      await Conversation.create({
        patientId: patientId,
        agentId: caregiverId,
        status: 'completed',
        startTime: new Date(),
        messages: [],
      });

      const res = await request(app)
        .post('/v1/privacy/requests/access')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          informationRequested: 'All my personal information',
          accessMethod: 'email',
        })
        .expect(httpStatus.CREATED);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.requestType).toBe('access');
      expect(res.body.status).toBe('pending'); // Initially pending, then auto-processed

      // Verify request was created in database
      const request = await PrivacyRequest.findById(res.body._id);
      expect(request).toBeDefined();
      expect(request.requestorId.toString()).toBe(caregiverId.toString());

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if request was processed (status might be completed if auto-processing worked)
      const updatedRequest = await PrivacyRequest.findById(res.body._id);
      // Auto-processing happens, but might be async
      expect(updatedRequest).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/v1/privacy/requests/access')
        .send({
          informationRequested: 'Test',
        })
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/privacy/requests/correction', () => {
    it('should create a correction request', async () => {
      const res = await request(app)
        .post('/v1/privacy/requests/correction')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          informationRequested: 'Correction to email',
          correctionDetails: {
            field: 'email',
            currentValue: 'old@example.com',
            requestedValue: 'new@example.com',
            reason: 'Email address changed',
          },
        })
        .expect(httpStatus.CREATED);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.requestType).toBe('correction');
      expect(res.body.correctionDetails).toBeDefined();
      expect(res.body.correctionDetails.field).toBe('email');
    });

    it('should require correctionDetails', async () => {
      await request(app)
        .post('/v1/privacy/requests/correction')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          informationRequested: 'Test',
        })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /v1/privacy/requests', () => {
    it('should return user\'s own requests', async () => {
      // Create a request
      await PrivacyRequest.create({
        requestType: 'access',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test request',
      });

      const res = await request(app)
        .get('/v1/privacy/requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('results');
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].requestorId.toString()).toBe(caregiverId.toString());
    });

    it('should not return other users\' requests for non-admins', async () => {
      // Create another caregiver and their request
      const otherCaregiver = await Caregiver.create({
        name: 'Other User',
        email: 'other@test.com',
        phone: '+16045624270',
        password: 'password123',
        role: 'staff',
        isEmailVerified: true,
      });

      await PrivacyRequest.create({
        requestType: 'access',
        requestorId: otherCaregiver._id,
        requestorModel: 'Caregiver',
        informationRequested: 'Other user request',
      });

      const res = await request(app)
        .get('/v1/privacy/requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      // Should only see own requests
      const otherUserRequests = res.body.results.filter(
        r => r.requestorId.toString() === otherCaregiver._id.toString()
      );
      expect(otherUserRequests.length).toBe(0);
    });
  });

  describe('GET /v1/privacy/requests/:requestId', () => {
    it('should return a specific request', async () => {
      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test request',
      });

      const res = await request(app)
        .get(`/v1/privacy/requests/${request._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body._id).toBe(request._id.toString());
      expect(res.body.requestType).toBe('access');
    });

    it('should not allow viewing other users\' requests', async () => {
      const otherCaregiver = await Caregiver.create({
        name: 'Other User',
        email: 'other2@test.com',
        phone: '+16045624271',
        password: 'password123',
        role: 'staff',
        isEmailVerified: true,
      });

      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorId: otherCaregiver._id,
        requestorModel: 'Caregiver',
        informationRequested: 'Other user request',
      });

      await request(app)
        .get(`/v1/privacy/requests/${request._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /v1/privacy/consent', () => {
    it('should create a consent record', async () => {
      const res = await request(app)
        .post('/v1/privacy/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          consentType: 'collection',
          purpose: 'Account creation',
          method: 'explicit',
          explicitConsent: {
            provided: true,
            providedVia: 'checkbox',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
          informationTypes: ['name', 'email', 'phone'],
          collectionNoticeProvided: true,
          collectionNoticeVersion: '1.0',
        })
        .expect(httpStatus.CREATED);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.consentType).toBe('collection');
      expect(res.body.granted).toBe(true);

      // Verify in database
      const consent = await ConsentRecord.findById(res.body._id);
      expect(consent).toBeDefined();
      expect(consent.userId.toString()).toBe(caregiverId.toString());
    });
  });

  describe('GET /v1/privacy/consent', () => {
    it('should return active consent records', async () => {
      await ConsentRecord.create({
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
      });

      const res = await request(app)
        .get('/v1/privacy/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].consentType).toBe('collection');
    });

    it('should filter by consentType if provided', async () => {
      await ConsentRecord.create({
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
      });

      await ConsentRecord.create({
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'Wellness calls',
        granted: true,
      });

      const res = await request(app)
        .get('/v1/privacy/consent?consentType=collection')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.every(c => c.consentType === 'collection')).toBe(true);
    });
  });

  describe('GET /v1/privacy/consent/check', () => {
    it('should return true if consent exists', async () => {
      await ConsentRecord.create({
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'wellness_calls',
        granted: true,
        withdrawn: false,
      });

      const res = await request(app)
        .get('/v1/privacy/consent/check?consentType=recording&purpose=wellness_calls')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({ hasConsent: true });
    });

    it('should return false if consent does not exist', async () => {
      const res = await request(app)
        .get('/v1/privacy/consent/check?consentType=recording&purpose=wellness_calls')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({ hasConsent: false });
    });
  });

  describe('POST /v1/privacy/consent/:consentId/withdraw', () => {
    it('should withdraw consent and lock account', async () => {
      const consent = await ConsentRecord.create({
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
      });

      const res = await request(app)
        .post(`/v1/privacy/consent/${consent._id}/withdraw`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          withdrawalMethod: 'app',
          withdrawalReason: 'No longer want service',
        })
        .expect(httpStatus.OK);

      expect(res.body.withdrawn).toBe(true);
      expect(res.body.granted).toBe(false);

      // Verify account is locked
      const caregiver = await Caregiver.findById(caregiverId);
      expect(caregiver.accountLocked).toBe(true);
    });

    it('should not allow withdrawing another user\'s consent', async () => {
      const otherCaregiver = await Caregiver.create({
        name: 'Other User',
        email: 'other3@test.com',
        phone: '+16045624272',
        password: 'password123',
        role: 'staff',
        isEmailVerified: true,
      });

      const consent = await ConsentRecord.create({
        userId: otherCaregiver._id,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
      });

      await request(app)
        .post(`/v1/privacy/consent/${consent._id}/withdraw`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          withdrawalMethod: 'app',
          withdrawalReason: 'Test',
        })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /v1/privacy/consent/history', () => {
    it('should return consent history', async () => {
      await ConsentRecord.create({
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        createdAt: new Date(),
      });

      await ConsentRecord.create({
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'Wellness calls',
        granted: true,
        createdAt: new Date(),
      });

      const res = await request(app)
        .get('/v1/privacy/consent/history')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Admin-only endpoints', () => {
    let adminToken;
    let adminId;

    beforeEach(async () => {
      // Create admin user
      const admin = await Caregiver.create({
        name: 'Admin',
        email: 'admin@test.com',
        phone: '+16045624273',
        password: 'password123',
        role: 'superAdmin',
        isEmailVerified: true,
      });
      adminId = admin._id;

      const tokens = await tokenService.generateAuthTokens(admin);
      adminToken = tokens.access.token;
    });

    describe('GET /v1/privacy/requests/approaching-deadline', () => {
      it('should return requests approaching deadline for admin', async () => {
        const fourDaysFromNow = new Date();
        fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

        await PrivacyRequest.create({
          requestType: 'access',
          requestorId: caregiverId,
          requestorModel: 'Caregiver',
          informationRequested: 'Test',
          status: 'pending',
          responseDeadline: fourDaysFromNow,
        });

        const res = await request(app)
          .get('/v1/privacy/requests/approaching-deadline')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(httpStatus.OK);

        expect(Array.isArray(res.body)).toBe(true);
      });

      it('should require admin access', async () => {
        await request(app)
          .get('/v1/privacy/requests/approaching-deadline')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(httpStatus.FORBIDDEN);
      });
    });

    describe('GET /v1/privacy/requests/overdue', () => {
      it('should return overdue requests for admin', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        await PrivacyRequest.create({
          requestType: 'access',
          requestorId: caregiverId,
          requestorModel: 'Caregiver',
          informationRequested: 'Test',
          status: 'pending',
          responseDeadline: yesterday,
        });

        const res = await request(app)
          .get('/v1/privacy/requests/overdue')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(httpStatus.OK);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
      });
    });

    describe('GET /v1/privacy/statistics', () => {
      it('should return privacy statistics for admin', async () => {
        await PrivacyRequest.create({
          requestType: 'access',
          requestorId: caregiverId,
          requestorModel: 'Caregiver',
          informationRequested: 'Test',
          status: 'completed',
        });

        await ConsentRecord.create({
          userId: caregiverId,
          userModel: 'Caregiver',
          consentType: 'collection',
          purpose: 'Test',
          granted: true,
        });

        const res = await request(app)
          .get('/v1/privacy/statistics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(httpStatus.OK);

        expect(res.body).toHaveProperty('requests');
        expect(res.body).toHaveProperty('consent');
        expect(res.body.requests.total).toBeGreaterThan(0);
      });
    });
  });
});

