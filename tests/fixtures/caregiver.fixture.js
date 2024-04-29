const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const faker = require('faker');
const { Caregiver } = require('../../src/models');

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const caregiverOne = {
  name: faker.name.findName(),
  email: "fake@example.org",
  phone: '+16045624263',
  role: 'staff',
  patients: []
};

const caregiverTwo = {
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  role: 'staff',
  patients: []
};

const admin = {
  name: faker.name.findName(),
  email: 'admin@example.org',
  phone: '+16045624263',
  role: 'orgAdmin',
  patiends: []
};

const superAdmin = {
  name: faker.name.findName(),
  email: 'superAdmin@example.org',
  phone: '+16045624263',
  role: 'superAdmin',
  patiends: []
};

const insertCaregivers = async (caregivers) => {
  return await Caregiver.insertMany(caregivers.map((caregiver) => ({ ...caregiver, password: hashedPassword })));
};

module.exports = {
  caregiverOne,
  caregiverTwo,
  admin,
  superAdmin,
  insertCaregivers,
};
