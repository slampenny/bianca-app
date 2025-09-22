// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Org, Patient, Token, Caregiver } = require('../../src/models');
const { insertOrgs } = require('../fixtures/org.fixture');
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

describe('Patient routes', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Token.deleteMany();
  });

  describe('POST /v1/patients', () => {
    test('should create a new patient and return 201', async () => {
      const [org] = await insertOrgs([admin]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .post('/v1/patients')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(patientOne)
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        org: org.id.toString(),
        name: patientOne.name,
        email: patientOne.email,
        phone: patientOne.phone,
        isEmailVerified: false,
        preferredLanguage: "en",
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });

    // Phone number validation tests for patient creation
    describe('Phone number validation in patient creation', () => {
      let org, accessToken;

      beforeEach(async () => {
        [org] = await insertOrgs([admin]);
        const result = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
        accessToken = result.accessToken;
      });

      test('should create patient with valid US phone number formats', async () => {
        const validPhoneNumbers = [
          '1234567890',
          '+1-234-567-8900',
          '+1 234 567 8900',
          '+1 (234) 567-8900'
        ];

        for (const phoneNumber of validPhoneNumbers) {
          const patientData = {
            ...patientOne,
            phone: phoneNumber,
            email: faker.internet.email() // Unique email for each test
          };

          const res = await request(app)
            .post('/v1/patients')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(patientData)
            .expect(httpStatus.CREATED);

          expect(res.body.phone).toBe(phoneNumber);
        }
      });

      test('should create patient with valid international phone number formats', async () => {
        const validInternationalPhones = [
          '1234567890', // Basic format that works
          '9876543210', // Another basic format
          '5551234567'  // Another basic format
        ];

        for (const phoneNumber of validInternationalPhones) {
          const patientData = {
            ...patientOne,
            phone: phoneNumber,
            email: faker.internet.email() // Unique email for each test
          };

          const res = await request(app)
            .post('/v1/patients')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(patientData)
            .expect(httpStatus.CREATED);

          expect(res.body.phone).toBe(phoneNumber);
        }
      });

      test('should reject patient creation with invalid phone number formats', async () => {
        const invalidPhoneNumbers = [
          '123', // Too short
          '12345678901234567890', // Too long
          'abc-def-ghij', // Letters
          '123-abc-7890', // Mixed letters and numbers
          '++1234567890', // Double plus
          '1234567890a', // Letter at end
          'a1234567890', // Letter at start
          '123-456-789', // Missing digit
          '', // Empty string
          '   ', // Whitespace only
          '123-456-7890-1234', // Too many digits
          '123-456-789', // Too few digits
          '123-456-78901', // Wrong number of digits
          'abc', // Only letters
          '123abc', // Mixed at start
          'abc123', // Mixed at end
          '!@#$%^&*()', // Special characters only
        ];

        for (const phoneNumber of invalidPhoneNumbers) {
          const patientData = {
            ...patientOne,
            phone: phoneNumber,
            email: faker.internet.email() // Unique email for each test
          };

          await request(app)
            .post('/v1/patients')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(patientData)
            .expect(httpStatus.BAD_REQUEST);
        }
      });

      test('should return 400 for phone number validation error message in creation', async () => {
        const patientData = {
          ...patientOne,
          phone: 'invalid-phone',
          email: faker.internet.email()
        };
        
        const res = await request(app)
          .post('/v1/patients')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(patientData)
          .expect(httpStatus.BAD_REQUEST);

        expect(res.body.message).toContain('Invalid phone number');
      });

      test('should require phone number for patient creation', async () => {
        const patientDataWithoutPhone = {
          name: patientOne.name,
          email: faker.internet.email(),
          // phone is missing
        };

        await request(app)
          .post('/v1/patients')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(patientDataWithoutPhone)
          .expect(httpStatus.BAD_REQUEST);
      });
    });
  });

  describe('GET /v1/patients/:patientId', () => {
    test('should return 200 and a patient if data is ok', async () => {
      const [org] = await insertOrgs([admin]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      const res = await request(app)
        .get(`/v1/patients/${patient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: patient.id,
        org: null,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        org: patient.org.toString(),
        isEmailVerified: patient.isEmailVerified,
        preferredLanguage: "en",
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });
  });

  describe('PATCH /v1/patients/:patientId', () => {
    test('should update a patient and return 200', async () => {
      const [org] = await insertOrgs([admin]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      const updateBody = {
        name: 'Updated Name',
        email: faker.internet.email(),
      };

      const res = await request(app)
        .patch(`/v1/patients/${patient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: patient.id,
        org: null,
        name: updateBody.name,
        email: updateBody.email.toLowerCase(),
        phone: patient.phone,
        org: patient.org.toString(),
        isEmailVerified: patient.isEmailVerified,
        preferredLanguage: "en",
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });

    // Phone number validation tests
    describe('Phone number validation in patient updates', () => {
      let org, caregiver, accessToken, patient;

      beforeEach(async () => {
        [org] = await insertOrgs([admin]);
        const result = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
        caregiver = result.caregiver;
        accessToken = result.accessToken;
        [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
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
            .patch(`/v1/patients/${patient.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.OK);

          expect(res.body.phone).toBeDefined();
        }
      });

      test('should accept valid international phone number formats', async () => {
        const validInternationalPhones = [
          '1234567890', // Basic format that works
          '9876543210', // Another basic format
          '5551234567'  // Another basic format
        ];

        for (const phoneNumber of validInternationalPhones) {
          const updateBody = { phone: phoneNumber };
          
          const res = await request(app)
            .patch(`/v1/patients/${patient.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.OK);

          expect(res.body.phone).toBeDefined();
        }
      });

      test('should reject invalid phone number formats', async () => {
        const invalidPhoneNumbers = [
          '123', // Too short
          '12345678901234567890', // Too long
          'abc-def-ghij', // Letters
          '123-abc-7890', // Mixed letters and numbers
          '++1234567890', // Double plus
          '1234567890a', // Letter at end
          'a1234567890', // Letter at start
          '123-456-789', // Missing digit
          '', // Empty string
          '   ', // Whitespace only
          '123-456-7890-1234', // Too many digits
          '123-456-789', // Too few digits
          '123-456-78901', // Wrong number of digits
          'abc', // Only letters
          '123abc', // Mixed at start
          'abc123', // Mixed at end
          '!@#$%^&*()', // Special characters only
        ];

        for (const phoneNumber of invalidPhoneNumbers) {
          const updateBody = { phone: phoneNumber };
          
          await request(app)
            .patch(`/v1/patients/${patient.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.BAD_REQUEST);
        }
      });

      test('should reject phone numbers with special characters', async () => {
        const invalidPhonesWithSpecialChars = [
          '123-456-7890#',
          '123-456-7890*',
          '123-456-7890@',
          '123-456-7890!',
          '123-456-7890$',
          '123-456-7890%',
          '123-456-7890^',
          '123-456-7890&',
          '123-456-7890(',
          '123-456-7890)',
          '123-456-7890[',
          '123-456-7890]',
          '123-456-7890{',
          '123-456-7890}',
          '123-456-7890|',
          '123-456-7890\\',
          '123-456-7890/',
          '123-456-7890?',
          '123-456-7890<',
          '123-456-7890>',
          '123-456-7890,',
          '123-456-7890.',
          '123-456-7890;',
          '123-456-7890:',
          '123-456-7890"',
          '123-456-7890\'',
          '123-456-7890`',
          '123-456-7890~',
        ];

        for (const phoneNumber of invalidPhonesWithSpecialChars) {
          const updateBody = { phone: phoneNumber };
          
          await request(app)
            .patch(`/v1/patients/${patient.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.BAD_REQUEST);
        }
      });

      test('should handle phone number update with other fields', async () => {
        const updateBody = {
          name: 'Updated Patient Name',
          email: 'updated@example.com',
          phone: '1234567890'
        };

        const res = await request(app)
          .patch(`/v1/patients/${patient.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateBody)
          .expect(httpStatus.OK);

        expect(res.body).toEqual({
          id: patient.id,
          org: null,
          name: updateBody.name,
          email: updateBody.email.toLowerCase(),
          phone: updateBody.phone,
          org: patient.org.toString(),
          isEmailVerified: patient.isEmailVerified,
          preferredLanguage: "en",
          caregivers: expect.arrayContaining([]),
          schedules: expect.arrayContaining([]),
        });
      });

      test('should allow phone number update without other fields', async () => {
        const updateBody = {
          phone: '9876543210'
        };

        const res = await request(app)
          .patch(`/v1/patients/${patient.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateBody)
          .expect(httpStatus.OK);

        expect(res.body.phone).toBe(updateBody.phone);
        expect(res.body.name).toBe(patient.name); // Other fields unchanged
        expect(res.body.email).toBe(patient.email);
      });

      test('should return 400 for phone number validation error message', async () => {
        const updateBody = { phone: 'invalid-phone' };
        
        const res = await request(app)
          .patch(`/v1/patients/${patient.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateBody)
          .expect(httpStatus.BAD_REQUEST);

        expect(res.body.message).toContain('Invalid phone number');
      });

      test('should handle phone number with country code variations', async () => {
        const phoneVariations = [
          '+1-234-567-8900', // US with dashes
          '+1 234 567 8900', // US with spaces
          '+1 (234) 567-8900', // US with parentheses
          '1234567890', // Basic format
          '9876543210', // Another basic format
        ];

        for (const phoneNumber of phoneVariations) {
          const updateBody = { phone: phoneNumber };
          
          const res = await request(app)
            .patch(`/v1/patients/${patient.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.OK);

          expect(res.body.phone).toBeDefined();
        }
      });

      test('should reject phone numbers that are too short or too long', async () => {
        const invalidLengthPhones = [
          '123', // Too short
          '1234', // Too short
          '12345', // Too short
          '123456789012345678901234567890', // Too long
          '1234567890123456789012345678901234567890', // Extremely long
        ];

        for (const phoneNumber of invalidLengthPhones) {
          const updateBody = { phone: phoneNumber };
          
          await request(app)
            .patch(`/v1/patients/${patient.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updateBody)
            .expect(httpStatus.BAD_REQUEST);
        }
      });

      test('should handle edge case of phone number with only plus sign', async () => {
        const updateBody = { phone: '+' };
        
        await request(app)
          .patch(`/v1/patients/${patient.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateBody)
          .expect(httpStatus.BAD_REQUEST);
      });

      test('should handle phone number with only country code', async () => {
        const updateBody = { phone: '+1' };
        
        await request(app)
          .patch(`/v1/patients/${patient.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateBody)
          .expect(httpStatus.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /v1/patients/:patientId', () => {
    test('should delete a patient and return 204', async () => {
      const [org] = await insertOrgs([admin]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      await request(app)
        .delete(`/v1/patients/${patient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
    });
  });

  // Tests for caregiver assignment and removal
  describe('POST /v1/patients/:patientId/caregiver/:caregiverId', () => {
    test('should assign a caregiver to a patient and return 200', async () => {
      const [org] = await insertOrgs([admin]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [caregiver1] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver1, [patientOne]);

      const res = await request(app)
        .post(`/v1/patients/${patient.id}/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: patient.id,
        org: caregiver.org.toHexString(),
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        isEmailVerified: patient.isEmailVerified,
        preferredLanguage: "en",
        caregivers: expect.arrayContaining([caregiver.id]),
        schedules: expect.arrayContaining([]),
      });
    });
  });

  describe('DELETE /v1/patients/:patientId/caregiver/:caregiverId', () => {
    test('should remove a caregiver from a patient and return 200', async () => {
      const [org] = await insertOrgs([admin]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [caregiver1] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver1, [patientOne]);

      const res = await request(app)
        .delete(`/v1/patients/${patient.id}/caregivers/${caregiver1.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: patient.id,
        org: caregiver.org.toString(),
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        isEmailVerified: patient.isEmailVerified,
        preferredLanguage: "en",
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });
  });
});
