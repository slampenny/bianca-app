const httpStatus = require('http-status');
const tokenService = require('./token.service');
const caregiverService = require('./caregiver.service');
const Token = require('../models/token.model');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');
/**
 * Login with caregivername and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Caregiver>}
 */
const loginCaregiverWithEmailAndPassword = async (email, password) => {
  const login = await caregiverService.getLoginCaregiverData(email);
  if (!login) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  
  // Check if user has a password (SSO users might not have one)
  if (!login.caregiver.password) {
    // Return a special error to indicate SSO account needs password linking
    const error = new ApiError(httpStatus.FORBIDDEN, 'This account was created with SSO. Please link your account by setting a password or using SSO login.');
    error.requiresPasswordLinking = true;
    error.ssoProvider = login.caregiver.ssoProvider;
    throw error;
  }
  
  // Verify password
  if (!(await login.caregiver.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  
  return login;
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
  await refreshTokenDoc.deleteOne();
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
      throw new ApiError(httpStatus.UNAUTHORIZED, `Caregiver not found: ${refreshTokenDoc.caregiver}`);
    }
    await refreshTokenDoc.deleteOne();

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
      throw new ApiError(httpStatus.UNAUTHORIZED, `Caregiver not found: ${refreshTokenDoc.caregiver}`);
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
 * @returns {Promise<{success: boolean, alreadyVerified?: boolean, message: string}>}
 */
const verifyEmail = async (verifyEmailToken) => {
  try {
    // First, try to verify the token
    const verifyEmailTokenDoc = await tokenService.verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
    const caregiver = await caregiverService.getCaregiverById(verifyEmailTokenDoc.caregiver);
    
    if (!caregiver) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid verification token');
    }
    
    // Check if already verified
    if (caregiver.isEmailVerified) {
      // Still return tokens for auto-login if already verified
      const tokens = await tokenService.generateAuthTokens(caregiver);
      const { orgService } = require('./org.service');
      const { Patient } = require('../models');
      const org = caregiver.org ? await orgService.getOrgById(caregiver.org) : null;
      const patients = await Patient.find({ caregivers: caregiver.id });
      
      return {
        success: true,
        alreadyVerified: true,
        message: 'Your email is already verified. You can proceed to login.',
        caregiver,
        tokens,
        org,
        patients
      };
    }
    
    // Delete all verification tokens for this caregiver
    await Token.deleteMany({ caregiver: caregiver.id, type: tokenTypes.VERIFY_EMAIL });
    
    // Mark email as verified
    await caregiverService.updateCaregiverById(caregiver.id, { isEmailVerified: true });
    
    // Generate auth tokens for automatic login after verification
    const tokens = await tokenService.generateAuthTokens(caregiver);
    
    // Fetch org and patients for the response
    const { orgService } = require('./org.service');
    const { Patient } = require('../models');
    const org = caregiver.org ? await orgService.getOrgById(caregiver.org) : null;
    const patients = await Patient.find({ caregivers: caregiver.id });
    
    return {
      success: true,
      alreadyVerified: false,
      message: 'Email verified successfully',
      caregiver,
      tokens,
      org,
      patients
    };
  } catch (error) {
    // If it's an ApiError, check if it's a token verification error
    if (error instanceof ApiError) {
      // Check if the token might be invalid/expired, but account might already be verified
      // Try to find the caregiver by attempting to decode the token
      try {
        const jwt = require('jsonwebtoken');
        const config = require('../config/config');
        const decoded = jwt.verify(verifyEmailToken, config.jwt.secret);
        
        if (decoded.type === tokenTypes.VERIFY_EMAIL && decoded.sub) {
          const caregiver = await caregiverService.getCaregiverById(decoded.sub);
          if (caregiver && caregiver.isEmailVerified) {
            return {
              success: true,
              alreadyVerified: true,
              message: 'Your email is already verified. This verification link has expired, but your account is already verified.'
            };
          }
        }
      } catch (decodeError) {
        // Token is invalid, can't decode it
      }
      
      // Re-throw the original ApiError with its message
      throw error;
    }
    
    // For other errors, throw a generic error
    throw new ApiError(httpStatus.UNAUTHORIZED, error.message || 'Email verification failed');
  }
};

module.exports = {
  loginCaregiverWithEmailAndPassword,
  logout,
  refreshAuth,
  resetPassword,
  verifyEmail,
};
