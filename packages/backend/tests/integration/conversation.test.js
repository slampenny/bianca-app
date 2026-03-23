// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Org, Client, Token, Caregiver, Conversation, Message, Call } = require('../../src/models');
const { insertOrgs } = require('../fixtures/org.fixture');
const { clientOne, insertClientsAndAddToCaregiver } = require('../fixtures/client.fixture');
const {
  caregiverOne,
  caregiverTwo,
  admin,
  insertCaregivertoOrgAndReturnToken,
  insertCaregivertoOrgAndReturnTokenByRole,
  insertCaregivers,
  insertCaregiversAndAddToOrg,
} = require('../fixtures/caregiver.fixture');
const tokenService = require('../../src/services/token.service');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Conversation routes', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Client.deleteMany();
    await Token.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();
  });

  // Helper function to set up test data
  const setupTestData = async () => {
    const [org] = await insertOrgs([admin]);
    const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
    const [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
    const [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);
    return { org, accessToken, caregiver, client };
  };

  // Helper function to set up test data with different caregiver
  const setupTestDataWithCaregiverTwo = async () => {
    const [org] = await insertOrgs([admin]);
    const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');
    const [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverTwo]);
    const [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);
    return { org, accessToken, caregiver, client };
  };

  describe('POST /v1/conversations/client/:clientId', () => {
    test('should create a new conversation for a client', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a call first (required for conversation)
      const call = new Call({
        clientId: client._id,
        callSid: 'test-call-sid',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();

      const res = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        clientId: client._id.toString(),
        callSid: expect.any(String),
        messages: expect.arrayContaining([]),
        analyzedData: expect.any(Object),
        metadata: expect.any(Object),
        startTime: expect.any(String),
        endTime: null,
        duration: expect.any(Number),
        status: expect.any(String),
        callStatus: expect.any(String),
        callStartTime: expect.any(String),
        callEndTime: null,
        callDuration: expect.any(Number),
        callOutcome: null,
        callNotes: expect.any(String),
        agentId: null,
        lineItemId: null,
        sentiment: null,
        sentimentAnalyzedAt: null,
      });
    });

    test('should return 404 when client does not exist', async () => {
      const { accessToken } = await setupTestData();
      const nonExistentClientId = new mongoose.Types.ObjectId();
      
      // Create a call first
      const call = new Call({
        clientId: nonExistentClientId,
        callSid: 'test-call-sid-2',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      
      await request(app)
        .post(`/v1/conversations/client/${nonExistentClientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 401 when no authorization token provided', async () => {
      const { client } = await setupTestData();

      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: 'test-call-sid-unauth',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();

      await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 when user lacks permission', async () => {
      const { accessToken, client } = await setupTestDataWithCaregiverTwo();

      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: 'test-call-sid-forbidden',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();

      // Try to create a conversation with staff role (should fail)
      await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /v1/conversations/:conversationId', () => {
    test('should return 200 and a conversation if data is ok', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: 'test-call-sid-4',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();

      // Create a conversation first
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const res = await request(app)
        .get(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: conversationId,
        clientId: client._id.toString(),
        callSid: expect.any(String),
        messages: expect.arrayContaining([]),
        analyzedData: expect.any(Object),
        metadata: expect.any(Object),
        startTime: expect.any(String),
        endTime: null,
        duration: expect.any(Number),
        status: expect.any(String),
        callStatus: expect.any(String),
        callStartTime: expect.any(String),
        callEndTime: null,
        callDuration: expect.any(Number),
        callOutcome: null,
        sentiment: null,
        sentimentAnalyzedAt: null,
        callNotes: expect.any(String),
        agentId: null,
        lineItemId: null,
      });
    });

    test('should return 404 when conversation does not exist', async () => {
      const { accessToken } = await setupTestData();
      const nonExistentConversationId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/v1/conversations/${nonExistentConversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 401 when no authorization token provided', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      await request(app)
        .get(`/v1/conversations/${conversationId}`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 when user lacks permission', async () => {
      const { accessToken, client } = await setupTestDataWithCaregiverTwo();

      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: 'test-call-sid-forbidden-get',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();

      // Try to create a conversation with staff role (should fail)
      await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should allow staff to read conversations of their own clients', async () => {
      // Create unique caregivers for this test
      const [org] = await insertOrgs([admin]);
      
      // Create orgAdmin caregiver manually
      const orgAdminCaregiver = new Caregiver({
        name: 'Test OrgAdmin',
        email: 'orgadmin@test.com',
        phone: '+16045624263',
        role: 'orgAdmin',
        org: org._id,
        clients: [],
        password: 'Password1'
      });
      await orgAdminCaregiver.save();
      
      // Create staff caregiver manually
      const staffCaregiver = new Caregiver({
        name: 'Test Staff',
        email: 'staff@test.com',
        phone: '+16045624263',
        role: 'staff',
        org: org._id,
        clients: [],
        password: 'Password1'
      });
      await staffCaregiver.save();
      
      const orgAdminTokens = await tokenService.generateAuthTokens(orgAdminCaregiver);
      const staffTokens = await tokenService.generateAuthTokens(staffCaregiver);
      const orgAdminToken = orgAdminTokens.access.token;
      const staffToken = staffTokens.access.token;
      
      // Create unique client for this test
      const client = new Client({
        name: 'Test Client 1',
        email: 'client1@test.com',
        phone: '+16045624263',
        caregiver: staffCaregiver._id,
        org: org._id,
        schedules: []
      });
      await client.save();
      
      // Add client to caregiver
      staffCaregiver.clients.push(client._id);
      await staffCaregiver.save();

      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: 'test-call-sid-staff-access',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();

      // Create a conversation first (using orgAdmin token)
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      // Now try to read it with staff token (should work)
      await request(app)
        .get(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(httpStatus.OK);
    });

    test('should deny staff access to conversations of other clients', async () => {
      // Create unique caregivers for this test
      const [org] = await insertOrgs([admin]);
      
      // Create orgAdmin caregiver manually
      const orgAdminCaregiver = new Caregiver({
        name: 'Test OrgAdmin 2',
        email: 'orgadmin2@test.com',
        phone: '+16045624263',
        role: 'orgAdmin',
        org: org._id,
        clients: [],
        password: 'Password1'
      });
      await orgAdminCaregiver.save();
      
      // Create staff caregiver 1 manually
      const staffCaregiver1 = new Caregiver({
        name: 'Test Staff 1',
        email: 'staff1@test.com',
        phone: '+16045624263',
        role: 'staff',
        org: org._id,
        clients: [],
        password: 'Password1'
      });
      await staffCaregiver1.save();
      
      // Create staff caregiver 2 manually
      const staffCaregiver2 = new Caregiver({
        name: 'Test Staff 2',
        email: 'staff2@test.com',
        phone: '+16045624263',
        role: 'staff',
        org: org._id,
        clients: [],
        password: 'Password1'
      });
      await staffCaregiver2.save();
      
      const orgAdminTokens = await tokenService.generateAuthTokens(orgAdminCaregiver);
      const staffTokens1 = await tokenService.generateAuthTokens(staffCaregiver1);
      const orgAdminToken = orgAdminTokens.access.token;
      const staffToken1 = staffTokens1.access.token;
      
      // Create unique clients for this test
      const client1 = new Client({
        name: 'Test Client 1',
        email: 'client1@test2.com',
        phone: '+16045624263',
        caregiver: staffCaregiver1._id,
        org: org._id,
        schedules: []
      });
      await client1.save();
      
      const client2 = new Client({
        name: 'Test Client 2',
        email: 'client2@test2.com',
        phone: '+16045624263',
        caregiver: staffCaregiver2._id,
        org: org._id,
        schedules: []
      });
      await client2.save();
      
      // Add clients to caregivers
      staffCaregiver1.clients.push(client1._id);
      await staffCaregiver1.save();
      
      staffCaregiver2.clients.push(client2._id);
      await staffCaregiver2.save();

      // Create a call first
      const call = new Call({
        clientId: client2._id,
        callSid: 'test-call-sid-staff-forbidden',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();

      // Create a conversation for client2 using orgAdmin
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client2._id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      // Try to read it with staff1 token (should fail - different client)
      await request(app)
        .get(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /v1/conversations/:conversationId', () => {
    test('should add a message to a conversation', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const messageData = {
        role: 'client',
        content: 'Hello, this is a test message',
      };

      const res = await request(app)
        .post(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(messageData)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: conversationId,
        clientId: client._id.toString(),
        callSid: expect.any(String),
        messages: expect.arrayContaining([expect.any(Object)]),
        analyzedData: expect.any(Object),
        metadata: expect.any(Object),
        startTime: expect.any(String),
        endTime: null,
        duration: expect.any(Number),
        status: expect.any(String),
        callStatus: expect.any(String),
        callStartTime: expect.any(String),
        callEndTime: null,
        callDuration: expect.any(Number),
        callOutcome: null,
        callNotes: expect.any(String),
        agentId: null,
        lineItemId: null,
        sentiment: null,
        sentimentAnalyzedAt: null,
      });

      // Verify the message was actually created
      const message = await Message.findOne({ conversationId });
      expect(message).toBeTruthy();
      expect(message.role).toBe('client');
      expect(message.content).toBe('Hello, this is a test message');
    });

    test('should add an assistant message to a conversation', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const messageData = {
        role: 'assistant',
        content: 'Hello! How can I help you today?',
      };

      const res = await request(app)
        .post(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(messageData)
        .expect(httpStatus.OK);

      expect(res.body.messages).toHaveLength(1);

      // Verify the message was actually created
      const message = await Message.findOne({ conversationId });
      expect(message).toBeTruthy();
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hello! How can I help you today?');
    });

    test('should add a system message to a conversation', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const messageData = {
        role: 'system',
        content: 'System notification: Call started',
      };

      const res = await request(app)
        .post(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(messageData)
        .expect(httpStatus.OK);

      expect(res.body.messages).toHaveLength(1);

      // Verify the message was actually created
      const message = await Message.findOne({ conversationId });
      expect(message).toBeTruthy();
      expect(message.role).toBe('system');
      expect(message.content).toBe('System notification: Call started');
    });

    test('should return 400 when role is invalid', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const messageData = {
        role: 'invalid_role',
        content: 'This should fail',
      };

      await request(app)
        .post(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(messageData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 when content is missing', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const messageData = {
        role: 'client',
        // content is missing
      };

      await request(app)
        .post(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(messageData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 when role is missing', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const messageData = {
        content: 'This should fail without role',
      };

      await request(app)
        .post(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(messageData)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 when conversation does not exist', async () => {
      const { accessToken } = await setupTestData();
      const nonExistentConversationId = new mongoose.Types.ObjectId();
      const messageData = {
        role: 'client',
        content: 'This should fail',
      };

      await request(app)
        .post(`/v1/conversations/${nonExistentConversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(messageData)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 401 when no authorization token provided', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const messageData = {
        role: 'client',
        content: 'This should fail',
      };

      await request(app)
        .post(`/v1/conversations/${conversationId}`)
        .send(messageData)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 when user lacks permission', async () => {
      // Create orgAdmin to create conversation, then staff to try to add message
      const { accessToken: orgAdminToken, client, org } = await setupTestData();
      // Create staff caregiver in the same org (use caregiverTwo to avoid duplicate email)
      const { accessToken: staffToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverTwo);

      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: 'test-call-sid-forbidden-post',
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();

      // Create conversation with orgAdmin
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      // Try to add message with staff role (should fail - staff doesn't have access to this client)
      await request(app)
        .post(`/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ role: 'client', content: 'test' })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('Multiple messages in conversation', () => {
    test('should handle multiple messages in a conversation', async () => {
      const { accessToken, client } = await setupTestData();

      // Create a conversation first
      // Create a call first
      const call = new Call({
        clientId: client._id,
        callSid: `test-call-sid-${Date.now()}`,
        status: 'in-progress',
        startTime: new Date()
      });
      await call.save();
      const createRes = await request(app)
        .post(`/v1/conversations/client/${client._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ callId: call._id.toString() })
        .expect(httpStatus.CREATED);

      const conversationId = createRes.body.id;

      const messages = [
        { role: 'client', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you! How can I help you today?' },
        { role: 'client', content: 'I have a question about my medication.' },
        { role: 'assistant', content: 'I would be happy to help with your medication questions.' },
        { role: 'system', content: 'Call quality: Good' },
      ];

      for (const messageData of messages) {
        await request(app)
          .post(`/v1/conversations/${conversationId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(messageData)
          .expect(httpStatus.OK);
      }

      // Verify all messages were created
      const conversation = await Conversation.findById(conversationId).populate('messages');
      expect(conversation.messages).toHaveLength(5);

      // Verify message order and content
      const messageContents = conversation.messages.map(msg => msg.content);
      expect(messageContents).toContain('Hello, how are you?');
      expect(messageContents).toContain('I am doing well, thank you! How can I help you today?');
      expect(messageContents).toContain('I have a question about my medication.');
      expect(messageContents).toContain('I would be happy to help with your medication questions.');
      expect(messageContents).toContain('Call quality: Good');
    });
  });
});