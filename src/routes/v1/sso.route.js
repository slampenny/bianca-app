const express = require('express');
const validate = require('../../middlewares/validate');
const ssoValidation = require('../../validations/sso.validation');
const ssoController = require('../../controllers/sso.controller');

const router = express.Router();

// SSO login endpoint
router.post('/login', validate(ssoValidation.login), ssoController.login);

// Verify SSO token endpoint (for backend verification)
router.post('/verify', validate(ssoValidation.verify), ssoController.verify);

// Get OAuth configuration for frontend
router.get('/config', ssoController.getConfig);

module.exports = router;
