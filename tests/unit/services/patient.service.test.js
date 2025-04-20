const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Caregiver, Patient } = require('../../../src/models');
const patientService = require('../../../src/services/patient.service');
const caregiverService = require('../../../src/services/caregiver.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { caregiverOneWithPassword } = require('../../fixtures/caregiver.fixture');
const { patientOne, patientTwo, insertPatients } = require('../../fixtures/patient.fixture');

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

describe('patientService', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
  });

  it('should create a new patient', async () => {
    const patient = await patientService.createPatient(patientOne);
    expect(patient).toHaveProperty('id');
    expect(patient).toHaveProperty('email', patientOne.email);
    expect(patient).toHaveProperty('phone', patientOne.phone);
    expect(patient).toHaveProperty('isEmailVerified', false);
  });

  it('should get a patient by id', async () => {
    const patient = await patientService.createPatient(patientOne);
    const fetchedPatient = await patientService.getPatientById(patient.id);
    expect(fetchedPatient).toHaveProperty('id', patient.id);
  });

  it('should get a patient by email', async () => {
    const patient = await patientService.createPatient(patientOne);
    const fetchedPatient = await patientService.getPatientByEmail(patient.email);
    expect(fetchedPatient).toHaveProperty('id', patient.id);
  });

  it('should update a patient by id', async () => {
    const patient = await patientService.createPatient(patientOne);
    const updateBody = { name: 'Updated Patient' };
    const updatedPatient = await patientService.updatePatientById(patient.id, updateBody);
    expect(updatedPatient).toHaveProperty('name', updateBody.name);
  });

  it('should delete a patient by id', async () => {
    const patient = await patientService.createPatient(patientOne);
    await patientService.deletePatientById(patient.id);
    const fetchedPatient = await patientService.getPatientById(patient.id);
    expect(fetchedPatient).toBeNull();
  });

  it('should query patients', async () => {
    await insertPatients([patientOne, patientTwo]);
    const patients = await patientService.queryPatients({}, {});
    expect(patients).toEqual({
      results: expect.any(Array),
      page: 1,
      limit: 10,
      totalPages: 1,
      totalResults: 2,
    });
  });

  it('should assign a caregiver to a patient', async () => {
    const [org] = await insertOrgs([orgOne]);
    const patient = await patientService.createPatient(patientOne);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    const updatedPatient = await patientService.assignCaregiver(caregiver.id, patient.id);
    expect(updatedPatient.caregivers.map((id) => id.toString())).toEqual(expect.arrayContaining([caregiver.id.toString()]));
  });

  it('should remove a caregiver from a patient', async () => {
    const [org] = await insertOrgs([orgOne]);
    const patient = await patientService.createPatient(patientOne);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await patientService.assignCaregiver(caregiver.id, patient.id);
    const updatedPatient = await patientService.removeCaregiver(caregiver.id, patient.id);
    expect(updatedPatient.caregivers.toObject()).toEqual([]);
  });

  it('should get caregivers by patient id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const patient = await patientService.createPatient(patientOne);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await patientService.assignCaregiver(caregiver.id, patient.id);
    const caregivers = await patientService.getCaregivers(patient.id);
    expect(caregivers).toHaveLength(1);
    expect(caregivers[0]).toHaveProperty('id', caregiver.id);
  });
});
