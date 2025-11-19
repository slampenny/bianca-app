const Joi = require('joi');

const sendCode = {
  body: Joi.object().keys({
    phoneNumber: Joi.string()
      .optional() // Optional - will use caregiver's existing phone if not provided
      .pattern(/^\+[1-9]\d{1,14}$/) // E.164 format
      .messages({
        'string.pattern.base': 'Phone number must be in E.164 format (e.g., +1234567890)'
      })
  })
};

const verify = {
  body: Joi.object().keys({
    code: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.length': 'Verification code must be 6 digits',
        'string.pattern.base': 'Verification code must contain only numbers'
      })
  })
};

module.exports = {
  phoneVerificationValidation: {
    sendCode,
    verify
  }
};

