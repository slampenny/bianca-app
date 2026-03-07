const jwt = require('jsonwebtoken');
const moment = require('moment');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const config = require('../config/config');
const caregiverService = require('./caregiver.service');
const { Token } = require('../models');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');
const logger = require('../config/logger');

/**
 * Extract patient ID from patient object or string
 * Handles both Mongoose documents and plain objects
 * @param {Object|string} patient - Patient object or ID string
 * @returns {string} - Patient ID as string
 */
const extractPatientId = (patient) => {
  if (!patient) {
    throw new Error('Patient is required');
  }
  
  let id;
  
  // If it's already a string, validate it's a valid ObjectId
  if (typeof patient === 'string') {
    if (!mongoose.Types.ObjectId.isValid(patient)) {
      logger.error('[Token Service] Invalid ObjectId string:', patient);
      throw new Error('Invalid patient ID format: not a valid ObjectId string');
    }
    return patient;
  }
  
  // If it's a Mongoose ObjectId directly, convert to string
  if (patient instanceof mongoose.Types.ObjectId || 
      (patient.constructor && patient.constructor.name === 'ObjectId')) {
    return patient.toString();
  }
  
  // Try to get ID from object (handles both .id and ._id)
  id = patient.id || patient._id;
  
  if (!id) {
    logger.error('[Token Service] Cannot extract patient ID from:', {
      hasId: !!patient.id,
      has_id: !!patient._id,
      patientType: typeof patient,
      patientKeys: Object.keys(patient || {})
    });
    throw new Error('Patient ID not found in patient object');
  }
  
  // Convert to string
  const idString = id.toString ? id.toString() : String(id);
  
  // Validate it's a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(idString)) {
    logger.error('[Token Service] Extracted ID is not a valid ObjectId:', {
      idString,
      idType: typeof id,
      patientType: typeof patient,
      hasId: !!patient.id,
      has_id: !!patient._id
    });
    throw new Error(`Invalid patient ID format: "${idString}" is not a valid ObjectId`);
  }
  
  return idString;
};

/**
 * Extract caregiver ID from caregiver object or string
 * Handles both Mongoose documents and plain objects
 * @param {Object|string} caregiver - Caregiver object or ID string
 * @returns {string} - Caregiver ID as string
 */
const extractCaregiverId = (caregiver) => {
  if (!caregiver) {
    throw new Error('Caregiver is required');
  }
  
  let id;
  
  // If it's already a string, validate it's a valid ObjectId
  if (typeof caregiver === 'string') {
    if (!mongoose.Types.ObjectId.isValid(caregiver)) {
      logger.error('[Token Service] Invalid ObjectId string:', caregiver);
      throw new Error('Invalid caregiver ID format: not a valid ObjectId string');
    }
    return caregiver;
  }
  
  // If it's a Mongoose ObjectId directly, convert to string
  if (caregiver instanceof mongoose.Types.ObjectId || 
      (caregiver.constructor && caregiver.constructor.name === 'ObjectId')) {
    return caregiver.toString();
  }
  
  // Try to get ID from object (handles both .id and ._id)
  id = caregiver.id || caregiver._id;
  
  if (!id) {
    logger.error('[Token Service] Cannot extract caregiver ID from:', {
      hasId: !!caregiver.id,
      has_id: !!caregiver._id,
      caregiverType: typeof caregiver,
      caregiverKeys: Object.keys(caregiver || {})
    });
    throw new Error('Caregiver ID not found in caregiver object');
  }
  
  // Convert to string
  const idString = id.toString ? id.toString() : String(id);
  
  // Validate it's a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(idString)) {
    logger.error('[Token Service] Extracted ID is not a valid ObjectId:', {
      idString,
      idType: typeof id,
      caregiverType: typeof caregiver,
      hasId: !!caregiver.id,
      has_id: !!caregiver._id
    });
    throw new Error(`Invalid caregiver ID format: "${idString}" is not a valid ObjectId`);
  }
  
  return idString;
};

/**
 * @typedef {{ value: string; expires: string; }} AuthToken
 * @typedef {{ accessToken: AuthToken, refreshToken: AuthToken }} AuthTokens
 */

/**
 * Generate token
 * @param {ObjectId} caregiverId
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
const generateToken = (
  caregiverId,
  expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes'),
  type = tokenTypes.ACCESS,
  secret = config.jwt.secret
) => {
  const payload = {
    sub: caregiverId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Save a token
 * @param {string} token
 * @param {ObjectId} caregiverId - Required for all token types except PATIENT_CONSENT
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @param {ObjectId} [patientId] - Required only for PATIENT_CONSENT token type
 * @returns {Promise<Token>}
 */
const saveToken = async (token, caregiverId, expires, type, blacklisted = false, patientId = null) => {
  logger.debug(`[Token Service] Saving token - type: ${type}`);
  
  try {
    const tokenData = {
      token,
      expires: expires.toDate(),
      type,
      blacklisted,
    };
    
    // For patient consent tokens, use patient ID
    if (type === tokenTypes.PATIENT_CONSENT) {
      const patientIdString = extractPatientId(patientId);
      if (!patientIdString) {
        throw new Error('Patient ID is required for PATIENT_CONSENT token type');
      }
      tokenData.client = patientIdString;
    } else {
      // For all other token types, use caregiver ID
      const caregiverIdString = extractCaregiverId(caregiverId);
      if (!caregiverIdString) {
        throw new Error('Caregiver ID is required for this token type');
      }
      tokenData.caregiver = caregiverIdString;
    }
    
    const tokenDoc = await Token.create(tokenData);
    logger.debug(`[Token Service] Token saved successfully - id: ${tokenDoc._id}`);
    return tokenDoc;
  } catch (error) {
    logger.error('[Token Service] Failed to save token:', {
      error: error.message,
      type,
      caregiverId: type !== tokenTypes.PATIENT_CONSENT ? caregiverId : null,
      client: type === tokenTypes.PATIENT_CONSENT ? patientId : null,
      hasToken: !!token
    });
    throw error;
  }
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<Token>}
 */
