const orgFixture = require('../../../tests/fixtures/org.fixture');

/**
 * Seed organizations
 * @returns {Promise<Object>} Created organization
 */
async function seedOrgs() {
  console.log('Seeding Organizations...');
  const { orgOne, orgTwo, insertOrgs } = orgFixture;
  // Use orgTwo (CA) for test organization to ensure privacy request tests work correctly
  // Privacy request UI is different for CA (PIPEDA) vs US (HIPAA)
  const [org] = await insertOrgs([orgTwo]);
  console.log('Seeded org:', org._id, 'with country:', org.country);
  return org;
}

module.exports = {
  seedOrgs,
};

