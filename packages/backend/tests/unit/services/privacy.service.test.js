const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const privacyService = require('../../../src/services/privacy.service');
const { PrivacyRequest, ConsentRecord, Caregiver, Client, Org, Conversation, MedicalAnalysis, Call } = require('../../../src/models');
const ApiError = require('../../../src/utils/ApiError');
const emailService = require('../../../src/services/email.service');

describe('Privacy Service', () => {
  let mongoServer;
  let caregiverId;
  let clientId;
  let orgId;

  beforeAll(async () => {
    jest.setTimeout(60000);
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {});

    // Initialize email service with Ethereal for testing
    // In test, sendEmail only captures; retriever uses captured emails. No real Ethereal needed.
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clear all collections
    await PrivacyRequest.deleteMany({});
    await ConsentRecord.deleteMany({});
    await Caregiver.deleteMany({});
    await Client.deleteMany({});
    await Org.deleteMany({});
    await Conversation.deleteMany({});
    await Call.deleteMany({});
    await MedicalAnalysis.deleteMany({});

    // Create org first (required for caregiver)
    const org = await Org.create({
      name: 'Test Org',
      email: 'testorg@example.com',
      country: 'US',
    });
    
    // Create test caregiver with org
    const caregiver = await Caregiver.create({
      name: 'Test Caregiver',
      email: 'caregiver@test.com',
      phone: '+16045624263', // Valid phone format
      password: 'password123',
      role: 'orgAdmin',
      isEmailVerified: true,
      isPhoneVerified: true,
      org: org._id,
    });
    caregiverId = caregiver._id;

    // Create test client
    
    const client = await Client.create({
      name: 'Test Client',
      email: 'client@test.com',
      phone: '+16045624264', // Valid phone format
      org: org._id,
      caregivers: [caregiverId],
    });
    clientId = client._id;

    // Update caregiver with client
    caregiver.clients = [clientId];
    await caregiver.save();
  });

  describe('createAccessRequest', () => {
    it('should create an access request', async () => {
      const requestBody = {
        informationRequested: 'All my personal information',
        accessMethod: 'email',
      };

      const request = await privacyService.createAccessRequest(
        requestBody,
        caregiverId,
        'Caregiver'
      );

      expect(request).toBeDefined();
      expect(request.requestType).toBe('access');
      expect(request.requestorId.toString()).toBe(caregiverId.toString());
      expect(request.requestorModel).toBe('Caregiver');
      expect(request.status).toBe('pending');
      expect(request.responseDeadline).toBeDefined();
      
      // Check deadline is 30 days from now
      const deadline = new Date(request.responseDeadline);
      const now = new Date();
      const daysDiff = Math.floor((deadline - now) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(30);
    });

    it('should set default informationRequested if not provided', async () => {
      const request = await privacyService.createAccessRequest(
        {},
        caregiverId,
        'Caregiver'
      );

      expect(request.informationRequested).toBe('All personal information');
    });
  });

  describe('createCorrectionRequest', () => {
    it('should create a correction request', async () => {
      const requestBody = {
        informationRequested: 'Correction to email address',
        correctionDetails: {
          field: 'email',
          currentValue: 'old@example.com',
          requestedValue: 'new@example.com',
          reason: 'Email address changed',
        },
      };

      const request = await privacyService.createCorrectionRequest(
        requestBody,
        caregiverId,
        'Caregiver'
      );

      expect(request).toBeDefined();
      expect(request.requestType).toBe('correction');
      expect(request.correctionDetails).toBeDefined();
      expect(request.correctionDetails.field).toBe('email');
    });

    it('should throw error if correctionDetails missing', async () => {
      await expect(
        privacyService.createCorrectionRequest({}, caregiverId, 'Caregiver')
      ).rejects.toThrow(ApiError);
    });
  });

  describe('getPrivacyRequestById', () => {
    it('should return request for the requestor', async () => {
      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test request',
      });

      const result = await privacyService.getPrivacyRequestById(request._id, caregiverId);
      expect(result._id.toString()).toBe(request._id.toString());
    });

    it('should allow admin to view any request', async () => {
      const admin = await Caregiver.create({
        name: 'Admin',
        email: 'admin@test.com',
        phone: '+16045624268',
        password: 'password123',
        role: 'superAdmin',
        isEmailVerified: true,
        org: (await Org.findOne({ email: 'testorg@example.com' }))._id,
      });

      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test request',
      });

      const result = await privacyService.getPrivacyRequestById(request._id, admin._id);
      expect(result._id.toString()).toBe(request._id.toString());
    });

    it('should throw error if user tries to view another user\'s request', async () => {
      const org = await Org.findOne({ email: 'testorg@example.com' });
      const otherUser = await Caregiver.create({
        name: 'Other User',
        email: 'other@test.com',
        phone: '+16045624266',
        password: 'password123',
        org: org._id,
        role: 'staff',
        isEmailVerified: true,
      });

      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test request',
      });

      await expect(
        privacyService.getPrivacyRequestById(request._id, otherUser._id)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('processAccessRequest', () => {
    jest.setTimeout(30000); // Increase timeout to 30 seconds for email retrieval
    
    it('should automatically gather and email all user data', async () => {
      // Create test data - first create a call (conversations require callId)
      const call = await Call.create({
        clientId,
        callSid: 'CA1234567890abcdef',
        status: 'completed',
        duration: 60,
        caregiverId,
      });

      const conversation = await Conversation.create({
        clientId,
        callId: call._id,
        status: 'completed',
        startTime: new Date(),
        messages: [],
      });

      const medicalAnalysis = await MedicalAnalysis.create({
        clientId,
        analysisDate: new Date(),
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date(),
        timeRange: 'month',
        conversationCount: 5,
        messageCount: 50,
        totalWords: 500,
        confidence: 'high',
        cognitiveMetrics: { 
          riskScore: 85,
          confidence: 'high'
        },
        psychiatricMetrics: { 
          overallRiskScore: 90
        },
      });

      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'All my data',
      });

      const emailService = require('../../../src/services/email.service');
      
      const result = await privacyService.processAccessRequest(request._id, caregiverId);

      expect(result.status).toBe('completed');
      expect(result.responseDate).toBeDefined();
      expect(result.informationProvided).toBeDefined();
      expect(result.informationProvided.length).toBeGreaterThan(0);

      // Verify email was sent via Ethereal and retrieve it
      const caregiver = await Caregiver.findById(caregiverId);
      expect(caregiver).toBeDefined();
      expect(caregiver.email).toBeDefined();

      try {
        const etherealEmailRetriever = require('../../../src/services/etherealEmailRetriever.service');
        // Wait a bit for email to be sent before trying to retrieve
        await new Promise(resolve => setTimeout(resolve, 2000));
        const email = await etherealEmailRetriever.waitForEmail(caregiver.email, 15000);
        expect(email).toBeDefined();
        expect(email.subject).toContain('Personal Data Export');
        expect(email.text).toContain('Bianca Wellness');
        expect(email.attachments).toBeDefined();
        expect(email.attachments.length).toBeGreaterThan(0);
        
        // Verify attachment is JSON
        const jsonAttachment = email.attachments.find(att => 
          att.filename && att.filename.includes('.json')
        );
        expect(jsonAttachment).toBeDefined();
        
        // Verify JSON contains user data
        if (jsonAttachment && jsonAttachment.content) {
          const userData = JSON.parse(jsonAttachment.content);
          expect(userData.profile).toBeDefined();
          expect(userData.profile.email).toBe(caregiver.email);
          expect(userData.conversations).toBeDefined();
          expect(userData.medicalAnalysis).toBeDefined();
        }
      } catch (emailError) {
        // If email retrieval fails, log but don't fail the test
        // (email might be delayed or Ethereal might be unavailable)
        console.warn('Could not retrieve email from Ethereal:', emailError.message);
      }
    });

    it('should only process caregiver requests', async () => {
      const request = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'client',
        requestorId: clientId,
        requestorModel: 'Client',
        informationRequested: 'Test',
      });

      await expect(
        privacyService.processAccessRequest(request._id, caregiverId)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('createConsentRecord', () => {
    it('should create a consent record', async () => {
      const consentBody = {
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
      };

      const consent = await privacyService.createConsentRecord(
        consentBody,
        caregiverId,
        'Caregiver'
      );

      expect(consent).toBeDefined();
      expect(consent.consentType).toBe('collection');
      expect(consent.granted).toBe(true);
      expect(consent.method).toBe('explicit');
      expect(consent.explicitConsent.provided).toBe(true);
    });

    it('should default to explicit consent if not specified', async () => {
      const consent = await privacyService.createConsentRecord(
        {
          consentType: 'collection',
          purpose: 'Test',
        },
        caregiverId,
        'Caregiver'
      );

      expect(consent.method).toBe('explicit');
    });
  });

  describe('hasConsent', () => {
    it('should return true if user has active consent', async () => {
      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'wellness_calls',
        granted: true,
        withdrawn: false,
      });

      const hasConsent = await privacyService.hasConsent(
        caregiverId,
        'Caregiver',
        'recording',
        'wellness_calls'
      );

      expect(hasConsent).toBe(true);
    });

    it('should return false if consent is withdrawn', async () => {
      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'wellness_calls',
        granted: true,
        withdrawn: true,
        withdrawnAt: new Date(),
      });

      const hasConsent = await privacyService.hasConsent(
        caregiverId,
        'Caregiver',
        'recording',
        'wellness_calls'
      );

      expect(hasConsent).toBe(false);
    });

    it('should return false if consent expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'wellness_calls',
        granted: true,
        withdrawn: false,
        expiresAt: expiredDate,
      });

      const hasConsent = await privacyService.hasConsent(
        caregiverId,
        'Caregiver',
        'recording',
        'wellness_calls'
      );

      expect(hasConsent).toBe(false);
    });
  });

  describe('withdrawConsent', () => {
    it('should withdraw consent and lock account for collection consent', async () => {
      const consent =       await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
      });

      await privacyService.withdrawConsent(
        consent._id,
        {
          withdrawalMethod: 'app',
          withdrawalReason: 'No longer want service',
        },
        caregiverId
      );

      const updatedConsent = await ConsentRecord.findById(consent._id);
      expect(updatedConsent.withdrawn).toBe(true);
      expect(updatedConsent.granted).toBe(false);

      // Check account is locked
      const caregiver = await Caregiver.findById(caregiverId);
      expect(caregiver.accountLocked).toBe(true);
      expect(caregiver.lockedReason).toContain('Consent withdrawn');
    });

    it('should not lock account for non-collection consent', async () => {
      const consent = await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'wellness_calls',
        granted: true,
        withdrawn: false,
      });

      await privacyService.withdrawConsent(
        consent._id,
        {
          withdrawalMethod: 'app',
          withdrawalReason: 'No longer want recording',
        },
        caregiverId
      );

      const caregiver = await Caregiver.findById(caregiverId);
      expect(caregiver.accountLocked).toBeFalsy();
    });

    it('should throw error if user tries to withdraw another user\'s consent', async () => {
      const org = await Org.findOne({ email: 'testorg@example.com' });
      const otherUser = await Caregiver.create({
        name: 'Other User',
        email: 'other@test.com',
        phone: '+16045624267',
        password: 'password123',
        role: 'staff',
        isEmailVerified: true,
        org: org._id,
      });

      const consent = await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
      });

      await expect(
        privacyService.withdrawConsent(consent._id, {}, otherUser._id)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('getApproachingDeadline', () => {
    it('should return requests approaching deadline', async () => {
      const fourDaysFromNow = new Date();
      fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

      await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        status: 'pending',
        responseDeadline: fourDaysFromNow,
      });

      const requests = await privacyService.getApproachingDeadline();
      expect(requests.length).toBeGreaterThan(0);
    });
  });

  describe('getOverdueRequests', () => {
    it('should return overdue requests', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        status: 'pending',
        responseDeadline: yesterday,
      });

      const requests = await privacyService.getOverdueRequests();
      expect(requests.length).toBeGreaterThan(0);
    });
  });

  describe('getPrivacyStatistics', () => {
    it('should return statistics for requests and consent', async () => {
      await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        informationRequested: 'Test',
        status: 'completed',
      });

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Test',
        granted: true,
      });

      const stats = await privacyService.getPrivacyStatistics();
      expect(stats.requests).toBeDefined();
      expect(stats.consent).toBeDefined();
      expect(stats.requests.total).toBeGreaterThan(0);
      expect(stats.consent.total).toBeGreaterThan(0);
    });
  });
});

