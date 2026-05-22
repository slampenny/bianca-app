const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const faker = require('faker');
const moment = require('moment');
const { ApiError } = require('@google-cloud/storage');
const httpStatus = require('http-status');
const config = require('../../src/config/config');
const { Caregiver } = require('../../src/models');
const tokenService = require('../../src/services/token.service');
const { tokenTypes } = require('../../src/config/tokens');

const password = 'Password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const fakeId = new mongoose.Types.ObjectId();

const caregiverOne = {
  name: 'Test User',
  email: 'fake@example.org',
  phone: '+16045624263',
  role: 'staff',
  clients: [],
  onboardingComplete: true,
};

const caregiverOneWithPassword = {
  ...caregiverOne,
  password: hashedPassword,
};

const caregiverTwo = {
  name: 'Test User Two',
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  role: 'staff',
  clients: [],
};

const admin = {
  name: 'Admin User',
  email: 'admin@example.org',
  phone: '+16045624263',
  role: 'orgAdmin',
  clients: [],
  isPhoneVerified: true, // Admin user's phone is verified
  onboardingComplete: true,
};

const superAdmin = {
  name: 'Super Admin',
  email: 'superAdmin@example.org',
  phone: '+16045624263',
  role: 'superAdmin',
  clients: [],
};

const playwrightTestUser = {
  name: 'Playwright Test User',
  email: 'playwright@example.org',
  phone: '+16045624263',
  role: 'orgAdmin',
  clients: [],
  onboardingComplete: true,
};

const insertCaregivers = async (caregivers, org = null) => {
  // If no org provided, create a default org for test caregivers
  let testOrg = org;
  if (!testOrg) {
    const { Org } = require('../../src/models');
    testOrg = await Org.create({
      name: 'Test Org',
      email: 'testorg@example.com',
      country: 'US',
    });
  }
  
  return await Caregiver.insertMany(
    caregivers.map((caregiver) => ({ 
      ...caregiver, 
      org: testOrg._id || testOrg.id || testOrg,
      password: hashedPassword, 
      isEmailVerified: true 
    }))
  );
};

const insertCaregiversAndAddToOrg = async (org, caregivers) => {
  const orgId = org._id || org.id;
  const insertedCaregivers = await Caregiver.insertMany(
    caregivers.map((caregiver) => ({ ...caregiver, org: orgId, password: hashedPassword, isEmailVerified: true }))
  );
  // Add the inserted caregivers to the org.caregivers array
  org.caregivers.push(...insertedCaregivers.map((caregiver) => caregiver._id));
  await org.save();

  return insertedCaregivers;
};

const insertCaregivertoOrgAndReturnToken = async (org, caregiverChoice) => {
  const [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverChoice]);
  // Fetch the full document with org populated so role and org are available
  const caregiverDoc = await Caregiver.findById(caregiver._id).populate('org');
  if (!caregiverDoc) {
    throw new Error(`Caregiver not found with ID: ${caregiver._id}`);
  }
  const authTokens = await tokenService.generateAuthTokens(caregiverDoc);

  return { caregiver: caregiverDoc, accessToken: authTokens.access.token };
};

const insertCaregivertoOrgAndReturnTokenByRole = async (org, role = 'staff') => {
  let caregiverChoice;

  switch (role) {
    case 'staff':
      caregiverChoice = caregiverOne;
      break;
    case 'orgAdmin':
      caregiverChoice = admin;
      break;
    case 'superAdmin':
      caregiverChoice = superAdmin;
      break;
    default:
      throw new ApiError(httpStatus.BAD_REQUEST, `Role ${role} not found`);
  }

  return await insertCaregivertoOrgAndReturnToken(org, caregiverChoice);
};

module.exports = {
  caregiverOne,
  caregiverOneWithPassword,
  caregiverTwo,
  password,
  hashedPassword,
  fakeId,
  admin,
  superAdmin,
  playwrightTestUser,
  insertCaregivers,
  insertCaregiversAndAddToOrg,
  insertCaregivertoOrgAndReturnToken,
  insertCaregivertoOrgAndReturnTokenByRole,
};
