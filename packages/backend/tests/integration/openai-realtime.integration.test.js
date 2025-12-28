// Integration tests for OpenAI Realtime API (Beta/GA)
// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const app = require('../utils/integration-app');
const { Org, Caregiver, Patient, Conversation, Call } = require('../../src/models');
const { tokenService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');
const { caregiverOne, insertCaregiversAndAddToOrg } = require('../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { patientOne, insertPatientsAndAddToCaregiver } = require('../fixtures/patient.fixture');
const config = require('../../src/config/config');

let mongoServer;
let caregiverToken;
let org;
let caregiver;
let patient;

describe('OpenAI Realtime API Integration Tests', () => {
  const useGA = process.env.OPENAI_REALTIME_USE_GA === 'true';
  const apiVersion = useGA ? 'GA' : 'Beta';
  
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
    [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
    
    // Create auth token for caregiver
    caregiverToken = await tokenService.generateAuthTokens(caregiver);
  });

  afterEach(async () => {
    // Clean up test data
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Org.deleteMany();
    await Conversation.deleteMany();
    await Call.deleteMany();
  });

  describe(`Session Configuration (${apiVersion})`, () => {
    it(`should use correct model name for ${apiVersion}`, () => {
      const expectedModel = useGA ? 'gpt-realtime' : 'gpt-realtime-2025-08-28';
      const actualModel = config.openai.realtimeModel || (useGA ? 'gpt-realtime' : 'gpt-realtime-2025-08-28');
      expect(actualModel).toBe(expectedModel);
    });

    it(`should have useGA flag set correctly`, () => {
      expect(config.openai.useGA).toBe(useGA);
    });

    it(`should use correct audio format for ${apiVersion}`, () => {
      // This test verifies the MessageHandler uses correct format
      const MessageHandler = require('../../src/services/ai/realtime/message.handler');
      const testConnection = { initialPrompt: 'Test prompt' };
      const sessionConfig = MessageHandler.buildSessionConfig(testConnection);
      
      if (useGA) {
        // GA format: audio settings nested under session.audio
        expect(sessionConfig.session.type).toBe('realtime');
        expect(sessionConfig.session.audio).toBeDefined();
        expect(sessionConfig.session.audio.input.format.type).toBe('audio/pcmu');
        expect(sessionConfig.session.audio.output.format.type).toBe('audio/pcmu');
        expect(sessionConfig.session.audio.output.voice).toBeDefined();
        // GA doesn't have modalities at session level
        expect(sessionConfig.session.modalities).toBeUndefined();
      } else {
        // Beta format: audio settings at top level
        expect(sessionConfig.session.modalities).toEqual(['text', 'audio']);
        expect(sessionConfig.session.input_audio_format).toBe('g711_ulaw');
        expect(sessionConfig.session.output_audio_format).toBe('g711_ulaw');
        expect(sessionConfig.session.voice).toBeDefined();
        // Beta doesn't have session.type
        expect(sessionConfig.session.type).toBeUndefined();
      }
    });
  });

  describe('Call Workflow with OpenAI Realtime', () => {
    it('should initiate call and create conversation', async () => {
      const callData = {
        patientId: patient.id,
        callNotes: `Test call with ${apiVersion} API`
      };

      const response = await request(app)
        .post('/v1/calls/initiate')
        .set('Authorization', `Bearer ${caregiverToken.access.token}`)
        .send(callData)
        .expect(httpStatus.CREATED);

      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('callId');
      expect(response.body.status).toBe('in-progress');

      // Verify conversation was created
      const conversation = await Conversation.findById(response.body.conversationId);
      expect(conversation).toBeTruthy();
      expect(conversation.patientId.toString()).toBe(patient.id);
    });
  });
});

