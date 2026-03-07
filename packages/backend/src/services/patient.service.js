const httpStatus = require('http-status');
const { Caregiver, Patient, Org, Token } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const config = require('../config/config');
const { tokenTypes } = require('../config/tokens');

/**
 * Create a patient
 * @param {Object} patientBody
 * @returns {Promise<Patient>}
 */
const createPatient = async (patientBody) => {
  // Note: Email uniqueness check removed - emails can be duplicated (e.g., family members sharing email)
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
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  // Note: Email uniqueness check removed - emails can be duplicated (e.g., family members sharing email)
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
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
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
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
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

  // Add patient to caregiver's clients list
  if (!caregiver.clients.includes(patientId)) {
    caregiver.clients.push(patientId);
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
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
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
  const patientIndex = caregiver.clients.indexOf(patientId);
  if (patientIndex !== -1) {
    caregiver.clients.splice(patientIndex, 1);
    await caregiver.save();
  }

  return patient;
};

const getCaregivers = async (patientId) => {
  const patient = await Patient.findById(patientId).populate('caregivers');
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
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

/**
 * Get unassigned patients (patients with no caregivers)
 * @returns {Promise<Array>}
 */
const getUnassignedPatients = async () => {
  try {
    // Find patients where caregivers array is empty or doesn't exist
    // Populate schedules to match the behavior of getPatientById
    const patients = await Patient.find({
      $or: [
        { caregivers: { $exists: false } },
        { caregivers: { $size: 0 } },
      ],
    }).populate('schedules');
    return patients;
  } catch (error) {
    logger.error('Error getting unassigned patients:', error);
    throw error;
  }
};

/**
 * Send consent request email to patient if org requires it
 * @param {Patient} patient - Patient document
 * @returns {Promise<void>}
 */
const sendConsentEmailIfRequired = async (patient) => {
  try {
    // Populate org to check requirePatientConsent setting
    const patientWithOrg = await Patient.findById(patient._id).populate('org');
    if (!patientWithOrg || !patientWithOrg.org) {
      logger.warn(`[Patient Service] Cannot send consent email: patient ${patient._id} has no org`);
      return;
    }

    const org = patientWithOrg.org;
    
    // Only send if org requires patient consent
    if (!org.requirePatientConsent) {
      logger.debug(`[Patient Service] Org ${org._id} does not require patient consent, skipping email`);
      return;
    }

    // Only send if patient hasn't consented yet
    if (patient.consented === true) {
      logger.debug(`[Patient Service] Patient ${patient._id} already consented, skipping email`);
      return;
    }

    // Generate consent token using token service
    const consentToken = await tokenService.generatePatientConsentToken(patient);
    const consentLink = `${config.frontendUrl}/patient/consent?token=${consentToken}`;
    
    const consentEmailVersion = '1.0'; // Version of consent email template
    
    await emailService.sendPatientConsentRequestEmail(
      patient.email,
      patient.name,
      org.name,
      consentLink,
      patient.preferredLanguage || 'en',
      consentEmailVersion
    );

    logger.info(`[Patient Service] Consent request email sent to patient ${patient._id} (${patient.email})`);
  } catch (error) {
    // Log error but don't fail patient creation/update
    logger.error(`[Patient Service] Failed to send consent email to patient ${patient._id}:`, error);
  }
};

/**
 * Check if patient has consented to recording
 * @param {ObjectId|string} patientId - Patient ID
 * @returns {Promise<boolean>} - True if patient has consented or org doesn't require consent
 */
const checkPatientConsent = async (patientId) => {
  try {
    const patient = await Patient.findById(patientId).populate('org');
    if (!patient || !patient.org) {
      logger.warn(`[Patient Service] Cannot check consent: patient ${patientId} not found or has no org`);
      return false;
    }

    const org = patient.org;
    
    // If org doesn't require consent, allow recording
    if (!org.requirePatientConsent) {
      return true;
    }

    // If org requires consent, check patient's consent status
    return patient.consented === true;
  } catch (error) {
    logger.error(`[Patient Service] Error checking patient consent for ${patientId}:`, error);
    return false; // Fail safe: don't allow recording if we can't verify consent
  }
};

/**
 * Verify patient consent token and update patient consent status
 * @param {string} consentToken - Consent token from email
 * @returns {Promise<{success: boolean, patient: Patient, message: string}>}
 */
const verifyConsentToken = async (consentToken) => {
  try {
    logger.info(`[Patient Service] Verifying consent token (length: ${consentToken?.length || 0})`);
    
    // Verify the token
    const consentTokenDoc = await tokenService.verifyToken(consentToken, tokenTypes.PATIENT_CONSENT);
    logger.info(`[Patient Service] Token verified successfully, patient ID: ${consentTokenDoc.client}`);
    
    const patient = await Patient.findById(consentTokenDoc.client).populate('org');
    
    if (!patient) {
      logger.error(`[Patient Service] Client not found for ID: ${consentTokenDoc.client}`);
      throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
    }
    
    logger.info(`[Patient Service] Patient found: ${patient.name}, already consented: ${patient.consented}`);
    
    // Check if already consented
    if (patient.consented === true) {
      // Delete the token but return success
      await Token.deleteMany({ client: patient.id, type: tokenTypes.PATIENT_CONSENT });
      return {
        success: true,
        alreadyConsented: true,
        message: 'You have already provided consent for call recording.',
        patient,
      };
    }
    
    // Delete all consent tokens for this patient
    await Token.deleteMany({ client: patient.id, type: tokenTypes.PATIENT_CONSENT });
    
    // Update patient consent status
    const consentEmailVersion = patient.consentEmailVersion || '1.0';
    await updatePatientById(patient.id, {
      consented: true,
      consentedAt: new Date(),
      consentEmailVersion,
    });
    
    logger.info(`[Patient Service] Patient ${patient.id} consent updated successfully`);
    
    return {
      success: true,
      alreadyConsented: false,
      message: 'Thank you for providing your consent. Your wellness check calls may now be recorded.',
      patient: await getPatientById(patient.id),
    };
  } catch (error) {
    logger.error(`[Patient Service] Consent verification failed:`, error);
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
  getUnassignedPatients,
  sendConsentEmailIfRequired,
  checkPatientConsent,
  verifyConsentToken,
};
