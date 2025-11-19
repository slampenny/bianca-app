const Joi = require('joi');

const sendCode = {
  body: Joi.object().keys({
    phoneNumber: Joi.string()
      .optional() // Optional - will use caregiver's existing phone if not provided
      .custom((value, helpers) => {
        if (!value) return value; // Allow empty/undefined (will use caregiver's phone)
        
        // Remove all non-digit characters for validation
        const digits = value.replace(/\D/g, '');
        
        // Accept E.164 format (+1XXXXXXXXXX)
        if (value.startsWith('+')) {
          const e164Regex = /^\+[1-9]\d{9,14}$/;
          if (e164Regex.test(value)) {
            return value; // Valid E.164 format
          }
          return helpers.message('Phone number must be in E.164 format (e.g., +1234567890)');
        }
        
        // Accept 10-digit US numbers (will be converted to E.164 by service)
        if (digits.length === 10) {
          return value; // Valid 10-digit format
        }
        
        // Accept 11-digit numbers starting with 1 (will be converted to E.164 by service)
        if (digits.length === 11 && digits.startsWith('1')) {
          return value; // Valid 11-digit format
        }
        
        return helpers.message('Phone number must be 10 digits or in E.164 format (e.g., +1234567890)');
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

