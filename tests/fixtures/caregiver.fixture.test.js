const mongoose = require('mongoose');
const { insertCaregivers, insertCaregiversAndAddToOrg } = require('../fixtures/caregiver.fixture');
const { Caregiver } = require('../../src/models');

describe('Caregiver Fixture', () => {
  let testCaregivers;

  beforeEach(() => {
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
    });
  });

  describe('insertCaregiversAndAddToOrg', () => {
    it('should create caregivers with isEmailVerified set to true and add them to org', async () => {
      // Create a mock org
      const mockOrg = {
        id: new mongoose.Types.ObjectId(),
        caregivers: [],
        save: jest.fn().mockResolvedValue(true),
      };

      const insertedCaregivers = await insertCaregiversAndAddToOrg(mockOrg, testCaregivers);
      
      expect(insertedCaregivers).toHaveLength(2);
      insertedCaregivers.forEach(caregiver => {
        expect(caregiver.isEmailVerified).toBe(true);
        expect(caregiver.password).toBeDefined();
        expect(caregiver.org).toEqual(mockOrg.id);
      });
      
      expect(mockOrg.caregivers).toHaveLength(2);
      expect(mockOrg.save).toHaveBeenCalled();
    });
  });
});

