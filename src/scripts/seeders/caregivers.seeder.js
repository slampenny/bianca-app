const caregiverFixture = require('../../../tests/fixtures/caregiver.fixture');

/**
 * Seed caregivers for an organization
 * @param {Object} org - Organization to seed caregivers for
 * @returns {Promise<Array>} Array of created caregivers
 */
async function seedCaregivers(org) {
  console.log('Seeding Caregivers for org:', org._id);
  const { caregiverOne, admin, playwrightTestUser, hashedPassword, insertCaregiversAndAddToOrg } = caregiverFixture;
  
  // Set org for all caregivers
  caregiverOne.org = org._id;
  admin.org = org._id;
  playwrightTestUser.org = org._id;
  
  // Insert caregivers
  const caregivers = await insertCaregiversAndAddToOrg(org, [admin, caregiverOne, playwrightTestUser]);
  console.log(`Seeded ${caregivers.length} caregivers`);
  
  // Create super admin
  const superAdmin = {
    name: 'Super Admin',
    email: 'superadmin@example.org',
    phone: '+16045624263',
    password: hashedPassword,
    role: 'superAdmin',
    org: org._id,
    patients: [],
    isEmailVerified: true,
  };
  
  const superAdminRecord = await insertCaregiversAndAddToOrg(org, [superAdmin]);
  console.log('Seeded super admin');
  
  return caregivers.concat(superAdminRecord);
}

module.exports = {
  seedCaregivers,
};

