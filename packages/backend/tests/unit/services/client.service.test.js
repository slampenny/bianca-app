const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Caregiver, Client } = require('../../../src/models');
const clientService = require('../../../src/services/client.service');
const caregiverService = require('../../../src/services/caregiver.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { caregiverOneWithPassword } = require('../../fixtures/caregiver.fixture');
const { clientOne, clientTwo, insertClientsWithOrg } = require('../../fixtures/client.fixture');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('clientService', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Client.deleteMany();
  });

  it('should create a new client', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await clientService.createClient(clientData);
    expect(client).toHaveProperty('id');
    expect(client).toHaveProperty('email', clientOne.email);
    expect(client).toHaveProperty('phone', clientOne.phone);
    expect(client).toHaveProperty('isEmailVerified', false);
  });

  it('should get a client by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await clientService.createClient(clientData);
    const fetched = await clientService.getClientById(client.id);
    expect(fetched).toHaveProperty('id', client.id);
  });

  it('should get a client by email', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await clientService.createClient(clientData);
    const fetched = await clientService.getClientByEmail(client.email);
    expect(fetched).toHaveProperty('id', client.id);
  });

  it('should update a client by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await clientService.createClient(clientData);
    const updateBody = { name: 'Updated Client' };
    const updatedClient = await clientService.updateClientById(client.id, updateBody);
    expect(updatedClient).toHaveProperty('name', updateBody.name);
  });

  it('should delete a client by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await clientService.createClient(clientData);
    await clientService.deleteClientById(client.id);
    const fetched = await clientService.getClientById(client.id);
    expect(fetched).toBeNull();
  });

  it('should query clients', async () => {
    const [org] = await insertOrgs([orgOne]);
    await insertClientsWithOrg([clientOne, clientTwo], org._id);
    const clients = await clientService.queryClients({}, {});
    expect(clients).toEqual({
      results: expect.any(Array),
      page: 1,
      limit: 10,
      totalPages: 1,
      totalResults: 2,
    });
  });

  it('should assign a caregiver to a client', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await clientService.createClient(clientData);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    const updatedClient = await clientService.assignCaregiver(caregiver.id, client.id);
    expect(updatedClient.caregivers.map((id) => id.toString())).toEqual(expect.arrayContaining([caregiver.id.toString()]));
  });

  it('should remove a caregiver from a client', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await clientService.createClient(clientData);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await clientService.assignCaregiver(caregiver.id, client.id);
    const updatedClient = await clientService.removeCaregiver(caregiver.id, client.id);
    expect(updatedClient.caregivers.toObject()).toEqual([]);
  });

  it('should get caregivers by client id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const clientData = { ...clientOne, org: org._id };
    const client = await clientService.createClient(clientData);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    await clientService.assignCaregiver(caregiver.id, client.id);
    const caregivers = await clientService.getCaregivers(client.id);
    expect(caregivers).toHaveLength(1);
    expect(caregivers[0]).toHaveProperty('id', caregiver.id);
  });

  it('should bulk-assign unassigned clients to a caregiver', async () => {
    const [org] = await insertOrgs([orgOne]);
    const caregiver = await caregiverService.createCaregiver(org.id, caregiverOneWithPassword);
    const c1 = await clientService.createClient({
      ...clientOne,
      org: org._id,
      email: 'bulk1@example.org',
      phone: '1111111111',
    });
    const c2 = await clientService.createClient({
      ...clientTwo,
      org: org._id,
      email: 'bulk2@example.org',
      phone: '2222222222',
    });
    const results = await clientService.assignUnassignedClients(caregiver.id, [c1.id, c2.id]);
    expect(results).toHaveLength(2);
    const again = await clientService.getClientById(c1.id);
    expect(again.caregivers.map((id) => id.toString())).toContain(caregiver.id.toString());
  });
});
