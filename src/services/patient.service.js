const httpStatus = require('http-status');
const { Patient } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Create a patient
 * @param {Object} patientBody
 * @returns {Promise<Patient>}
 */
const createPatient = async (patientBody) => {
  if (await Patient.isEmailTaken(patientBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  patientBody.role = patientBody.role || 'patient'; // set the role to 'patient' if it's not provided
  return await Patient.create(patientBody);
};

/**
 * Query for patients
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryPatients = async (filter, options) => {
  const patients = await Patient.paginate(filter, options);
  return patients;
};

/**
 * Get patient by id
 * @param {ObjectId} id
 * @returns {Promise<Patient>}
 */
const getPatientById = async (id) => {
  return Patient.findById(id).populate('schedules');
};

/**
 * Get patient by email
 * @param {string} email
 * @returns {Promise<Patient>}
 */
const getPatientByEmail = async (email) => {
  return Patient.findOne({ email }).populate('schedules');
};

/**
 * Update patient by id
 * @param {ObjectId} patientId
 * @param {Object} updateBody
 * @returns {Promise<Patient>}
 */
const updatePatientById = async (patientId, updateBody) => {
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  if (updateBody.email && (await Patient.isEmailTaken(updateBody.email, patientId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(patient, updateBody);
  await patient.save();
  return patient;
};

/**
 * Delete patient by id
 * @param {ObjectId} patientId
 * @returns {Promise<Patient>}
 */
const deletePatientById = async (patientId) => {
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  await patient.remove();
  return patient;
};

/**
 * Assign a caregiver to a patient
 * @param {ObjectId} patientId
 * @param {ObjectId} caregiverId
 * @returns {Promise<Patient>}
 */
const assignCaregiver = async (patientId, caregiverId) => {
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  const caregiver = await getPatientById(caregiverId);
  if (!caregiver || caregiver.role !== 'caregiver') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  patient.caregiver = caregiverId;
  await patient.save();
  return patient;
};

/**
 * Delete patient by id
 * @param {ObjectId} patientId
 * @returns {Promise<Patient>}
 */
const removeCaregiverPatientById = async (caregiverId, patientId) => {
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  if (caregiverId == patientId) {
    patient.caregiverId = null;
    await patient.save();
    return patient;
  }
  await patient.remove();
  return patient;
};

const getCaregiversByPatientId = async (patientId) => {
  const patient = await Patient.findById(patientId).populate('caregivers');
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  return patient.caregivers;
};

module.exports = {
  createPatient,
  queryPatients,
  getPatientById,
  getPatientByEmail,
  updatePatientById,
  deletePatientById,
  assignCaregiver,
  getCaregiversByPatientId,
};
