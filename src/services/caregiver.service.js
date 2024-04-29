const httpStatus = require('http-status');
const { Org, Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Create a caregiver
 * @param {ObjectId} orgId
 * @param {Object} caregiverBody
 * @returns {Promise<Caregiver>}
 */
const createCaregiver = async (orgId, caregiverBody) => {
  if (await Caregiver.isEmailTaken(caregiverBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Add org to caregiver
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  const caregiver = await Caregiver.create(caregiverBody);

  // Add caregiver to org's caregivers array
  org.caregivers.push(caregiver._id);
  await org.save();

  return caregiver;
};

/**
 * Query for caregivers
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryCaregivers = async (filter, options) => {
  const caregivers = await Caregiver.paginate(filter, options);
  return caregivers;
};

/**
 * Get caregiver by id
 * @param {ObjectId} id
 * @returns {Promise<Caregiver>}
 */
const getCaregiverById = async (id) => {
  return Caregiver.findById(id);
};

/**
 * Get caregiver by email
 * @param {string} email
 * @returns {Promise<Caregiver>}
 */
const getCaregiverByEmail = async (email) => {
  return Caregiver.findOne({ email });
};

/**
 * Update caregiver by id
 * @param {ObjectId} caregiverId
 * @param {Object} updateBody
 * @returns {Promise<Caregiver>}
 */
const updateCaregiverById = async (caregiverId, updateBody) => {
  const caregiver = await getCaregiverById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  if (updateBody.email && (await Caregiver.isEmailTaken(updateBody.email, caregiverId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(caregiver, updateBody);
  await caregiver.save();
  return caregiver;
};

/**
 * Delete caregiver by id
 * @param {ObjectId} caregiverId
 * @returns {Promise<Caregiver>}
 */
const deleteCaregiverById = async (caregiverId) => {
  const caregiver = await getCaregiverById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  // Remove caregiver from org's caregivers array
  const org = await Org.findById(caregiver.org);
  org.caregivers = org.caregivers.filter(id => !id.equals(caregiverId));
  await org.save();

  // Remove caregiver from all patients' caregivers array
  const patients = await Patient.find({ caregivers: caregiverId });
  for (let patient of patients) {
    patient.caregivers = patient.caregivers.filter(id => !id.equals(caregiverId));
    await patient.save();
  }

  // Remove caregiver
  await caregiver.remove();

  return caregiver;
};

/**
 * Assign a patient to a caregiver
 * @param {ObjectId} caregiverId
 * @param {ObjectId} patientId
 * @returns {Promise<Caregiver>}
 */
const addPatient = async (caregiverId, patientId) => {
  const caregiver = await getCaregiverById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  // Add patient to caregiver's patients array
  caregiver.patients.push(patientId);
  await caregiver.save();

  // Add caregiver to patient's caregivers array
  patient.caregivers.push(caregiverId);
  await patient.save();

  return caregiver;
};

/**
 * Remove patient from caregiver
 * @param {ObjectId} caregiverId
 * @param {ObjectId} patientId
 * @returns {Promise<Caregiver>}
 */
const removePatient = async (caregiverId, patientId) => {
  const caregiver = await getCaregiverById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  // Remove patient from caregiver's patients array
  caregiver.patients = caregiver.patients.filter(id => !id.equals(patientId));
  await caregiver.save();

  // Remove caregiver from patient's caregivers array
  patient.caregivers = patient.caregivers.filter(id => !id.equals(caregiverId));
  await patient.save();

  return caregiver;
};

/**
 * Get patients for a caregiver
 * @param {ObjectId} caregiverId
 * @returns {Promise<Array<Patient>>}
 */
const getPatientsByCaregiver = async (caregiverId) => {
  const caregiver = await Caregiver.findById(caregiverId).populate('patients');
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  if (caregiver.role !== 'orgAdmin') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Caregiver is not a caregiver');
  }

  return caregiver.patients;
};

module.exports = {
  createCaregiver,
  queryCaregivers,
  getCaregiverById,
  getCaregiverByEmail,
  updateCaregiverById,
  deleteCaregiverById,
  addPatient,
  removePatient,
  getPatientsByCaregiver
};
