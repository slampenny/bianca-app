const { Org } = require('../../models');
const caregiverFixture = require('../../../tests/fixtures/caregiver.fixture');
const clientFixture = require('../../../tests/fixtures/client.fixture');
const conversationsSeeder = require('./conversations.seeder');

/**
 * Seed a family (B2C mobile) org — separate from the facility org used by fake@example.org.
 * Login: parent@example.org / Password1
 */
async function seedFamilyAccount() {
  console.log('Seeding family (mobile B2C) account...');

  const { familyParent, insertCaregiversAndAddToOrg } = caregiverFixture;
  const { familyClientMom, familyClientDad, insertClientsAndAddToCaregiver } = clientFixture;

  const familyOrg = await Org.create({
    name: 'Smith Family',
    email: 'smith-family@example.org',
    phone: '+16045624265',
    country: 'US',
    voiceOnboarding: { useDefault: false, days: [] },
  });

  const [parentRecord] = await insertCaregiversAndAddToOrg(familyOrg, [familyParent]);
  const clients = await insertClientsAndAddToCaregiver(parentRecord, [familyClientMom, familyClientDad]);

  await conversationsSeeder.addRecentPatientConversations(clients[0]._id);
  await conversationsSeeder.addRecentPatientConversations(clients[1]._id);

  console.log('Seeded family account: parent@example.org (2 loved ones, voice onboarding off)');
  return { org: familyOrg, caregiver: parentRecord, clients };
}

module.exports = {
  seedFamilyAccount,
};
