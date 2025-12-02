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
 * @param {ObjectId} caregiverId
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @returns {Promise<Token>}
 */
const saveToken = async (token, caregiverId, expires, type, blacklisted = false) => {
  // Extract and validate caregiver ID
  const caregiverIdString = extractCaregiverId(caregiverId);
  
  if (!caregiverIdString) {
    logger.error('[Token Service] Invalid caregiver ID provided to saveToken:', {
      caregiverId,
      type: typeof caregiverId
    });
    throw new Error('Invalid caregiver ID');
  }
  
  // Ensure caregiver ID is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(caregiverIdString)) {
    logger.error('[Token Service] Caregiver ID is not a valid ObjectId:', caregiverIdString);
    throw new Error('Invalid caregiver ID format');
  }
  
  logger.debug(`[Token Service] Saving token - type: ${type}, caregiver: ${caregiverIdString}`);
  
  try {
    const tokenDoc = await Token.create({
      token,
      caregiver: caregiverIdString,
      expires: expires.toDate(),
      type,
      blacklisted,
    });
    logger.debug(`[Token Service] Token saved successfully - id: ${tokenDoc._id}`);
    return tokenDoc;
  } catch (error) {
    logger.error('[Token Service] Failed to save token:', {
      error: error.message,
      type,
      caregiverId: caregiverIdString,
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

  logger.debug(`[Token Service] Looking up token in database - token: ${token.substring(0, 20)}..., type: ${type}, caregiver: ${payload.sub}`);
  const tokenDoc = await Token.findOne({ token, type, caregiver: payload.sub, blacklisted: false });
  
  if (!tokenDoc) {
    logger.warn(`[Token Service] Token not found in database - type: ${type}, caregiver: ${payload.sub}`);
    // Check if token exists but is blacklisted
    const blacklistedToken = await Token.findOne({ token, type, caregiver: payload.sub });
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

module.exports = {
  verifyToken,
  generateToken,
  saveToken,
  generateAuthTokens,
  generateInviteToken,
  generateResetPasswordToken,
  generateVerifyEmailToken,
};
