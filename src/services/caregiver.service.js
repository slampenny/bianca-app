const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Org, Caregiver, Patient } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 * @param {string} phone - Phone number in any format
 * @returns {string|null} - Normalized phone number in E.164 format, or null if invalid
 */
const normalizePhoneToE164 = (phone) => {
  if (!phone) return null;
  
  // If already in E.164 format, return as-is
  if (phone.startsWith('+')) {
    const e164Regex = /^\+[1-9]\d{9,14}$/;
    if (e164Regex.test(phone)) {
      return phone;
    }
    return null; // Invalid E.164 format
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Convert 10-digit US number to E.164 format
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Convert 11-digit number starting with 1 to E.164 format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If longer, assume it's an international number and add +
  if (digits.length > 11) {
    return `+${digits}`;
  }
  
  // Invalid format
  return null;
};
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

  // Normalize phone number to E.164 format if provided
  if (caregiverBody.phone) {
    const normalizedPhone = normalizePhoneToE164(caregiverBody.phone);
    if (!normalizedPhone) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format. Please use 10 digits or E.164 format (e.g., +1234567890)');
    }
    caregiverBody.phone = normalizedPhone;
  }

  // Add org to caregiver
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  const caregiver = await Caregiver.create(caregiverBody);
  caregiver.org = org.id;
  await caregiver.save();

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
  return await Caregiver.paginate(filter, options);
};

/**
 * Get caregiver by id
 * @param {ObjectId} id
 * @returns {Promise<Caregiver>}
 */
const getCaregiverById = async (id) => {
  return await Caregiver.findById(id).populate('org');
};

const getPatientById = async (id) => {
  return await Patient.findById(id).populate('schedules');
};

/**
 * Get caregiver by email
 * @param {string} email
 * @returns {Promise<Caregiver>}
 */
const getCaregiverByEmail = async (email) => {
  return await Caregiver.findOne({ email });
};

const getLoginCaregiverData = async (email) => {
  // Check MongoDB connection before querying
  const mongoose = require('mongoose');
  const config = require('../config/config');
  
  if (mongoose.connection.readyState !== 1) {
    // Try to reconnect if not connected
    logger.warn(`MongoDB not connected (state: ${mongoose.connection.readyState}). Attempting to reconnect...`);
    try {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      // Wait a moment for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (mongoose.connection.readyState === 1) {
        logger.info('MongoDB reconnected successfully');
      } else {
        throw new Error(`MongoDB reconnection failed. Connection state: ${mongoose.connection.readyState}`);
      }
    } catch (reconnectError) {
      const error = new Error(`MongoDB not connected. Connection state: ${mongoose.connection.readyState}. Connection URL: ${config.mongoose.url}. Error: ${reconnectError.message}`);
      error.code = 'MONGOOSE_NOT_CONNECTED';
      error.originalError = reconnectError;
      logger.error(`MongoDB connection error: ${error.message}`);
      throw error;
    }
  }
  
  const caregiver = await Caregiver.findOne({ email })
    .populate('org')
    .populate({
      path: 'patients',
      populate: {
        path: 'schedules',
        model: 'Schedule',
      },
    });

  if (!caregiver) {
    return null;
  }

  return {
    org: caregiver.org,
    caregiver,
    patients: caregiver.patients,
  };
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
  
  // Normalize phone number to E.164 format if provided
  if (updateBody.phone) {
    const normalizedPhone = normalizePhoneToE164(updateBody.phone);
    if (!normalizedPhone) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format. Please use 10 digits or E.164 format (e.g., +1234567890)');
    }
    updateBody.phone = normalizedPhone;
  }
  
  // If this is an invited user completing registration (setting password), promote them to staff
  // Role change happens on registration completion, not on phone verification
  if (caregiver.role === 'invited' && updateBody.password) {
    // Invited user completing registration - promote to staff
    // Phone and verification status are separate concerns
    updateBody.role = 'staff';
  }
  
  // If orgAdmin or staff is updating their phone, also update the organization's phone if it's not set
  if ((caregiver.role === 'orgAdmin' || caregiver.role === 'superAdmin') && updateBody.phone) {
    const org = await Org.findById(caregiver.org);
    if (org && !org.phone) {
      org.phone = updateBody.phone;
      await org.save();
    }
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
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  try {
    // Remove caregiver from org's caregivers array
    const org = await Org.findById(caregiver.org).populate('caregivers');
    org.caregivers = org.caregivers.filter((id) => !id.equals(caregiverId));
    await org.save();

    // Remove caregiver from all patients' caregivers array
    const patients = await Patient.find({ caregivers: { $in: [new mongoose.Types.ObjectId(caregiverId)] } });
    for (const patient of patients) {
      patient.caregivers = patient.caregivers.filter((id) => !id.equals(caregiverId));
      await patient.save();
      logger.debug(`Caregiver ${caregiverId} removed from patient ${patient._id}`);
    }

    // Remove caregiver
    await caregiver.delete();
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Error while removing caregiver ${caregiverId}: ${JSON.stringify(error)}`);
  }

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

  // Add patient to caregiver's patients array (with check to avoid duplicates)
  if (!caregiver.patients.includes(patientId)) {
    caregiver.patients.push(patientId);
    await caregiver.save();
  }

  // Add caregiver to patient's caregivers array (with check to avoid duplicates)
  if (!patient.caregivers.includes(caregiverId)) {
    patient.caregivers.push(caregiverId);
  }
  // Update patient's org to match caregiver's org
  patient.org = caregiver.org;
  await patient.save();

  return patient;
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
  caregiver.patients = caregiver.patients.filter((id) => !id.equals(patientId));
  await caregiver.save();

  // Remove caregiver from patient's caregivers array
  patient.caregivers = patient.caregivers.filter((id) => !id.equals(caregiverId));
  await patient.save();

  return caregiver;
};

/**
 * Get patients for a caregiver
 * @param {ObjectId} caregiverId
 * @returns {Promise<Array<Patient>>}
 */
const getPatients = async (caregiverId) => {
  const caregiver = await Caregiver.findById(caregiverId).populate('patients');
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  return caregiver.patients;
};

const checkCaregiverOwnsPatient = async (caregiverId, patientId) => {
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  if (caregiver.role === 'staff' && !caregiver.patients.includes(patientId)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this patient');
  }

  if (caregiver.role === 'orgAdmin') {
    caregiver = await caregiver.populate('org').execPopulate();
    if (!caregiver.org.patients.includes(patientId)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this patient');
    }
  }

  // If the caregiver is a superAdmin or has passed the previous checks, return true
  return true;
};

module.exports = {
  createCaregiver,
  queryCaregivers,
  getCaregiverById,
  getCaregiverByEmail,
  getLoginCaregiverData,
  updateCaregiverById,
  deleteCaregiverById,
  addPatient,
  removePatient,
  getPatients,
  checkCaregiverOwnsPatient,
};
