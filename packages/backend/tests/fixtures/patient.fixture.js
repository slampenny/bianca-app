const mongoose = require('mongoose');
const faker = require('faker');
const { Patient } = require('../../src/models');

// Note: org field is required - must be provided when creating patients
const patientOne = {
  name: 'Agnes Alphabet',
  email: 'agnes@example.org',
  phone: '1234567890',
  schedules: [],
  // org must be provided when using this fixture
};

const patientTwo = {
  name: 'Barnaby Button',
  email: 'barnaby@example.org',
  phone: '1234567891',
  schedules: [],
  // org must be provided when using this fixture
};

const insertPatients = async (patients) => {
  // Ensure all patients have org field
  const patientsWithOrg = patients.map(patient => {
    if (!patient.org) {
      throw new Error('Patient fixture requires org field. Use insertPatientsWithOrg or provide org when creating patients.');
    }
    return patient;
  });
  return await Patient.insertMany(patientsWithOrg);
};

// Helper to insert patients with org
const insertPatientsWithOrg = async (patients, orgId) => {
  const patientsWithOrg = patients.map(patient => ({
    ...patient,
    org: orgId,
  }));
  return await Patient.insertMany(patientsWithOrg);
};

const insertPatientsAndAddToCaregiver = async (caregiver, patients) => {
  // Add caregiver.id to each patient's caregivers array (two-way link)
  const patientsWithCaregiver = patients.map((patient) => ({
    ...patient,
    caregivers: [caregiver.id], // Use caregivers array, not singular caregiver
    org: caregiver.org,
  }));

  const dbPatients = await Patient.insertMany(patientsWithCaregiver);
  
  // Add patients to caregiver's patients array (two-way link)
  caregiver.patients.push(...dbPatients.map(p => p._id));
  await caregiver.save();

  return dbPatients;
};

module.exports = {
  patientOne,
  patientTwo,
  insertPatients,
  insertPatientsWithOrg,
  insertPatientsAndAddToCaregiver,
};
