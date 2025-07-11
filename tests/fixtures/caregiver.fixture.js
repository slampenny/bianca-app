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
  patients: [],
};

const caregiverOneWithPassword = {
  ...caregiverOne,
  password: hashedPassword,
};

const caregiverTwo = {
  name: 'Test User',
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  role: 'staff',
  patients: [],
};

const admin = {
  name: 'Admin User',
  email: 'admin@example.org',
  phone: '+16045624263',
  role: 'orgAdmin',
  patiends: [],
};

const superAdmin = {
  name: 'Super Admin',
  email: 'superAdmin@example.org',
  phone: '+16045624263',
  role: 'superAdmin',
  patiends: [],
};

const insertCaregivers = async (caregivers) => {
  return await Caregiver.insertMany(caregivers.map((caregiver) => ({ ...caregiver, password: hashedPassword })));
};

const insertCaregiversAndAddToOrg = async (org, caregivers) => {
  const insertedCaregivers = await Caregiver.insertMany(
    caregivers.map((caregiver) => ({ ...caregiver, org: org.id, password: hashedPassword }))
  );
  // Add the inserted caregivers to the org.caregivers array
  org.caregivers.push(...insertedCaregivers.map((caregiver) => caregiver._id));
  await org.save();

  return insertedCaregivers;
};

const insertCaregivertoOrgAndReturnToken = async (org, caregiverChoice) => {
  const [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverChoice]);
  const authTokens = await tokenService.generateAuthTokens(caregiver);

  return { caregiver, accessToken: authTokens.access.token };
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
  insertCaregivers,
  insertCaregiversAndAddToOrg,
  insertCaregivertoOrgAndReturnToken,
  insertCaregivertoOrgAndReturnTokenByRole,
};
