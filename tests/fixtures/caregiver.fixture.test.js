const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { insertCaregivers, insertCaregiversAndAddToOrg } = require('../fixtures/caregiver.fixture');
const { Caregiver } = require('../../src/models');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Caregiver Fixture', () => {
  let testCaregivers;

  beforeEach(async () => {
    // Clear caregivers before each test
    const { Caregiver } = require('../../src/models');
    await Caregiver.deleteMany({});
    
    testCaregivers = [
      {
        name: 'Test User 1',
        email: 'test1@example.org',
        phone: '+16045624263',
        role: 'staff',
        patients: [],
      },
      {
        name: 'Test User 2',
        email: 'test2@example.org',
        phone: '+16045624263',
        role: 'orgAdmin',
        patients: [],
      },
    ];
  });

  describe('insertCaregivers', () => {
    it('should create caregivers with isEmailVerified set to true', async () => {
      const insertedCaregivers = await insertCaregivers(testCaregivers);
      
      expect(insertedCaregivers).toHaveLength(2);
      insertedCaregivers.forEach(caregiver => {
        expect(caregiver.isEmailVerified).toBe(true);
        expect(caregiver.password).toBeDefined();
      });
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('insertCaregiversAndAddToOrg', () => {
    it('should create caregivers with isEmailVerified set to true and add them to org', async () => {
      // Create a mock org
      const { Org } = require('../../src/models');
      const mockOrg = await Org.create({
        name: 'Test Org',
        email: 'test@example.org',
        phone: '+16045624263',
        caregivers: [],
      });

      const insertedCaregivers = await insertCaregiversAndAddToOrg(mockOrg, testCaregivers);
      
      expect(insertedCaregivers).toHaveLength(2);
      insertedCaregivers.forEach(caregiver => {
        expect(caregiver.isEmailVerified).toBe(true);
        expect(caregiver.password).toBeDefined();
        expect(caregiver.org.toString()).toBe(mockOrg._id.toString());
      });
      
      // Reload org to check caregivers were added
      const updatedOrg = await Org.findById(mockOrg._id);
      expect(updatedOrg.caregivers).toHaveLength(2);
    }, 10000); // Increase timeout to 10 seconds
  });
});

