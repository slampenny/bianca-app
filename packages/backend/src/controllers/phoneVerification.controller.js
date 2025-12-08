const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { smsVerificationService } = require('../services');
const ApiError = require('../utils/ApiError');

/**
 * Send verification code to phone number
 * @route POST /v1/phone-verification/send-code
 * @access Private
 */
const sendVerificationCode = catchAsync(async (req, res) => {
  const caregiverId = req.caregiver?.id || req.caregiver?._id?.toString() || req.user?.caregiverId || req.user?.id; // From auth middleware
  const { phoneNumber } = req.body;

  if (!caregiverId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Caregiver not found in request');
  }

  const result = await smsVerificationService.sendVerificationCode(phoneNumber, caregiverId);
  
  res.status(httpStatus.OK).json({
    success: true,
    message: 'Verification code sent',
    expiresAt: result.expiresAt,
    phoneNumber: result.phoneNumber // Masked
  });
});

/**
 * Verify the code entered by user
 * @route POST /v1/phone-verification/verify
 * @access Private
 */
const verifyCode = catchAsync(async (req, res) => {
  const caregiverId = req.caregiver?.id || req.caregiver?._id?.toString() || req.user?.caregiverId || req.user?.id;
  const { code } = req.body;

  if (!caregiverId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Caregiver not found in request');
  }

  if (!code) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Verification code is required');
  }

  await smsVerificationService.verifyCode(caregiverId, code);
  
  res.status(httpStatus.OK).json({
    success: true,
    message: 'Phone number verified successfully'
  });
});

/**
 * Resend verification code
 * @route POST /v1/phone-verification/resend
 * @access Private
 */
const resendCode = catchAsync(async (req, res) => {
  const caregiverId = req.caregiver?.id || req.caregiver?._id?.toString() || req.user?.caregiverId || req.user?.id;
  
  if (!caregiverId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Caregiver not found in request');
  }
  
  const result = await smsVerificationService.resendVerificationCode(caregiverId);
  
  res.status(httpStatus.OK).json({
    success: true,
    message: 'Verification code resent',
    expiresAt: result.expiresAt,
    phoneNumber: result.phoneNumber
  });
});

module.exports = {
  sendVerificationCode,
  verifyCode,
  resendCode
};

