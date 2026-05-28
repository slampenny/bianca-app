require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../utils/integration-app');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');
const {
  PrivacyRequest,
  PrivacyComplaint,
  Caregiver,
  Client,
  Call,
  Conversation,
  Message,
  MedicalAnalysis,
  Org,
  ErasureCompletionRecord,
} = require('../../src/models');
const { ClientMemory } = require('../../src/models/clientMemory.model');
const { caregiverOneWithPassword, insertCaregivertoOrgAndReturnToken } = require('../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const dataDeletionService = require('../../src/services/dataDeletion.service');
const privacyService = require('../../src/services/privacy.service');
const { computePrivacyResponseDeadline, getPrivacyExtensionDays } = require('../../src/utils/jurisdiction.utils');
const emailService = require('../../src/services/email.service');

jest.setTimeout(60000);

beforeAll(async () => {
  await setupMongoMemoryServer();
  await emailService.initializeEmailTransport();
}, 60000);

afterAll(async () => {
  await teardownMongoMemoryServer();
}, 60000);

const buildMedicalAnalysis = (clientId) => MedicalAnalysis.create({
  clientId,
  analysisDate: new Date(),
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
  timeRange: 'month',
  conversationCount: 1,
  messageCount: 10,
  totalWords: 100,
  confidence: 'high',
  cognitiveMetrics: { riskScore: 50 },
  psychiatricMetrics: { overallRiskScore: 50 },
});

describe('Privacy GDPR pipeline', () => {
  let accessToken;
  let caregiverId;
  let clientId;
  let gdprOrg;

  beforeEach(async () => {
    await clearDatabase();

    const [org] = await insertOrgs([{ ...orgOne, country: 'DE' }]);
    gdprOrg = await Org.findById(org.id);
    const { caregiver, accessToken: token } = await insertCaregivertoOrgAndReturnToken(
      gdprOrg,
      caregiverOneWithPassword
    );
    accessToken = token;
    caregiverId = caregiver._id.toString();

    const client = await Client.create({
      name: 'GDPR Client',
      email: 'gdpr-client@test.com',
      phone: '+16045624269',
      org: org.id,
      caregivers: [caregiverId],
    });
    clientId = client._id;

    await Caregiver.findByIdAndUpdate(caregiverId, { $push: { clients: clientId } });
  });

  describe('GDPR deadline calculation', () => {
    it('sets 30-day response deadline for GDPR jurisdiction orgs', async () => {
      const requestDate = new Date('2025-01-01T12:00:00.000Z');
      const request = await privacyService.createAccessRequest(
        { informationRequested: 'All data' },
        caregiverId,
        'Caregiver'
      );
      request.requestDate = requestDate;
      request.responseDeadline = computePrivacyResponseDeadline(requestDate, 'GDPR');
      await request.save();

      const expected = new Date('2025-01-31T12:00:00.000Z');
      expect(request.jurisdiction).toBe('GDPR');
      expect(new Date(request.responseDeadline).toISOString()).toBe(expected.toISOString());
      expect(getPrivacyExtensionDays('GDPR')).toBe(60);
    });

    it('returns request status with effective deadline', async () => {
      const privacyRequest = await PrivacyRequest.create({
        requestType: 'access',
        requestorType: 'caregiver',
        requestorId: caregiverId,
        requestorModel: 'Caregiver',
        jurisdiction: 'GDPR',
        informationRequested: 'Test',
        requestDate: new Date(),
        responseDeadline: computePrivacyResponseDeadline(new Date(), 'GDPR'),
        status: 'pending',
      });

      const res = await request(app)
        .get(`/v1/privacy/requests/${privacyRequest._id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.jurisdiction).toBe('GDPR');
      expect(res.body.status).toBe('pending');
      expect(res.body.effectiveDeadline).toBeDefined();
    });
  });

  describe('Access export includes ClientMemory facts', () => {
    it('includes non-deleted client memory facts in processed access export', async () => {
      await ClientMemory.create({
        clientId,
        fact: 'Prefers to be called Rose',
        category: 'preference',
        confidence: 'high',
        source: 'post_call_extraction',
      });
      await ClientMemory.create({
        clientId,
        fact: 'Deleted fact',
        category: 'general',
        deletedAt: new Date(),
        deletedReason: 'erasure_request',
      });

      const call = await Call.create({
        clientId,
        callSid: `gdpr-access-${Date.now()}`,
        status: 'completed',
        duration: 60,
        caregiverId,
      });
      const conversation = await Conversation.create({
        clientId,
        status: 'completed',
        startTime: new Date(),
        callId: call._id,
        messages: [],
      });
      const message = await Message.create({
        conversationId: conversation._id,
        role: 'client',
        content: 'Hello Bianca, this is my message body',
        messageType: 'user_message',
      });
      conversation.messages.push(message._id);
      await conversation.save();

      const sendSpy = jest.spyOn(emailService, 'sendPrivacyDataEmail').mockResolvedValue(undefined);

      const accessRequest = await privacyService.createAccessRequest(
        { informationRequested: 'Export all data' },
        caregiverId,
        'Caregiver'
      );
      await privacyService.processAccessRequest(accessRequest._id, caregiverId);

      expect(sendSpy).toHaveBeenCalled();
      const exportedJson = sendSpy.mock.calls[0][2];
      const exported = JSON.parse(exportedJson);
      expect(exported.clientMemory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fact: 'Prefers to be called Rose' }),
        ])
      );
      expect(exported.clientMemory.some((f) => f.fact === 'Deleted fact')).toBe(false);
      expect(exported.conversations[0].messages[0].content).toBe('Hello Bianca, this is my message body');

      sendSpy.mockRestore();
    });
  });

  describe('Full erasure cascade includes ClientMemory', () => {
    it('hard-deletes ClientMemory and creates ErasureCompletionRecord for GDPR erasure', async () => {
      await ClientMemory.insertMany([
        { clientId, fact: 'Fact one', category: 'general' },
        { clientId, fact: 'Fact two', category: 'health' },
      ]);

      const call = await Call.create({
        clientId,
        callSid: `gdpr-erasure-${Date.now()}`,
        status: 'completed',
        duration: 60,
        caregiverId,
      });
      await Conversation.create({
        clientId,
        status: 'completed',
        startTime: new Date(),
        callId: call._id,
        debugAudioUrls: [{ key: 'debug/audio/test.wav', url: 'https://example.com/test.wav' }],
        messages: [],
      });
      await buildMedicalAnalysis(clientId);

      const erasureRequest = await privacyService.createErasureRequest(
        { informationRequested: 'Delete all my data' },
        caregiverId,
        'Caregiver'
      );
      expect(erasureRequest.jurisdiction).toBe('GDPR');

      const result = await dataDeletionService.processErasureRequest(erasureRequest._id, caregiverId);
      expect(result.erasurePerformed).toBe(true);
      expect(result.scope.clientMemory).toBe(2);

      const remainingFacts = await ClientMemory.find({ clientId });
      expect(remainingFacts.length).toBe(0);

      const completion = await ErasureCompletionRecord.findOne({ requestId: erasureRequest._id });
      expect(completion).toBeDefined();
      expect(completion.scope.clientMemory).toBe(2);
      expect(completion.jurisdiction).toBe('GDPR');
    });
  });

  describe('NAIH complaint creation', () => {
    it('creates a GDPR complaint via NAIH pathway', async () => {
      const res = await request(app)
        .post('/v1/privacy/complaints/gdpr')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          subject: 'Unauthorized disclosure',
          description: 'My data was shared without consent',
          violationType: 'unauthorized_disclosure',
        })
        .expect(httpStatus.CREATED);

      expect(res.body.complaintType).toBe('NAIH');
      expect(res.body.supervisoryAuthority).toBe('NAIH');

      const complaint = await PrivacyComplaint.findById(res.body.id);
      expect(complaint.complaintType).toBe('NAIH');
      expect(complaint.supervisoryAuthority).toBe('NAIH');
    });
  });

  describe('Deletion dataType validation alignment', () => {
    const validTypes = ['all', 'calls', 'conversations', 'medicalAnalysis', 'clientMemory'];

    it.each(validTypes)('accepts dataType=%s via API validation', async (dataType) => {
      await request(app)
        .post('/v1/privacy/deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ dataType })
        .expect(httpStatus.OK);
    });

    it.each(validTypes)('service handles dataType=%s without silent no-op', async (dataType) => {
      const suffix = Date.now();
      const freshClient = await Client.create({
        name: 'Delete Test Client',
        email: `delete-${dataType}-${suffix}@test.com`,
        phone: `+1604562${String(suffix).slice(-4)}`,
        org: gdprOrg._id,
        caregivers: [caregiverId],
      });

      await ClientMemory.create({ clientId: freshClient._id, fact: 'Test fact', category: 'general' });
      const call = await Call.create({
        clientId: freshClient._id,
        callSid: `del-${dataType}-${suffix}`,
        status: 'completed',
        duration: 30,
        caregiverId,
      });
      const conversation = await Conversation.create({
        clientId: freshClient._id,
        status: 'completed',
        startTime: new Date(),
        callId: call._id,
        messages: [],
      });
      await Message.create({
        conversationId: conversation._id,
        role: 'client',
        content: 'Test message',
      });
      await buildMedicalAnalysis(freshClient._id);

      const result = await dataDeletionService.handleDeletionRequest(
        caregiverId,
        dataType,
        'Caregiver'
      );
      expect(result.deleted.total).toBeGreaterThan(0);

      if (dataType === 'clientMemory' || dataType === 'all') {
        expect(result.deleted.clientMemory).toBeGreaterThan(0);
      }
      if (dataType === 'calls' || dataType === 'all') {
        expect(result.deleted.calls).toBeGreaterThan(0);
      }
    });

    it('rejects invalid dataType values', async () => {
      await request(app)
        .post('/v1/privacy/deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ dataType: 'profile' })
        .expect(httpStatus.BAD_REQUEST);

      await request(app)
        .post('/v1/privacy/deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ dataType: 'medical' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});
