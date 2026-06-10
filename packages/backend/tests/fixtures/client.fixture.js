const { Client } = require('../../src/models');

// Note: org field is required - must be provided when creating clients
const clientOne = {
  name: 'Agnes Alphabet',
  firstName: 'Agnes',
  lastName: 'Alphabet',
  preferredName: 'Agnes',
  age: 84,
  room: '101A',
  email: 'agnes@example.org',
  phone: '1234567890',
  preferredLanguage: 'en',
  notes: 'Enjoys morning calls and discussing family updates.',
  moveInDate: new Date('2024-01-15T00:00:00.000Z'),
  emergencyContact: {
    name: 'Martha Alphabet',
    relationship: 'Daughter',
    phone: '1234567801',
    email: 'martha.alphabet@example.org',
  },
  schedules: [],
  // org must be provided when using this fixture
};

const clientTwo = {
  name: 'Barnaby Button',
  firstName: 'Barnaby',
  lastName: 'Button',
  preferredName: 'Barnaby',
  age: 79,
  room: '102B',
  email: 'barnaby@example.org',
  phone: '1234567891',
  preferredLanguage: 'en',
  notes: 'Prefers shorter afternoon check-ins and medication reminders.',
  moveInDate: new Date('2023-10-02T00:00:00.000Z'),
  emergencyContact: {
    name: 'Evelyn Button',
    relationship: 'Spouse',
    phone: '1234567802',
    email: 'evelyn.button@example.org',
  },
  schedules: [],
  // org must be provided when using this fixture
};

/** Home-care clients for parent@example.org (mobile B2C) — no facility room numbers. */
const familyClientMom = {
  name: 'Eleanor Smith',
  firstName: 'Eleanor',
  lastName: 'Smith',
  preferredName: 'Mom',
  age: 84,
  email: 'eleanor.smith@example.org',
  phone: '1234567901',
  preferredLanguage: 'en',
  notes: 'Lives at home; daughter checks in via Bianca.',
  emergencyContact: {
    name: 'Alex Parent',
    relationship: 'Daughter',
    phone: '1234567900',
    email: 'parent@example.org',
  },
  schedules: [],
};

const familyClientDad = {
  name: 'Robert Smith',
  firstName: 'Robert',
  lastName: 'Smith',
  preferredName: 'Dad',
  age: 86,
  email: 'robert.smith@example.org',
  phone: '1234567902',
  preferredLanguage: 'en',
  notes: 'Lives with Eleanor; enjoys afternoon check-ins.',
  emergencyContact: {
    name: 'Alex Parent',
    relationship: 'Daughter',
    phone: '1234567900',
    email: 'parent@example.org',
  },
  schedules: [],
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
  familyClientMom,
  familyClientDad,
  insertClients,
  insertClientsWithOrg,
  insertClientsAndAddToCaregiver,
};
