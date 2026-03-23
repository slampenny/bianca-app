const clientFixture = require('../../../tests/fixtures/client.fixture');

/**
 * Seed clients for a caregiver
 * @param {Object} caregiver - Caregiver to seed clients for
 * @returns {Promise<Array>} Array of created clients
 */
async function seedClients(caregiver) {
  console.log('Seeding clients for caregiver:', caregiver._id);
  const { clientOne, clientTwo, insertClientsAndAddToCaregiver } = clientFixture;

  const clients = await insertClientsAndAddToCaregiver(caregiver, [clientOne, clientTwo]);
  console.log(`Seeded ${clients.length} clients`);

  return clients;
}

module.exports = {
  seedClients,
};