const verifyToken = async (token, type) => {
  logger.debug(`[Token Service] Verifying token - type: ${type}, token length: ${token?.length || 0}`);
  
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
    logger.debug(`[Token Service] JWT verified successfully - sub: ${payload.sub}, type: ${payload.type}, exp: ${payload.exp}`);
  } catch (err) {
    logger.warn(`[Token Service] JWT verification failed: ${err.message}`);
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token');
  }

  // Build query based on token type
  const query = { token, type, blacklisted: false };
  if (type === tokenTypes.PATIENT_CONSENT) {
    query.client = payload.sub;
  } else {
    query.caregiver = payload.sub;
  }

  logger.debug(`[Token Service] Looking up token in database - token: ${token.substring(0, 20)}..., type: ${type}, ${type === tokenTypes.PATIENT_CONSENT ? 'patient' : 'caregiver'}: ${payload.sub}`);
  const tokenDoc = await Token.findOne(query);
  
  if (!tokenDoc) {
    logger.warn(`[Token Service] Token not found in database - type: ${type}, ${type === tokenTypes.PATIENT_CONSENT ? 'patient' : 'caregiver'}: ${payload.sub}`);
    // Check if token exists but is blacklisted
    const blacklistedQuery = { token, type };
    if (type === tokenTypes.PATIENT_CONSENT) {
      blacklistedQuery.client = payload.sub;
    } else {
      blacklistedQuery.caregiver = payload.sub;
    }
    const blacklistedToken = await Token.findOne(blacklistedQuery);
    if (blacklistedToken) {
      logger.warn(`[Token Service] Token found but is blacklisted`);
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Token has been revoked');
    }
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Token not found');
  }

  logger.debug(`[Token Service] Token found in database - expires: ${tokenDoc.expires}`);
  return tokenDoc;
};

/**
 * Generate auth tokens
 * @param {Caregiver} caregiver
 * @returns {Promise<AuthTokens>}
 */
const generateAuthTokens = async (caregiver) => {
  const caregiverId = extractCaregiverId(caregiver);
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(caregiverId, accessTokenExpires, tokenTypes.ACCESS);

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(caregiverId, refreshTokenExpires, tokenTypes.REFRESH);
  await saveToken(refreshToken, caregiverId, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.unix(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.unix(),
    },
  };
};

const generateInviteToken = async (caregiver) => {
  const caregiverId = extractCaregiverId(caregiver);
  const expires = moment().add(config.jwt.inviteExpirationMinutes, 'minutes');
  const token = generateToken(caregiverId, expires, tokenTypes.INVITE);
  await saveToken(token, caregiverId, expires, tokenTypes.INVITE);
  return token;
};

/**
 * Generate reset password token
 * @param {string} email
 * @returns {Promise<string>}
 */
const generateResetPasswordToken = async (email) => {
  const caregiver = await caregiverService.getCaregiverByEmail(email);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No caregivers found with this email');
  }
  const caregiverId = extractCaregiverId(caregiver);
  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(caregiverId, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetPasswordToken, caregiverId, expires, tokenTypes.RESET_PASSWORD);
  return resetPasswordToken;
};

/**
 * Generate verify email token
 * @param {Caregiver} caregiver
 * @returns {Promise<string>}
 */
const generateVerifyEmailToken = async (caregiver) => {
  logger.debug('[Token Service] Generating verify email token');
  const caregiverId = extractCaregiverId(caregiver);
  logger.debug(`[Token Service] Extracted caregiver ID: ${caregiverId}`);
  
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(caregiverId, expires, tokenTypes.VERIFY_EMAIL);
  logger.debug(`[Token Service] Generated token, saving to database...`);
  
  await saveToken(verifyEmailToken, caregiverId, expires, tokenTypes.VERIFY_EMAIL);
  logger.info(`[Token Service] Verify email token created successfully for caregiver ${caregiverId}`);
  
  return verifyEmailToken;
};

/**
 * Generate patient consent token
 * @param {Patient} patient
 * @returns {Promise<string>}
 */
const generatePatientConsentToken = async (patient) => {
  logger.debug('[Token Service] Generating patient consent token');
  const patientId = extractPatientId(patient);
  logger.debug(`[Token Service] Extracted patient ID: ${patientId}`);
  
  // Consent tokens expire in 30 days (same as email mentions)
  const expires = moment().add(30, 'days');
  const consentToken = generateToken(patientId, expires, tokenTypes.PATIENT_CONSENT);
  logger.debug(`[Token Service] Generated token, saving to database...`);
  
  await saveToken(consentToken, null, expires, tokenTypes.PATIENT_CONSENT, false, patientId);
  logger.info(`[Token Service] Patient consent token created successfully for patient ${patientId}`);
  
  return consentToken;
};

module.exports = {
  verifyToken,
  generateToken,
  saveToken,
  generateAuthTokens,
  generateInviteToken,
  generateResetPasswordToken,
  generateVerifyEmailToken,
  generatePatientConsentToken,
  extractPatientId,
};
