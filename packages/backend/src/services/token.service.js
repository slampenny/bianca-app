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

const isClientScopedTokenType = (type) =>
  type === tokenTypes.CLIENT_CONSENT || type === tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY;

/**
 * Extract client ID from client object or string
 * Handles both Mongoose documents and plain objects
 * @param {Object|string} client - Client object or ID string
 * @returns {string} - Client ID as string
 */
const extractClientId = (client) => {
  if (!client) {
    throw new Error('Client is required');
  }
  
  let id;
  
  if (typeof client === 'string') {
    if (!mongoose.Types.ObjectId.isValid(client)) {
      logger.error('[Token Service] Invalid ObjectId string:', client);
      throw new Error('Invalid client ID format: not a valid ObjectId string');
    }
    return client;
  }
  
  if (client instanceof mongoose.Types.ObjectId || 
      (client.constructor && client.constructor.name === 'ObjectId')) {
    return client.toString();
  }
  
  id = client.id || client._id;
  
  if (!id) {
    logger.error('[Token Service] Cannot extract client ID from:', {
      hasId: !!client.id,
      has_id: !!client._id,
      clientType: typeof client,
      clientKeys: Object.keys(client || {})
    });
    throw new Error('Client ID not found in client object');
  }
  
  // Convert to string
  const idString = id.toString ? id.toString() : String(id);
  
  // Validate it's a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(idString)) {
    logger.error('[Token Service] Extracted ID is not a valid ObjectId:', {
      idString,
      idType: typeof id,
      clientType: typeof client,
      hasId: !!client.id,
      has_id: !!client._id
    });
    throw new Error(`Invalid client ID format: "${idString}" is not a valid ObjectId`);
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
 * @param {ObjectId} caregiverId - Required for caregiver-scoped token types
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @param {ObjectId} [clientId] - Required for client-scoped token types
 * @returns {Promise<Token>}
 */
const saveToken = async (token, caregiverId, expires, type, blacklisted = false, clientId = null) => {
  logger.debug(`[Token Service] Saving token - type: ${type}`);
  
  try {
    const tokenData = {
      token,
      expires: expires.toDate(),
      type,
      blacklisted,
    };
    
    if (isClientScopedTokenType(type)) {
      const clientIdString = extractClientId(clientId);
      if (!clientIdString) {
        throw new Error(`Client ID is required for ${type} token type`);
      }
      tokenData.client = clientIdString;
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
      caregiverId: !isClientScopedTokenType(type) ? caregiverId : null,
      client: isClientScopedTokenType(type) ? clientId : null,
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
  if (isClientScopedTokenType(type)) {
    query.client = payload.sub;
  } else {
    query.caregiver = payload.sub;
  }

  logger.debug(`[Token Service] Looking up token in database - token: ${token.substring(0, 20)}..., type: ${type}, ${isClientScopedTokenType(type) ? 'client' : 'caregiver'}: ${payload.sub}`);
  const tokenDoc = await Token.findOne(query);
  
  if (!tokenDoc) {
    logger.warn(`[Token Service] Token not found in database - type: ${type}, ${isClientScopedTokenType(type) ? 'client' : 'caregiver'}: ${payload.sub}`);
    // Check if token exists but is blacklisted
    const blacklistedQuery = { token, type };
    if (isClientScopedTokenType(type)) {
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

const generateSuperAdminInviteToken = async (caregiver) => {
  const caregiverId = extractCaregiverId(caregiver);
  const expires = moment().add(config.jwt.inviteExpirationMinutes, 'minutes');
  const token = generateToken(caregiverId, expires, tokenTypes.SUPERADMIN_INVITE);
  await saveToken(token, caregiverId, expires, tokenTypes.SUPERADMIN_INVITE);
  return token;
};

/**
 * Accept either facility invite or super-admin invite JWT (same expiry rules).
 * @param {string} token
 * @returns {Promise<{ tokenDoc: *, inviteKind: 'staff' | 'superAdmin' }>}
 */
const verifyStaffOrSuperAdminInviteToken = async (token) => {
  let lastError;
  for (const type of [tokenTypes.INVITE, tokenTypes.SUPERADMIN_INVITE]) {
    try {
      const tokenDoc = await verifyToken(token, type);
      return {
        tokenDoc,
        inviteKind: type === tokenTypes.SUPERADMIN_INVITE ? 'superAdmin' : 'staff',
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
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
 * Generate client consent token
 * @param {Client} client
 * @returns {Promise<string>}
 */
const generateClientConsentToken = async (client) => {
  logger.debug('[Token Service] Generating client consent token');
  const clientId = extractClientId(client);
  logger.debug(`[Token Service] Extracted client ID: ${clientId}`);
  
  const expires = moment().add(30, 'days');
  const consentToken = generateToken(clientId, expires, tokenTypes.CLIENT_CONSENT);
  logger.debug(`[Token Service] Generated token, saving to database...`);
  
  await saveToken(consentToken, null, expires, tokenTypes.CLIENT_CONSENT, false, clientId);
  logger.info(`[Token Service] Client consent token created successfully for client ${clientId}`);
  
  return consentToken;
};

/**
 * Generate family digest email verification token (scoped to client + emergency contact email).
 * @param {Client} client
 * @param {string} email - Normalized emergency contact email
 * @returns {Promise<string>}
 */
const generateFamilyDigestEmailVerifyToken = async (client, email, recipientId) => {
  const clientId = extractClientId(client);
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is required for verification token');
  }

  await Token.deleteMany({ client: clientId, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });

  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const payload = {
    sub: clientId,
    email: normalizedEmail,
    ...(recipientId ? { recipientId: String(recipientId) } : {}),
    iat: moment().unix(),
    exp: expires.unix(),
    type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY,
  };
  const verifyToken = jwt.sign(payload, config.jwt.secret);
  await saveToken(verifyToken, null, expires, tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY, false, clientId);
  logger.info(`[Token Service] Family digest email verify token created for client ${clientId}`);
  return verifyToken;
};

module.exports = {
  verifyToken,
  generateToken,
  saveToken,
  generateAuthTokens,
  generateInviteToken,
  generateSuperAdminInviteToken,
  verifyStaffOrSuperAdminInviteToken,
  generateResetPasswordToken,
  generateVerifyEmailToken,
  generateClientConsentToken,
  generateFamilyDigestEmailVerifyToken,
  extractClientId,
};
