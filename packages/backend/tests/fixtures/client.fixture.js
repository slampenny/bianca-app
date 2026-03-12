const { Client } = require('../../src/models');

// Note: org field is required - must be provided when creating clients
const clientOne = {
  name: 'Agnes Alphabet',
  email: 'agnes@example.org',
  phone: '1234567890',
  schedules: [],
  // org must be provided when using this fixture
};

const clientTwo = {
  name: 'Barnaby Button',
  email: 'barnaby@example.org',
  phone: '1234567891',
  schedules: [],
  // org must be provided when using this fixture
};

const insertClients = async (clients) => {
  const clientsWithOrg = clients.map(client => {
    if (!client.org) {
      throw new Error('Client fixture requires org field. Use insertClientsWithOrg or provide org when creating clients.');
    }
    return client;
  });
  return await Client.insertMany(clientsWithOrg);
};

const insertClientsWithOrg = async (clients, orgId) => {
  const clientsWithOrg = clients.map(client => ({
    ...client,
    org: orgId,
  }));
  return await Client.insertMany(clientsWithOrg);
};

const insertClientsAndAddToCaregiver = async (caregiver, clients) => {
  const clientsWithCaregiver = clients.map((client) => ({
    ...client,
    caregivers: [caregiver.id],
    org: caregiver.org,
  }));

  const dbClients = await Client.insertMany(clientsWithCaregiver);

  caregiver.clients.push(...dbClients.map(c => c._id));
  await caregiver.save();

  return dbClients;
};

module.exports = {
  clientOne,
  clientTwo,
  insertClients,
  insertClientsWithOrg,
  insertClientsAndAddToCaregiver,
};
