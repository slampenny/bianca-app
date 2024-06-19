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
});
