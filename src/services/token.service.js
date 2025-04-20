const jwt = require('jsonwebtoken');
const moment = require('moment');
const httpStatus = require('http-status');
const config = require('../config/config');
const caregiverService = require('./caregiver.service');
const { Token } = require('../models');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');

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
  const tokenDoc = await Token.create({
    token,
    caregiver: caregiverId,
    expires: expires.toDate(),
    type,
    blacklisted,
  });
  return tokenDoc;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<Token>}
 */
const verifyToken = async (token, type) => {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    throw new Error('Invalid or expired invite token');
  }

  const tokenDoc = await Token.findOne({ token, type, caregiver: payload.sub, blacklisted: false });
  if (!tokenDoc) {
    throw new Error('Token not found');
  }

  return tokenDoc;
};

/**
 * Generate auth tokens
 * @param {Caregiver} caregiver
 * @returns {Promise<AuthTokens>}
 */
const generateAuthTokens = async (caregiver) => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(caregiver.id, accessTokenExpires, tokenTypes.ACCESS);

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(caregiver.id, refreshTokenExpires, tokenTypes.REFRESH);
  await saveToken(refreshToken, caregiver.id, refreshTokenExpires, tokenTypes.REFRESH);

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
  const token = generateToken(
    caregiver.id,
    (expires = moment().add(config.jwt.inviteExpirationMinutes, 'minutes')),
    (type = tokenTypes.INVITE)
  );
  await saveToken(token, caregiver.id, expires, tokenTypes.INVITE);
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
  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(caregiver.id, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetPasswordToken, caregiver.id, expires, tokenTypes.RESET_PASSWORD);
  return resetPasswordToken;
};

/**
 * Generate verify email token
 * @param {Caregiver} caregiver
 * @returns {Promise<string>}
 */
const generateVerifyEmailToken = async (caregiver) => {
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(caregiver.id, expires, tokenTypes.VERIFY_EMAIL);
  await saveToken(verifyEmailToken, caregiver.id, expires, tokenTypes.VERIFY_EMAIL);
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
