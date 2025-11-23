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
  // Ensure admin has isPhoneVerified set to true
  const adminWithVerifiedPhone = { ...admin, isPhoneVerified: true };
  const caregivers = await insertCaregiversAndAddToOrg(org, [adminWithVerifiedPhone, caregiverOne, playwrightTestUser]);
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
  
  // Create an SSO user without a password (for testing SSO account linking)
  const { Caregiver } = require('../../models');
  const ssoUser = {
    name: 'SSO Test User',
    email: 'sso-unlinked@example.org',
    phone: '+16045624264',
    role: 'staff',
    org: org._id,
    patients: [],
    ssoProvider: 'google',
    ssoProviderId: 'google-oauth2-123456789',
    password: null, // No password - SSO only
    isEmailVerified: true,
  };
  
  const ssoUserRecord = await Caregiver.create(ssoUser);
  org.caregivers.push(ssoUserRecord._id);
  await org.save();
  console.log('Seeded SSO user without password:', ssoUser.email);
  
  return caregivers.concat(superAdminRecord, [ssoUserRecord]);
}

module.exports = {
  seedCaregivers,
};

