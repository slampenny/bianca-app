const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { Alert, Org, Caregiver, Patient, Schedule, Conversation } = require('../../src/models');
const { caregiverOne, insertCaregiversAndAddToOrg } = require('../fixtures/caregiver.fixture');
const { alertOne, insertAlerts } = require('../fixtures/alert.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { patientOne, insertPatientsAndAddToCaregiver } = require('../fixtures/patient.fixture');
const { scheduleOne, insertScheduleAndAddToPatient } = require('../fixtures/schedule.fixture');
const { tokenService } = require('../../src/services');

// Mock Twilio service for testing
jest.mock('../../src/services/twilioCall.service', () => ({
  initiateCall: jest.fn().mockResolvedValue('mock-call-sid-12345'),
  generateCallTwiML: jest.fn(),
  handleCallStatus: jest.fn(),
}));

let mongoServer;
let caregiverToken;
let org;
let caregiver;
let patient;

describe('Call Workflow Integration Tests', () => {
  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Setup test data
    [org] = await insertOrgs([orgOne]);
    [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
    [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
    
    // Create auth token for caregiver
    caregiverToken = await tokenService.generateAuthTokens(caregiver);
  });

  afterEach(async () => {
    // Clean up test data
    await Alert.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Org.deleteMany();
    await Schedule.deleteMany();
    await Conversation.deleteMany();
  });

  describe('POST /v1/calls/initiate', () => {
    it('should initiate a call to a patient successfully', async () => {
      const callData = {
        patientId: patient.id,
        callNotes: 'Test call for patient check-in'
      };

      const response = await request(app)
        .post('/v1/calls/initiate')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(callData)
        .expect(httpStatus.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conversationId');
      expect(response.body.data).toHaveProperty('callSid');
      expect(response.body.data.patientId).toBe(patient.id);
      expect(response.body.data.patientName).toBe(patient.name);
      expect(response.body.data.agentId).toBe(caregiver.id);
      expect(response.body.data.callStatus).toBe('ringing');
      expect(response.body.message).toBe('Call initiated successfully');

      // Verify conversation was created in database
      const conversation = await Conversation.findById(response.body.data.conversationId);
      expect(conversation).toBeTruthy();
      expect(conversation.patientId.toString()).toBe(patient.id);
      expect(conversation.agentId.toString()).toBe(caregiver.id);
      expect(conversation.callStatus).toBe('ringing');
      expect(conversation.callNotes).toBe(callData.callNotes);
    });

    it('should return 400 if patient does not have phone number', async () => {
      // Update patient to remove phone number
      patient.phone = undefined;
      await patient.save({ validateBeforeSave: false });

      const callData = {
        patientId: patient.id,
        callNotes: 'Test call'
      };

      const response = await request(app)
        .post('/v1/calls/initiate')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(callData)
        .expect(httpStatus.BAD_REQUEST);

      expect(response.body.message).toBe('Patient does not have a phone number');
    });

    it('should return 404 if patient not found', async () => {
      const fakePatientId = new mongoose.Types.ObjectId();
      const callData = {
        patientId: fakePatientId,
        callNotes: 'Test call'
      };

      const response = await request(app)
        .post('/v1/calls/initiate')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(callData)
        .expect(httpStatus.NOT_FOUND);

      expect(response.body.message).toBe('Patient not found');
    });

    it('should return 401 without valid token', async () => {
      const callData = {
        patientId: patient.id,
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

    beforeEach(async () => {
      // Create a test conversation
      conversation = new Conversation({
        patientId: patient.id,
        agentId: caregiver.id,
        callStatus: 'ringing',
        callStartTime: new Date(),
        callType: 'outbound',
        status: 'initiated'
      });
      await conversation.save();
    });

    it('should return call status successfully', async () => {
      const response = await request(app)
        .get(`/v1/calls/${conversation.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversationId).toBe(conversation.id);
      expect(response.body.data.callStatus).toBe('ringing');
      expect(response.body.data.patient).toBeTruthy();
      expect(response.body.data.agent).toBeTruthy();
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

    beforeEach(async () => {
      // Create a test conversation
      conversation = new Conversation({
        patientId: patient.id,
        agentId: caregiver.id,
        callStatus: 'ringing',
        callStartTime: new Date(Date.now() - 1000), // 1 second ago to ensure duration > 0
        callType: 'outbound',
        status: 'initiated'
      });
      await conversation.save();
    });

    it('should update call status successfully', async () => {
      const updateData = {
        status: 'answered',
        outcome: 'answered',
        notes: 'Patient answered the call'
      };

      const response = await request(app)
        .post(`/v1/calls/${conversation.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(updateData)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Call status updated successfully');

      // Verify database was updated
      const updatedConversation = await Conversation.findById(conversation.id);
      expect(updatedConversation.callStatus).toBe('answered');
      expect(updatedConversation.callOutcome).toBe('answered');
      expect(updatedConversation.callNotes).toBe(updateData.notes);
    });

    it('should handle call end status correctly', async () => {
      const updateData = {
        status: 'ended',
        outcome: 'answered',
        notes: 'Call completed successfully'
      };

      const response = await request(app)
        .post(`/v1/calls/${conversation.id}/status`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(updateData)
        .expect(httpStatus.OK);

      // Verify call end time and duration were set
      const updatedConversation = await Conversation.findById(conversation.id);
      expect(updatedConversation.callEndTime).toBeTruthy();
      expect(updatedConversation.callDuration).toBeGreaterThan(0);
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

    beforeEach(async () => {
      // Create a test conversation
      conversation = new Conversation({
        patientId: patient.id,
        agentId: caregiver.id,
        callStatus: 'connected',
        callStartTime: new Date(Date.now() - 60000), // 1 minute ago
        callType: 'outbound',
        status: 'in-progress'
      });
      await conversation.save();
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

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Call ended successfully');

      // Verify database was updated
      const updatedConversation = await Conversation.findById(conversation.id);
      expect(updatedConversation.callStatus).toBe('ended');
      expect(updatedConversation.callOutcome).toBe('answered');
      expect(updatedConversation.callNotes).toBe(endData.notes);
      expect(updatedConversation.status).toBe('completed');
      expect(updatedConversation.callEndTime).toBeTruthy();
      expect(updatedConversation.callDuration).toBeGreaterThan(0);
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
      // Create multiple conversations with different statuses
      const activeConversations = [
        {
          patientId: patient.id,
          agentId: caregiver.id,
          callStatus: 'ringing',
          callStartTime: new Date(),
          callType: 'outbound',
          status: 'initiated'
        },
        {
          patientId: patient.id,
          agentId: caregiver.id,
          callStatus: 'connected',
          callStartTime: new Date(),
          callType: 'outbound',
          status: 'in-progress'
        }
      ];

      await Conversation.insertMany(activeConversations);
    });

    it('should return active calls for the agent', async () => {
      const response = await request(app)
        .get('/v1/calls/active')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
      
      // Verify all returned calls are active
      response.body.data.forEach(call => {
        expect(['initiating', 'ringing', 'answered', 'connected']).toContain(call.callStatus);
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

    beforeEach(async () => {
      // Create a test conversation
      conversation = new Conversation({
        patientId: patient.id,
        agentId: caregiver.id,
        callStatus: 'connected',
        callStartTime: new Date(),
        callType: 'outbound',
        status: 'in-progress',
        callNotes: 'Test conversation'
      });
      await conversation.save();
    });

    it('should return conversation with call details', async () => {
      const response = await request(app)
        .get(`/v1/calls/${conversation.id}/conversation`)
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversationId).toBe(conversation.id);
      expect(response.body.data.callStatus).toBe('connected');
      expect(response.body.data.callNotes).toBe('Test conversation');
      expect(response.body.data.patient).toBeTruthy();
      expect(response.body.data.agent).toBeTruthy();
    });
  });
});
