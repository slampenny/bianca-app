const httpStatus = require('http-status');
const { Caregiver, Patient } = require('../models');
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
  await patient.deleteOne();
  return patient;
};

/**
 * Assign a caregiver to a patient
 * @param {ObjectId} patientId
 * @param {ObjectId} caregiverId
 * @returns {Promise<Patient>}
 */
const assignCaregiver = async (caregiverId, patientId) => {
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  // Add caregiver to patient's caregivers list
  if (!patient.caregivers.includes(caregiverId)) {
    patient.caregivers.push(caregiverId);
    await patient.save();
  }

  // Add patient to caregiver's patients list
  if (!caregiver.patients.includes(patientId)) {
    caregiver.patients.push(patientId);
    await caregiver.save();
  }

  return patient;
};

/**
 * Delete patient by id
 * @param {ObjectId} patientId
 * @returns {Promise<Patient>}
 */
const removeCaregiver = async (caregiverId, patientId) => {
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  // Remove caregiver from patient's caregivers list
  const caregiverIndex = patient.caregivers.indexOf(caregiverId);
  if (caregiverIndex !== -1) {
    patient.caregivers.splice(caregiverIndex, 1);
    await patient.save();
  }

  // Remove patient from caregiver's patients list
  const patientIndex = caregiver.patients.indexOf(patientId);
  if (patientIndex !== -1) {
    caregiver.patients.splice(patientIndex, 1);
    await caregiver.save();
  }

  return patient;
};

const getCaregivers = async (patientId) => {
  const patient = await Patient.findById(patientId).populate('caregivers');
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  return patient.caregivers;
};

/**
 * Get active patients
 * @returns {Promise<Array>}
 */
const getActivePatients = async () => {
  try {
    // Return all patients for now - in a real implementation, you might filter by status
    return await Patient.find({}).select('_id name email');
  } catch (error) {
    logger.error('Error getting active patients:', error);
    throw error;
  }
};

module.exports = {
  createPatient,
  queryPatients,
  getPatientById,
  getPatientByEmail,
  updatePatientById,
  deletePatientById,
  assignCaregiver,
  removeCaregiver,
  getCaregivers,
  getActivePatients,
};
