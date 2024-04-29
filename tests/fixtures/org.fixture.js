const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const faker = require('faker');
const { Org } = require('../../src/models');

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const orgOne = {
  caregivers: [],
  patients: [],
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263'
};

const orgTwo = {
  caregivers: [],
  patients: [],
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263'
};

const insertOrgs = async (orgs) => {
  return await Org.insertMany(orgs.map((org) => ({ ...org, password: hashedPassword })));
};

module.exports = {
  orgOne,
  orgTwo,
  insertOrgs
};
