const orgFixture = require('../../../tests/fixtures/org.fixture');

/**
 * Seed organizations
 * @returns {Promise<Object>} Created organization
 */
async function seedOrgs() {
  console.log('Seeding Organizations...');
  const { orgOne, insertOrgs } = orgFixture;
  const [org] = await insertOrgs([orgOne]);
  console.log('Seeded org:', org._id);
  return org;
}

module.exports = {
  seedOrgs,
};

