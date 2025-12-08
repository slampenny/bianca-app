const mongoose = require('mongoose');
const faker = require('faker');
const { Patient } = require('../../src/models');

const patientOne = {
  name: 'Agnes Alphabet',
  email: 'agnes@example.org',
  phone: '1234567890',
  schedules: [],
};

const patientTwo = {
  name: 'Barnaby Button',
  email: 'barnaby@example.org',
  phone: '1234567891',
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
