// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Org, Client, Token, Caregiver, OnboardingResponse, Call } = require('../../src/models');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { clientOne, insertClientsAndAddToCaregiver, insertClientsWithOrg } = require('../fixtures/client.fixture');

const {
  caregiverOne,
  admin,
  insertCaregivertoOrgAndReturnToken,
  insertCaregivertoOrgAndReturnTokenByRole,
  insertCaregivers,
  insertCaregiversAndAddToOrg,
} = require('../fixtures/caregiver.fixture');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Client routes', () => {
  afterEach(async () => {
    await OnboardingResponse.deleteMany();
    await Call.deleteMany();
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Client.deleteMany();
    await Token.deleteMany();
  });

  describe('POST /v1/clients', () => {
    test('should create a new client and return 201', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .post('/v1/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...clientOne, org: org._id })
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        org: org.id.toString(),
        name: clientOne.name,
        email: clientOne.email,
        phone: clientOne.phone,
        isEmailVerified: false,
        preferredLanguage: 'en',
        consented: true,
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });

    describe('Phone number validation in client creation', () => {
      let org, accessToken;

      beforeEach(async () => {
        [org] = await insertOrgs([orgOne]);
        const result = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
        accessToken = result.accessToken;
      });

      test('should create client with valid US phone number formats', async () => {
        const validPhoneNumbers = [
          '1234567890',
          '+1-234-567-8900',
          '+1 234 567 8900',
          '+1 (234) 567-8900'
        ];

        for (const phoneNumber of validPhoneNumbers) {
          const clientData = {
            ...clientOne,
            org: org._id,
            phone: phoneNumber,
            email: faker.internet.email()
          };

          const res = await request(app)
            .post('/v1/clients')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(clientData)
            .expect(httpStatus.CREATED);

          expect(res.body.phone).toBe(phoneNumber);
        }
      });

      test('should create client with valid international phone number formats', async () => {
        const validInternationalPhones = [
          '1234567890',
          '9876543210',
          '5551234567'
        ];

        for (const phoneNumber of validInternationalPhones) {
          const clientData = {
            ...clientOne,
            org: org._id,
            phone: phoneNumber,
            email: faker.internet.email()
          };

          const res = await request(app)
            .post('/v1/clients')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(clientData)
            .expect(httpStatus.CREATED);

          expect(res.body.phone).toBe(phoneNumber);
        }
      });

      test('should reject client creation with invalid phone number formats', async () => {
        const invalidPhoneNumbers = [
          '123',
          '12345678901234567890',
          'abc-def-ghij',
          '123-abc-7890',
          '++1234567890',
          '1234567890a',
          'a1234567890',
          '123-456-789',
          '',
          '   ',
          '123-456-7890-1234',
          '123-456-789',
          '123-456-78901',
          'abc',
          '123abc',
          'abc123',
          '!@#$%^&*()',
        ];

        for (const phoneNumber of invalidPhoneNumbers) {
          const clientData = {
            ...clientOne,
            org: org._id,
            phone: phoneNumber,
            email: faker.internet.email()
          };

          await request(app)
            .post('/v1/clients')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(clientData)
            .expect(httpStatus.BAD_REQUEST);
        }
      });

      test('should return 400 for phone number validation error message in creation', async () => {
        const clientData = {
          ...clientOne,
          org: org._id,
          phone: 'invalid-phone',
          email: faker.internet.email()
        };

        const res = await request(app)
          .post('/v1/clients')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(clientData)
          .expect(httpStatus.BAD_REQUEST);

        expect(res.body.message).toContain('Invalid phone number');
      });

      test('should require phone number for client creation', async () => {
        const clientDataWithoutPhone = {
          name: clientOne.name,
          email: faker.internet.email(),
          org: org._id,
        };

        await request(app)
          .post('/v1/clients')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(clientDataWithoutPhone)
          .expect(httpStatus.BAD_REQUEST);
      });
    });
  });

  describe('GET /v1/clients/:clientId', () => {
    test('should return 200 and a client if data is ok', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);

      const res = await request(app)
        .get(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('name', client.name);
      expect(res.body).toHaveProperty('id');
      // Staff role may receive filtered fields per minimum necessary; exact shape depends on config
      expect(res.body.id).toBe(client.id);
    });
  });

  describe('PATCH /v1/clients/:clientId', () => {
    test('should update a client and return 200', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);

      const updateBody = {
        name: 'Updated Name',
        email: faker.internet.email(),
      };

      const res = await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        id: client.id,
        name: updateBody.name,
        email: updateBody.email.toLowerCase(),
        phone: client.phone,
      });
      expect(res.body).toHaveProperty('org');
      expect(res.body).toHaveProperty('caregivers');
      expect(res.body).toHaveProperty('schedules');
    });

    describe('Phone number validation in client updates', () => {
      let org, caregiver, accessToken, client;

      beforeEach(async () => {
        [org] = await insertOrgs([orgOne]);
        const result = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
        caregiver = result.caregiver;
        accessToken = result.accessToken;
        [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);
      });

      test('should accept valid US phone number formats', async () => {
        const validPhoneNumbers = [
          '1234567890',
          '+1-234-567-8900',
          '+1 234 567 8900',
          '+1 (234) 567-8900'
        ];

        for (const phoneNumber of validPhoneNumbers) {
          const updateBody = { phone: phoneNumber };

          const res = await request(app)
            .patch(`/v1/clients/${client.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.OK);

          expect(res.body.phone).toBeDefined();
        }
      });

      test('should accept valid international phone number formats', async () => {
        const validInternationalPhones = [
          '1234567890',
          '9876543210',
          '5551234567'
        ];

        for (const phoneNumber of validInternationalPhones) {
          const updateBody = { phone: phoneNumber };

          const res = await request(app)
            .patch(`/v1/clients/${client.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.OK);

          expect(res.body.phone).toBeDefined();
        }
      });

      test('should reject invalid phone number formats', async () => {
        const invalidPhoneNumbers = [
          '123',
          '12345678901234567890',
          'abc-def-ghij',
          '123-abc-7890',
          '++1234567890',
          '1234567890a',
          'a1234567890',
          '123-456-789',
          '',
          '   ',
          'abc',
          '!@#$%^&*()',
        ];

        for (const phoneNumber of invalidPhoneNumbers) {
          const updateBody = { phone: phoneNumber };

          await request(app)
            .patch(`/v1/clients/${client.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.BAD_REQUEST);
        }
      });

      test('should reject phone numbers with special characters', async () => {
        const invalidPhones = ['123-456-7890#', '123-456-7890*', '123-456-7890@'];

        for (const phoneNumber of invalidPhones) {
          await request(app)
            .patch(`/v1/clients/${client.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ phone: phoneNumber })
            .expect(httpStatus.BAD_REQUEST);
        }
      });

      test('should handle phone number update with other fields', async () => {
        const updateBody = {
          name: 'Updated Client Name',
          email: 'updated@example.com',
          phone: '1234567890'
        };

        const res = await request(app)
          .patch(`/v1/clients/${client.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateBody)
          .expect(httpStatus.OK);

        expect(res.body.name).toBe(updateBody.name);
        expect(res.body.email).toBe(updateBody.email.toLowerCase());
        expect(res.body.phone).toBe(updateBody.phone);
      });

      test('should allow phone number update without other fields', async () => {
        const updateBody = { phone: '9876543210' };

        const res = await request(app)
          .patch(`/v1/clients/${client.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateBody)
          .expect(httpStatus.OK);

        expect(res.body.phone).toBe(updateBody.phone);
        expect(res.body.name).toBe(client.name);
        expect(res.body.email).toBe(client.email);
      });

      test('should return 400 for phone number validation error message', async () => {
        const res = await request(app)
          .patch(`/v1/clients/${client.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ phone: 'invalid-phone' })
          .expect(httpStatus.BAD_REQUEST);

        expect(res.body.message).toContain('Invalid phone number');
      });

      test('should handle phone number with country code variations', async () => {
        const phoneVariations = [
          '+1-234-567-8900',
          '+1 234 567 8900',
          '1234567890',
          '9876543210',
        ];

        for (const phoneNumber of phoneVariations) {
          const res = await request(app)
            .patch(`/v1/clients/${client.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ phone: phoneNumber })
            .expect(httpStatus.OK);

          expect(res.body.phone).toBeDefined();
        }
      });

      test('should reject phone numbers that are too short or too long', async () => {
        await request(app)
          .patch(`/v1/clients/${client.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ phone: '123' })
          .expect(httpStatus.BAD_REQUEST);

        await request(app)
          .patch(`/v1/clients/${client.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ phone: '123456789012345678901234567890' })
          .expect(httpStatus.BAD_REQUEST);
      });

      test('should handle edge case of phone number with only plus sign', async () => {
        await request(app)
          .patch(`/v1/clients/${client.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ phone: '+' })
          .expect(httpStatus.BAD_REQUEST);
      });

      test('should handle phone number with only country code', async () => {
        await request(app)
          .patch(`/v1/clients/${client.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ phone: '+1' })
          .expect(httpStatus.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /v1/clients/:clientId', () => {
    test('should delete a client and return 204', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);

      await request(app)
        .delete(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
    });
  });

  describe('POST /v1/clients/:clientId/caregivers/:caregiverId', () => {
    test('should assign a caregiver to a client and return 200', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [caregiver1] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
      const [client] = await insertClientsAndAddToCaregiver(caregiver1, [clientOne]);

      const res = await request(app)
        .post(`/v1/clients/${client.id}/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.id).toBe(client.id);
      expect(res.body.caregivers).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(res.body.caregivers).toContain(caregiver.id);
    });
  });

  describe('DELETE /v1/clients/:clientId/caregivers/:caregiverId', () => {
    test('should remove a caregiver from a client and return 200', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [caregiver1] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
      const [client] = await insertClientsAndAddToCaregiver(caregiver1, [clientOne]);

      const res = await request(app)
        .delete(`/v1/clients/${client.id}/caregivers/${caregiver1.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.id).toBe(client.id);
      expect(res.body.caregivers).toEqual(expect.arrayContaining([]));
    });
  });

  describe('POST /v1/clients/assign-unassigned', () => {
    test('should assign unassigned clients to a caregiver', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const [assigneeCaregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
      const [unassigned] = await insertClientsWithOrg(
        [{ ...clientOne, email: faker.internet.email(), phone: '3333333333', caregivers: [] }],
        org._id,
      );

      const res = await request(app)
        .post('/v1/clients/assign-unassigned')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ caregiverId: assigneeCaregiver.id, clientIds: [unassigned.id] })
        .expect(httpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      const cgIds = res.body[0].caregivers.map((id) => id.toString());
      expect(cgIds).toContain(assigneeCaregiver.id.toString());
    });
  });

  describe('GET /v1/clients/:clientId/onboarding', () => {
    test('should return journey and empty responses when no onboarding data', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);

      const res = await request(app)
        .get(`/v1/clients/${client.id}/onboarding`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        journey: {
          journeyComplete: false,
          hasAnyOnboardingActivity: false,
          sessionsCompletedCount: 0,
          currentDay: 1,
        },
        responses: [],
        questionCount: 0,
        flags: {
          safety: false,
          memory: false,
          mood: false,
          distress: false,
          confusion: false,
        },
      });
      expect(res.body.journey.days).toHaveLength(4);
      expect(res.body.journey.days[0]).toMatchObject({
        dayNumber: 1,
        totalQuestions: 6,
        capturedCount: 0,
        sessionCompleted: false,
      });
    });

    test('should return captures, flags, and filter by day', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);

      await OnboardingResponse.create({
        clientId: client._id,
        dayNumber: 1,
        questionId: 'day1_emotional_orientation',
        responseType: 'text',
        responseValue: 'Okay',
        safety_flag: true,
      });
      await OnboardingResponse.create({
        clientId: client._id,
        dayNumber: 2,
        questionId: 'day2_morning_routine',
        responseType: 'text',
        responseValue: 'Coffee first',
      });

      const all = await request(app)
        .get(`/v1/clients/${client.id}/onboarding`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(all.body.questionCount).toBe(2);
      expect(all.body.flags.safety).toBe(true);
      expect(all.body.responses).toHaveLength(2);
      expect(all.body.journey.hasAnyOnboardingActivity).toBe(true);

      const day1 = await request(app)
        .get(`/v1/clients/${client.id}/onboarding?day=1`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(day1.body.responses).toHaveLength(1);
      expect(day1.body.responses[0].questionId).toBe('day1_emotional_orientation');
      expect(day1.body.questionCount).toBe(2);
    });

    test('should mark journey day complete when latest onboarding call has onboardingCompletedAt', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [client] = await insertClientsAndAddToCaregiver(caregiver, [clientOne]);

      await Call.create({
        callSid: `onb-test-${Date.now()}`,
        clientId: client._id,
        status: 'completed',
        duration: 120,
        onboardingDay: 1,
        onboardingCompletedAt: new Date(),
        onboardingEndedEarlyReason: 'completed',
      });

      const res = await request(app)
        .get(`/v1/clients/${client.id}/onboarding`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.journey.sessionsCompletedCount).toBe(1);
      expect(res.body.journey.currentDay).toBe(2);
      expect(res.body.journey.days[0].sessionCompleted).toBe(true);
      expect(res.body.journey.journeyComplete).toBe(false);
    });

    test('should allow staff onboarding access when roster link is missing but caregiver is agent on a Call', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [unassigned] = await insertClientsWithOrg(
        [{ ...clientOne, email: 'unassigned-onb@example.org', caregivers: [] }],
        org._id
      );

      await Call.create({
        callSid: `onb-agent-fallback-${Date.now()}`,
        clientId: unassigned._id,
        caregiverId: caregiver._id,
        status: 'completed',
        callStatus: 'ended',
        duration: 60,
        onboardingDay: 1,
      });

      const res = await request(app)
        .get(`/v1/clients/${unassigned._id}/onboarding`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.journey.hasAnyOnboardingActivity).toBe(true);
    });
  });
});
