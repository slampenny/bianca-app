const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const faker = require('faker');
const config = require('../../src/config/config');
const moment = require('moment');
const { Caregiver } = require('../../src/models');
const tokenService = require('../../src/services/token.service');
const { tokenTypes } = require('../../src/config/tokens');
const { ApiError } = require('@google-cloud/storage');
const httpStatus = require('http-status');

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const fakeId = new mongoose.Types.ObjectId();

const caregiverOne = {
  org: new mongoose.Types.ObjectId(),
  name: faker.name.findName(),
  email: "fake@example.org",
  phone: '+16045624263',
  role: 'staff',
  patients: []
};

const caregiverOneWithPassword = {
  ...caregiverOne,
  password: hashedPassword,
};

const caregiverTwo = {
  org: new mongoose.Types.ObjectId(),
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  role: 'staff',
  patients: []
};

const admin = {
  org: new mongoose.Types.ObjectId(),
  name: faker.name.findName(),
  email: 'admin@example.org',
  phone: '+16045624263',
  role: 'orgAdmin',
  patiends: []
};

const superAdmin = {
  org: new mongoose.Types.ObjectId(),
  name: faker.name.findName(),
  email: 'superAdmin@example.org',
  phone: '+16045624263',
  role: 'superAdmin',
  patiends: []
};

const insertCaregivers = async (caregivers) => {
  return await Caregiver.insertMany(caregivers.map((caregiver) => ({ ...caregiver, password: hashedPassword })));
};

const insertCaregiverAndReturnToken = async (caregiverChoice) => {
  const [caregiver] = await insertCaregivers([caregiverChoice]);
  const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = tokenService.generateToken(caregiver.id, expires, tokenTypes.ACCESS);

  return { caregiver, accessToken };
};

const insertCaregiverAndReturnTokenByRole = async (role = "staff") => {
  let caregiverChoice;

  switch (role) {
    case "staff":
      caregiverChoice = caregiverOne;
      break;
    case "orgAdmin":
      caregiverChoice = admin;
      break;
    case "superAdmin":
      caregiverChoice = superAdmin;
      break;
    default:
      throw new ApiError(httpStatus.BAD_REQUEST, `Role ${role} not found`);
  }

  return await insertCaregiverAndReturnToken(caregiverChoice);
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
  insertCaregiverAndReturnToken,
  insertCaregiverAndReturnTokenByRole
};
