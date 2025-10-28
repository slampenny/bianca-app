const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Caregiver, Patient } = require('../../../src/models');
const caregiverService = require('../../../src/services/caregiver.service');
const patientService = require('../../../src/services/patient.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { caregiverOneWithPassword, insertCaregivers } = require('../../fixtures/caregiver.fixture');
const { patientOne, insertPatients } = require('../../fixtures/patient.fixture');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('caregiverService', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
  });

  it('should create a new caregiver', async () => {
    const [org] = await insertOrgs([orgOne]);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    expect(caregiver).toHaveProperty('id');
    expect(caregiver).toHaveProperty('email', caregiverOneWithPassword.email);
    expect(caregiver).toHaveProperty('phone', caregiverOneWithPassword.phone);
  });

  it('should get a caregiver by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    const fetchedCaregiver = await caregiverService.getCaregiverById(caregiver.id);
    expect(fetchedCaregiver).toHaveProperty('id', caregiver.id);
  });

  it('should get a caregiver by email', async () => {
    const [org] = await insertOrgs([orgOne]);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    const fetchedCaregiver = await caregiverService.getCaregiverByEmail(caregiver.email);
    expect(fetchedCaregiver).toHaveProperty('id', caregiver.id);
  });

  it('should update a caregiver by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    const updateBody = { name: 'Updated Caregiver' };
    const updatedCaregiver = await caregiverService.updateCaregiverById(caregiver.id, updateBody);
    expect(updatedCaregiver).toHaveProperty('name', updateBody.name);
  });

  it('should delete a caregiver by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await caregiverService.deleteCaregiverById(caregiver.id);
    const fetchedCaregiver = await caregiverService.getCaregiverById(caregiver.id);
    expect(fetchedCaregiver).toBeNull();
  });

  it('should query caregivers', async () => {
    await insertCaregivers([caregiverOneWithPassword]);
    const caregivers = await caregiverService.queryCaregivers({}, {});
    expect(caregivers).toEqual({
      results: expect.any(Array),
      page: 1,
      limit: 10,
      totalPages: 1,
      totalResults: 1,
    });
  });

  it('should assign a patient to a caregiver', async () => {
    const [org] = await insertOrgs([orgOne]);
    const patient = await patientService.createPatient(patientOne);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    const addedPatient = await caregiverService.addPatient(caregiver.id, patient.id);
    expect(addedPatient.id).toEqual(patient.id);
  });

  it('should remove a patient from a caregiver', async () => {
    const [org] = await insertOrgs([orgOne]);
    const patient = await patientService.createPatient(patientOne);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await caregiverService.addPatient(caregiver.id, patient.id);
    const updatedCaregiver = await caregiverService.removePatient(caregiver.id, patient.id);
    expect(updatedCaregiver.patients.toObject()).toEqual([]);
  });

  it('should get patients by caregiver id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const patient = await patientService.createPatient(patientOne);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await caregiverService.addPatient(caregiver.id, patient.id);
    const patients = await caregiverService.getPatients(caregiver.id);
    expect(patients).toHaveLength(1);
    expect(patients[0]).toHaveProperty('id', patient.id);
  });

  describe('Role Promotion Logic', () => {
    let org;

    beforeEach(async () => {
      [org] = await insertOrgs([orgOne]);
    });

    describe('Invited Users', () => {
      it('should promote invited user to staff when completing profile', async () => {
        // Create an invited user
        const invitedCaregiver = await Caregiver.create({
          org: org.id,
          name: 'Invited User',
          email: 'invited@example.com',
          role: 'invited',
          phone: '+16045624263', // Valid phone number
        });

        // Update with additional profile information including password (required for staff)
        const updateBody = { 
          name: 'Updated Invited User',
          phone: '+16045624263', // Phone is already set, but updating profile
          password: 'Password123' // Required when becoming staff
        };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(invitedCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('staff');
        expect(updatedCaregiver.name).toBe('Updated Invited User');
      });

      it('should promote invited user to staff when adding phone number', async () => {
        // Create an invited user with phone (required)
        const invitedCaregiver = await Caregiver.create({
          org: org.id,
          name: 'Invited User',
          email: 'invited@example.com',
          role: 'invited',
          phone: '+15555555555', // Has phone already
        });

        // Update phone and add password to complete profile (promotes to staff)
        const updateBody = { 
          phone: '+16045624263',
          password: 'Password123' // Required when becoming staff
        };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(invitedCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('staff');
        expect(updatedCaregiver.phone).toBe('+16045624263');
      });

      it('should promote invited user to staff even if they have SSO provider', async () => {
        // Create an invited user who later logged in via SSO
        const invitedCaregiver = await Caregiver.create({
          org: org.id,
          name: 'Invited User',
          email: 'invited@example.com',
          role: 'invited',
          ssoProvider: 'google', // They logged in via SSO after being invited
          ssoProviderId: 'google123',
          phone: '+15555555555', // Invited users require phone
        });

        // Complete profile, including password (required for staff)
        const updateBody = { 
          phone: '+16045624263',
          password: 'Password123' // Required when becoming staff
        };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(invitedCaregiver.id, updateBody);
        
        // Should still be staff, not orgAdmin, because they were invited
        expect(updatedCaregiver.role).toBe('staff');
        expect(updatedCaregiver.phone).toBe('+16045624263');
      });
    });

    describe('SSO Users (Unverified)', () => {
      it('should promote SSO user to orgAdmin when completing profile', async () => {
        // Create an SSO user (unverified)
        const ssoCaregiver = await Caregiver.create({
          org: org.id,
          name: 'SSO User',
          email: 'sso@example.com',
          role: 'unverified',
          ssoProvider: 'google',
          ssoProviderId: 'google123',
          isEmailVerified: true,
          // No phone initially - unverified users don't require phone
        });

        // Complete profile by adding phone
        const updateBody = { phone: '+16045624263' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(ssoCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('orgAdmin');
        expect(updatedCaregiver.phone).toBe('+16045624263');
      });

      it('should update org phone when SSO user becomes orgAdmin', async () => {
        // Create org without phone
        const orgWithoutPhone = await Org.create({
          name: 'Test Org',
          email: 'org@example.com',
          caregivers: [],
        });

        // Create an SSO user
        const ssoCaregiver = await Caregiver.create({
          org: orgWithoutPhone.id,
          name: 'SSO User',
          email: 'sso@example.com',
          role: 'unverified',
          ssoProvider: 'google',
          ssoProviderId: 'google123',
          // No phone initially - unverified users don't require phone
        });

        // Complete profile
        const updateBody = { phone: '+16045624263' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(ssoCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('orgAdmin');
        
        // Check that org phone was updated
        const updatedOrg = await Org.findById(orgWithoutPhone.id);
        expect(updatedOrg.phone).toBe('+16045624263');
      });

      it('should not update org phone if org already has phone', async () => {
        const existingPhone = '+16045624264';
        
        // Create org with existing phone
        const orgWithPhone = await Org.create({
          name: 'Test Org',
          email: 'org@example.com',
          phone: existingPhone,
          caregivers: [],
        });

        // Create an SSO user
        const ssoCaregiver = await Caregiver.create({
          org: orgWithPhone.id,
          name: 'SSO User',
          email: 'sso@example.com',
          role: 'unverified',
          ssoProvider: 'google',
          ssoProviderId: 'google123',
          // No phone initially - unverified users don't require phone
        });

        // Complete profile
        const updateBody = { phone: '+16045624263' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(ssoCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('orgAdmin');
        
        // Check that org phone was NOT updated
        const updatedOrg = await Org.findById(orgWithPhone.id);
        expect(updatedOrg.phone).toBe(existingPhone);
      });
    });

    describe('Unverified Users Without SSO', () => {
      it('should promote unverified user without SSO to staff', async () => {
        // Create an unverified user without SSO (edge case)
        const unverifiedCaregiver = await Caregiver.create({
          org: org.id,
          name: 'Unverified User',
          email: 'unverified@example.com',
          role: 'unverified',
          password: 'Password123', // Required for non-SSO users
          // No ssoProvider
          // No phone initially - unverified users don't require phone
        });

        // Complete profile
        const updateBody = { phone: '+16045624263' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(unverifiedCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('staff');
        expect(updatedCaregiver.phone).toBe('+16045624263');
      });
    });

    describe('Already Verified Users', () => {
      it('should not change role for staff user', async () => {
        const staffCaregiver = await Caregiver.create({
          org: org.id,
          name: 'Staff User',
          email: 'staff@example.com',
          role: 'staff',
          phone: '+16045624263',
          password: 'Password123', // Required for staff
        });

        const updateBody = { name: 'Updated Staff User' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(staffCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('staff');
        expect(updatedCaregiver.name).toBe('Updated Staff User');
      });

      it('should not change role for orgAdmin user', async () => {
        const orgAdminCaregiver = await Caregiver.create({
          org: org.id,
          name: 'OrgAdmin User',
          email: 'orgadmin@example.com',
          role: 'orgAdmin',
          phone: '+16045624263',
          password: 'Password123', // Required for orgAdmin
        });

        const updateBody = { name: 'Updated OrgAdmin User' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(orgAdminCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('orgAdmin');
        expect(updatedCaregiver.name).toBe('Updated OrgAdmin User');
      });

      it('should not change role for superAdmin user', async () => {
        const superAdminCaregiver = await Caregiver.create({
          org: org.id,
          name: 'SuperAdmin User',
          email: 'superadmin@example.com',
          role: 'superAdmin',
          phone: '+16045624263',
          password: 'Password123', // Required for superAdmin
        });

        const updateBody = { name: 'Updated SuperAdmin User' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(superAdminCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('superAdmin');
        expect(updatedCaregiver.name).toBe('Updated SuperAdmin User');
      });
    });

    describe('Edge Cases', () => {
      it('should not promote if only name is updated without phone', async () => {
        const invitedCaregiver = await Caregiver.create({
          org: org.id,
          name: 'Invited User',
          email: 'invited@example.com',
          role: 'invited',
          phone: '+16045624263', // Invited users require phone
        });

        // Update without phone - should not promote
        const updateBody = { name: 'Updated Name' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(invitedCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('invited'); // Should remain invited (phone was already set)
        expect(updatedCaregiver.name).toBe('Updated Name');
      });

      it('should promote invited user with password', async () => {
        // This test verifies that invited users with phone can be promoted to staff with password
        const invitedCaregiver = await Caregiver.create({
          org: org.id,
          name: 'Invited User',
          email: 'invited2@example.com',
          role: 'invited',
          phone: '+15555555555', // Invited users require phone
        });

        // Add password to become staff
        const updateBody = { phone: '+16045624263', password: 'Password123' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(invitedCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('staff');
        expect(updatedCaregiver.phone).toBe('+16045624263');
      });

      it('should handle multiple SSO providers correctly', async () => {
        const ssoCaregiver = await Caregiver.create({
          org: org.id,
          name: 'SSO User',
          email: 'sso@example.com',
          role: 'unverified',
          ssoProvider: 'microsoft', // Different provider
          ssoProviderId: 'microsoft123',
          // No phone initially - unverified users don't require phone
        });

        const updateBody = { phone: '+16045624263' };
        
        const updatedCaregiver = await caregiverService.updateCaregiverById(ssoCaregiver.id, updateBody);
        
        expect(updatedCaregiver.role).toBe('orgAdmin');
        expect(updatedCaregiver.ssoProvider).toBe('microsoft');
      });
    });
  });
});
