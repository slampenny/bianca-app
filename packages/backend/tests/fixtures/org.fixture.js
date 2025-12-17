const faker = require('faker');
const { Org } = require('../../src/models');

const orgOne = {
  caregivers: [],
  patients: [],
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  country: 'US',
};

const orgTwo = {
  caregivers: [],
  patients: [],
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  country: 'CA',
};

const insertOrgs = async (orgs) => {
  return await Org.insertMany(orgs.map((org) => ({ ...org })));
};

module.exports = {
  orgOne,
  orgTwo,
  insertOrgs,
};
