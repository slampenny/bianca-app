// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Org, Patient, Token, Caregiver } = require('../../src/models');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { patientOne, insertPatientsAndAddToCaregiver } = require('../fixtures/patient.fixture');

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
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Token.deleteMany();
  });

  describe('POST /v1/clients', () => {
    test('should create a new client and return 201', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .post('/v1/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...patientOne, org: org._id })
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        org: org.id.toString(),
        name: patientOne.name,
        email: patientOne.email,
        phone: patientOne.phone,
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
            ...patientOne,
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
            ...patientOne,
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
            ...patientOne,
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
          ...patientOne,
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
          name: patientOne.name,
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
      const [client] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

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
      const [client] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

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
        [client] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
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
      const [client] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

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
      const [client] = await insertPatientsAndAddToCaregiver(caregiver1, [patientOne]);

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
      const [client] = await insertPatientsAndAddToCaregiver(caregiver1, [patientOne]);

      const res = await request(app)
        .delete(`/v1/clients/${client.id}/caregivers/${caregiver1.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body.id).toBe(client.id);
      expect(res.body.caregivers).toEqual(expect.arrayContaining([]));
    });
  });
});
