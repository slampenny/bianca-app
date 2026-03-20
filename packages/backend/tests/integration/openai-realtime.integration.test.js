// Integration tests for OpenAI Realtime API (GA only — Beta models are offline)
// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../utils/integration-app');
const { Org, Caregiver, Client, Conversation, Call } = require('../../src/models');
const { tokenService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');
const { caregiverOne, insertCaregiversAndAddToOrg } = require('../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { clientOne, insertClientsAndAddToCaregiver } = require('../fixtures/client.fixture');
const config = require('../../src/config/config');

let mongoServer;
let caregiverToken;
let org;
let caregiver;
let client;

describe('OpenAI Realtime API Integration Tests', () => {
  const apiVersion = 'GA';
  
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
    await Caregiver.deleteMany();
    await Client.deleteMany();
    await Org.deleteMany();
    await Conversation.deleteMany();
    await Call.deleteMany();
  });

  describe(`Session Configuration (${apiVersion})`, () => {
    it(`should use correct model name for ${apiVersion}`, () => {
      const actualModel = config.openai.realtimeModel || 'gpt-realtime';
      expect(actualModel).toBe('gpt-realtime');
    });

    it('should always use GA API (useGA true)', () => {
      expect(config.openai.useGA).toBe(true);
    });

    it(`should use GA audio format for ${apiVersion}`, () => {
      const MessageHandler = require('../../src/services/ai/realtime/message.handler');
      const testConnection = { initialPrompt: 'Test prompt' };
      const sessionConfig = MessageHandler.buildSessionConfig(testConnection);
      expect(sessionConfig.session.type).toBe('realtime');
      expect(sessionConfig.session.audio).toBeDefined();
      expect(sessionConfig.session.audio.input.format.type).toBe('audio/pcmu');
      expect(sessionConfig.session.audio.output.format.type).toBe('audio/pcmu');
      expect(sessionConfig.session.audio.output.voice).toBeDefined();
      expect(sessionConfig.session.modalities).toBeUndefined();
    });
  });

  describe('Call Workflow with OpenAI Realtime', () => {
    it('should initiate call and create conversation', async () => {
      const callData = {
        clientId: client.id,
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
      expect(conversation.clientId.toString()).toBe(client.id);
    });
  });
});

