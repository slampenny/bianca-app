// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Alert, Org, Caregiver, Client, Schedule, Conversation, Call } = require('../../src/models');
const { caregiverOne, insertCaregiversAndAddToOrg } = require('../fixtures/caregiver.fixture');
const { alertOne, insertAlerts } = require('../fixtures/alert.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { clientOne, insertClientsAndAddToCaregiver } = require('../fixtures/client.fixture');
const { scheduleOne, insertScheduleAndAddToClient } = require('../fixtures/schedule.fixture');
const { tokenService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

let mongoServer;
let caregiverToken;
let org;
let caregiver;
let client;

describe('Call Workflow Integration Tests', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    // Setup test data
    [org] = await insertOrgs([orgOne]);
    [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
    [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);
    
    // Create auth token for caregiver
    caregiverToken = await tokenService.generateAuthTokens(caregiver);
  });

  afterEach(async () => {
    // Clean up test data
    await Alert.deleteMany();
    await Caregiver.deleteMany();
    await Client.deleteMany();
    await Org.deleteMany();
    await Schedule.deleteMany();
    await Conversation.deleteMany();
    await Call.deleteMany();
  });

  describe('POST /v1/calls/initiate', () => {
    it('should initiate a call to a client successfully', async () => {
      const callData = {
        clientId: client.id,
        callNotes: 'Test call for client check-in'
      };

      const response = await request(app)
        .post('/v1/calls/initiate')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(callData)
        .expect(httpStatus.CREATED);

      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('callId');
      expect(response.body).toHaveProperty('callSid', 'mock-call-sid-12345');
      expect(response.body.clientId.toString()).toBe(client.id);
      expect(response.body.clientName ?? response.body.patientName).toBe(client.name);
      expect(response.body.caregiverId.toString()).toBe(caregiver.id);
      expect(response.body.status).toBe('in-progress');
      expect(response.body.callStatus).toBe('ringing');
      expect(response.body.isOnboardingCall).toBe(true);
      expect(response.body.onboardingDay).toBe(0);
      expect(response.body.onboardingJourneyComplete).toBe(false);
      expect(response.body.nextOutboundWillBeOnboarding).toBe(true);

      // Verify conversation was created in database
      const conversation = await Conversation.findById(response.body.conversationId);
      expect(conversation).toBeTruthy();
      expect(conversation.clientId.toString()).toBe(client.id);
      expect(conversation.callId.toString()).toBe(response.body.callId);

      // Verify call was created and linked to conversation
      const { Call } = require('../../src/models');
      const call = await Call.findById(response.body.callId);
      expect(call).toBeTruthy();
      expect(call.conversationId.toString()).toBe(response.body.conversationId);
      expect(call.caregiverId.toString()).toBe(caregiver.id);
      expect(call.callStatus).toBe('ringing');
      expect(call.callNotes).toBe(callData.callNotes);
      expect(call.callType).toBe('onboarding');
      expect(call.onboardingDay).toBe(0);
    });

    it('should return 400 if client does not have phone number', async () => {
      // Update client to remove phone number
      client.phone = undefined;
      await client.save({ validateBeforeSave: false });

      const callData = {
        clientId: client.id,
        callNotes: 'Test call'
      };

      const response = await request(app)
        .post('/v1/calls/initiate')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(callData)
        .expect(httpStatus.BAD_REQUEST);

      expect(response.body.message).toBe('Client does not have a phone number');
    });

    it('should return 404 if client not found', async () => {
      const fakeClientId = new mongoose.Types.ObjectId();
      const callData = {
        clientId: fakeClientId,
        callNotes: 'Test call'
      };

      const response = await request(app)
        .post('/v1/calls/initiate')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(callData)
        .expect(httpStatus.NOT_FOUND);

      expect(response.body.message).toBe('Client not found');
    });

    it('should return 401 without valid token', async () => {
      const callData = {
        clientId: client.id,
        callNotes: 'Test call'
      };

      await request(app)
        .post('/v1/calls/initiate')
        .send(callData)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/calls/:conversationId/status', () => {
    let conversation;
    let call;

    beforeEach(async () => {
      // Create a test call first
      call = await Call.create({
        callSid: 'CA1234567890abcdef',
        clientId: client.id,
        caregiverId: caregiver.id,
        status: 'in-progress',
        callStatus: 'ringing',
        callType: 'outbound',
        startTime: new Date(),
        callStartTime: new Date()
      });

      // Create a test conversation linked to the call
      conversation = await Conversation.create({
        clientId: client.id,
        callId: call._id
      });

      // Link call to conversation
      call.conversationId = conversation._id;
      await call.save();
    });

    it('should return call status successfully', async () => {
      const response = await request(app)
        .get(`/v1/calls/${conversation.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.conversationId.toString()).toBe(conversation.id);
      expect(response.body.data.status).toBe('in-progress'); // Call status, not conversation status
      expect(response.body.data.client).toBeTruthy();
      expect(response.body.data.caregiver).toBeTruthy();
      expect(response.body.data.onboarding).toBeDefined();
      expect(response.body.data.onboarding.journeyComplete).toBe(false);
      expect(response.body.data.onboarding.sessionsCompleted).toBe(0);
    });

    it('should return 404 if conversation not found', async () => {
      const fakeConversationId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/v1/calls/${fakeConversationId}/status`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .expect(httpStatus.NOT_FOUND);
    });

    it('should return 401 without valid token', async () => {
      await request(app)
        .get(`/v1/calls/${conversation.id}/status`)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/calls/:conversationId/status', () => {
    let conversation;
    let call;

    beforeEach(async () => {
      // Create a test call first
      call = await Call.create({
        callSid: 'CA1234567890abcdef',
        clientId: client.id,
        caregiverId: caregiver.id,
        status: 'in-progress',
        callStatus: 'ringing',
        callType: 'outbound',
        startTime: new Date(Date.now() - 1000), // 1 second ago to ensure duration > 0
        callStartTime: new Date(Date.now() - 1000)
      });

      // Create a test conversation linked to the call
      conversation = await Conversation.create({
        clientId: client.id,
        callId: call._id
      });

      // Link call to conversation
      call.conversationId = conversation._id;
      await call.save();
    });

    it('should update call status successfully', async () => {
      const updateData = {
        status: 'answered', // Call status that maps to 'in-progress' conversation status
        outcome: 'answered',
        notes: 'Patient answered the call'
      };

      const response = await request(app)
        .post(`/v1/calls/${conversation.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(updateData)
        .expect(httpStatus.OK);

      // The response is a ConversationDTO
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('in-progress'); // Status is now included from call
      expect(response.body.id.toString()).toBe(conversation.id);

      // Verify call was updated (status and notes are on Call, not Conversation)
      const updatedCall = await Call.findById(call._id);
      expect(updatedCall.status).toBe('in-progress');
      expect(updatedCall.callNotes).toBe(updateData.notes);
    });

    it('should handle call end status correctly', async () => {
      const updateData = {
        status: 'ended', // Call status that maps to 'completed' conversation status
        outcome: 'answered',
        notes: 'Call completed successfully'
      };

      const response = await request(app)
        .post(`/v1/calls/${conversation.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(updateData)
        .expect(httpStatus.OK);

      // The response is a ConversationDTO
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('completed'); // Status is now included from call
      expect(response.body.id.toString()).toBe(conversation.id);

      // Verify call end time and duration were set (these are on Call, not Conversation)
      const updatedCall = await Call.findById(call._id);
      expect(updatedCall.status).toBe('completed');
      expect(updatedCall.endTime).toBeTruthy();
      expect(updatedCall.duration).toBeGreaterThan(0);
    });

    it('should return 400 for invalid status', async () => {
      const updateData = {
        status: 'invalid_status'
      };

      await request(app)
        .post(`/v1/calls/${conversation.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(updateData)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/calls/:conversationId/end', () => {
    let conversation;
    let call;

    beforeEach(async () => {
      // Create a test call first
      call = await Call.create({
        callSid: 'CA1234567890abcdef',
        clientId: client.id,
        caregiverId: caregiver.id,
        status: 'in-progress',
        callStatus: 'connected',
        callType: 'outbound',
        startTime: new Date(Date.now() - 60000), // 1 minute ago
        callStartTime: new Date(Date.now() - 60000)
      });

      // Create a test conversation linked to the call
      conversation = await Conversation.create({
        clientId: client.id,
        callId: call._id
      });

      // Link call to conversation
      call.conversationId = conversation._id;
      await call.save();
    });

    it('should end call successfully', async () => {
      const endData = {
        outcome: 'answered',
        notes: 'Patient was cooperative and call went well'
      };

      const response = await request(app)
        .post(`/v1/calls/${conversation.id}/end`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(endData)
        .expect(httpStatus.OK);

      // The response is a ConversationDTO
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('completed'); // Status is now included from call
      expect(response.body.id.toString()).toBe(conversation.id);

      // Verify call was updated (status, notes, endTime, duration are on Call, not Conversation)
      const updatedCall = await Call.findById(call._id);
      expect(updatedCall.status).toBe('completed');
      expect(updatedCall.callNotes).toBe(endData.notes);
      expect(updatedCall.endTime).toBeTruthy();
      expect(updatedCall.duration).toBeGreaterThan(0);
    });

    it('should return 400 without required outcome', async () => {
      const endData = {
        notes: 'Call notes'
      };

      await request(app)
        .post(`/v1/calls/${conversation.id}/end`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(endData)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /v1/calls/active', () => {
    beforeEach(async () => {
      // Create multiple calls with different statuses and their conversations
      const call1 = await Call.create({
        callSid: 'CA1111111111111111',
        clientId: client.id,
        caregiverId: caregiver.id,
        status: 'in-progress',
        callStatus: 'ringing',
        callType: 'outbound',
        startTime: new Date(),
        callStartTime: new Date()
      });

      const call2 = await Call.create({
        callSid: 'CA2222222222222222',
        clientId: client.id,
        caregiverId: caregiver.id,
        status: 'in-progress',
        callStatus: 'connected',
        callType: 'outbound',
        startTime: new Date(),
        callStartTime: new Date()
      });

      const conversation1 = await Conversation.create({
        clientId: client.id,
        callId: call1._id
      });

      const conversation2 = await Conversation.create({
        clientId: client.id,
        callId: call2._id
      });

      call1.conversationId = conversation1._id;
      call2.conversationId = conversation2._id;
      await call1.save();
      await call2.save();
    });

    it('should return active calls for the caregiver', async () => {
      const response = await request(app)
        .get('/v1/calls/active')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('count', 2);
      expect(response.body.data).toHaveLength(2);
      
      // Verify all returned calls are active (using conversation status values)
      response.body.data.forEach(call => {
        expect(['initiated', 'in-progress']).toContain(call.status);
      });
    });

    it('should return 401 without valid token', async () => {
      await request(app)
        .get('/v1/calls/active')
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/calls/:conversationId/conversation', () => {
    let conversation;
    let call;

    beforeEach(async () => {
      // Create a test call first
      call = await Call.create({
        callSid: 'CA1234567890abcdef',
        clientId: client.id,
        caregiverId: caregiver.id,
        status: 'in-progress',
        callStatus: 'connected',
        callType: 'outbound',
        startTime: new Date(),
        callStartTime: new Date(),
        callNotes: 'Test conversation'
      });

      // Create a test conversation linked to the call
      conversation = await Conversation.create({
        clientId: client.id,
        callId: call._id
      });

      // Link call to conversation
      call.conversationId = conversation._id;
      await call.save();
    });

    it('should return conversation with call details', async () => {
      const response = await request(app)
        .get(`/v1/calls/${conversation.id}/conversation`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.conversationId.toString()).toBe(conversation.id);
      expect(response.body.data.status).toBe('in-progress');
      expect(response.body.data.client).toBeTruthy();
      expect(response.body.data.caregiver).toBeTruthy();
    });
  });
});
