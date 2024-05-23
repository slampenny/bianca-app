const httpStatus = require('http-status');
const tokenService = require('./token.service');
const caregiverService = require('./caregiver.service');
const Token = require('../models/token.model');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');
const logger = require('../config/logger');
/**
 * Login with caregivername and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Caregiver>}
 */
const loginCaregiverWithEmailAndPassword = async (email, password) => {
  const caregiver = await caregiverService.getCaregiverByEmail(email);
  if (!caregiver || !(await caregiver.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return caregiver;
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
const logout = async (refreshToken) => {
  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false });
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await refreshTokenDoc.remove();
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(refreshToken, tokenTypes.REFRESH);
    const caregiver = await caregiverService.getCaregiverById(refreshTokenDoc.caregiver);
    if (!caregiver) {
      throw new Error();
    }
    await refreshTokenDoc.remove();
    return tokenService.generateAuthTokens(caregiver);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise}
 */
const resetPassword = async (resetPasswordToken, newPassword) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
    const caregiver = await caregiverService.getCaregiverById(resetPasswordTokenDoc.caregiver);
    if (!caregiver) {
      throw new Error();
    }
    await caregiverService.updateCaregiverById(caregiver.id, { password: newPassword });
    await Token.deleteMany({ caregiver: caregiver.id, type: tokenTypes.RESET_PASSWORD });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

/**
 * Verify email
 * @param {string} verifyEmailToken
 * @returns {Promise}
 */
const verifyEmail = async (verifyEmailToken) => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
    const caregiver = await caregiverService.getCaregiverById(verifyEmailTokenDoc.caregiver);
    if (!caregiver) {
      throw new Error();
    }
    await Token.deleteMany({ caregiver: caregiver.id, type: tokenTypes.VERIFY_EMAIL });
    await caregiverService.updateCaregiverById(caregiver.id, { isEmailVerified: true });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};

module.exports = {
  loginCaregiverWithEmailAndPassword,
  logout,
  refreshAuth,
  resetPassword,
  verifyEmail,
};
