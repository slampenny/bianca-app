const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Caregiver, Client } = require('../../../src/models');
const patientService = require('../../../src/services/patient.service');
const caregiverService = require('../../../src/services/caregiver.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { caregiverOneWithPassword } = require('../../fixtures/caregiver.fixture');
const { clientOne, clientTwo, insertClients, insertClientsWithOrg } = require('../../fixtures/client.fixture');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('patientService', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Client.deleteMany();
  });

  it('should create a new patient', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await patientService.createPatient(clientData);
    expect(client).toHaveProperty('id');
    expect(client).toHaveProperty('email', clientOne.email);
    expect(client).toHaveProperty('phone', clientOne.phone);
    expect(client).toHaveProperty('isEmailVerified', false);
  });

  it('should get a patient by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await patientService.createPatient(clientData);
    const fetchedPatient = await patientService.getPatientById(client.id);
    expect(fetchedPatient).toHaveProperty('id', client.id);
  });

  it('should get a patient by email', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await patientService.createPatient(clientData);
    const fetchedPatient = await patientService.getPatientByEmail(client.email);
    expect(fetchedPatient).toHaveProperty('id', client.id);
  });

  it('should update a patient by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await patientService.createPatient(clientData);
    const updateBody = { name: 'Updated Patient' };
    const updatedClient = await patientService.updatePatientById(client.id, updateBody);
    expect(updatedClient).toHaveProperty('name', updateBody.name);
  });

  it('should delete a patient by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await patientService.createPatient(clientData);
    await patientService.deletePatientById(client.id);
    const fetchedPatient = await patientService.getPatientById(client.id);
    expect(fetchedPatient).toBeNull();
  });

  it('should query clients', async () => {
    const [org] = await insertOrgs([orgOne]);
    await insertClientsWithOrg([clientOne, clientTwo], org._id);
    const clients = await patientService.queryPatients({}, {});
    expect(clients).toEqual({
      results: expect.any(Array),
      page: 1,
      limit: 10,
      totalPages: 1,
      totalResults: 2,
    });
  });

  it('should assign a caregiver to a patient', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await patientService.createPatient(clientData);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    const updatedClient = await patientService.assignCaregiver(caregiver.id, client.id);
    expect(updatedClient.caregivers.map((id) => id.toString())).toEqual(expect.arrayContaining([caregiver.id.toString()]));
  });

  it('should remove a caregiver from a patient', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await patientService.createPatient(clientData);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await patientService.assignCaregiver(caregiver.id, client.id);
    const updatedClient = await patientService.removeCaregiver(caregiver.id, client.id);
    expect(updatedClient.caregivers.toObject()).toEqual([]);
  });

  it('should get caregivers by patient id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await patientService.createPatient(clientData);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await patientService.assignCaregiver(caregiver.id, client.id);
    const caregivers = await patientService.getCaregivers(client.id);
    expect(caregivers).toHaveLength(1);
    expect(caregivers[0]).toHaveProperty('id', caregiver.id);
  });
});
