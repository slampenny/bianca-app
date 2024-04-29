const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const faker = require('faker');
const { Patient } = require('../../src/models');

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const patientOne = {
  _id: mongoose.Types.ObjectId(),
  org: null,
  caregivers: [],
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  medicalHistory: "",
  isEmailVerified: false,
  schedules: []
};

const patientTwo = {
  _id: mongoose.Types.ObjectId(),
  org: null,
  caregivers: [],
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  password,
  medicalHistory: "",
  isEmailVerified: false,
  schedules: []
};

const insertPatients = async (patients) => {
  return await Patient.insertMany(patients.map((patient) => ({ ...patient, password: hashedPassword })));
};

module.exports = {
  patientOne,
  patientTwo,
  insertPatients,
};
