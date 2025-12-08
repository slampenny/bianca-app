const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { phoneVerificationValidation } = require('../../validations');
const { phoneVerificationController } = require('../../controllers');

const router = express.Router();

router.post(
  '/send-code',
  auth(),
  validate(phoneVerificationValidation.phoneVerificationValidation.sendCode),
  phoneVerificationController.sendVerificationCode
);

router.post(
  '/verify',
  auth(),
  validate(phoneVerificationValidation.phoneVerificationValidation.verify),
  phoneVerificationController.verifyCode
);

router.post(
  '/resend',
  auth(),
  phoneVerificationController.resendCode
);

module.exports = router;

