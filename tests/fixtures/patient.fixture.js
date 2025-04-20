const mongoose = require('mongoose');
const faker = require('faker');
const { Patient } = require('../../src/models');

const patientOne = {
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  schedules: [],
};

const patientTwo = {
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  phone: '+16045624263',
  schedules: [],
};

const insertPatients = async (patients) => {
  return await Patient.insertMany(patients);
};

const insertPatientsAndAddToCaregiver = async (caregiver, patients) => {
  // Add caregiver.id to each patient
  const patientsWithCaregiver = patients.map((patient) => ({
    ...patient,
    caregiver: caregiver.id,
    org: caregiver.org,
  }));

  const dbPatients = await Patient.insertMany(patientsWithCaregiver);
  caregiver.patients.push(...dbPatients);
  await caregiver.save();

  return dbPatients;
};

module.exports = {
  patientOne,
  patientTwo,
  insertPatients,
  insertPatientsAndAddToCaregiver,
};
