const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { authService, caregiverService, orgService, tokenService, emailService, alertService, mfaService } = require('../services');
const { AlertDTO, CaregiverDTO, OrgDTO, PatientDTO } = require('../dtos');
const { auditAuthFailure } = require('../middlewares/auditLog');
const { AuditLog, Token } = require('../models');
const i18n = require('i18n');

const register = catchAsync(async (req, res, next) => {
  const org = await orgService.createOrg(
    {
      email: req.body.email,
      name: req.body.name,
      phone: req.body.phone,
    },
    {
      email: req.body.email,
      name: req.body.name,
      phone: req.body.phone,
      password: req.body.password,
      role: 'unverified', // Explicitly set unverified role
    }
  );

  const caregiver = org.caregivers[0];
  
  // Send verification email automatically after registration
  try {
    const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
    const locale = caregiver.preferredLanguage || 'en';
    await emailService.sendVerificationEmail(caregiver.email, verifyEmailToken, caregiver.name, locale);
  } catch (emailError) {
    console.error('Failed to send verification email during registration:', emailError);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Registration successful but verification email failed. Please contact support.');
  }
  
  // Don't return tokens until email is verified
  res.status(httpStatus.CREATED).send({ 
    message: 'Registration successful. Please check your email to verify your account.',
    caregiver: CaregiverDTO(caregiver),
    requiresEmailVerification: true
  });
});

const registerWithInvite = catchAsync(async (req, res) => {
  const { token, password, name, email, phone } = req.body;
  const { tokenTypes } = require('../config/tokens');
  const inviteTokenDoc = await tokenService.verifyToken(token, tokenTypes.INVITE);
  
  // Get the existing invited caregiver (created when invite was sent)
  const invitedCaregiver = await caregiverService.getCaregiverById(inviteTokenDoc.caregiver);
  if (!invitedCaregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Invited caregiver not found');
  }
  
  // Verify the email matches the invite
  if (invitedCaregiver.email !== email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email does not match the invite');
  }
  
  // Update the existing caregiver with password and other info (this will also promote from 'invited' to 'staff')
  const caregiver = await caregiverService.updateCaregiverById(invitedCaregiver.id, {
    password,
    name,
    phone,
  });
  
  // Delete the invite token since it's been used
  await Token.deleteMany({ caregiver: caregiver.id, type: tokenTypes.INVITE });
  
  const caregiverDTO = CaregiverDTO(caregiver);
  const tokens = await tokenService.generateAuthTokens(caregiver);
  res.status(httpStatus.CREATED).send({ caregiver: caregiverDTO, tokens });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password, mfaToken } = req.body;
  
  try {
    // Step 1: Validate credentials
    const loginData = await authService.loginCaregiverWithEmailAndPassword(email, password);
    const { caregiver, patients, org } = loginData;

    // Check if account is locked
    if (caregiver.accountLocked) {
      throw new Error(`Account is locked: ${caregiver.lockedReason || 'Contact support for assistance'}`);
    }

    // Step 1.5: Check email verification status
    if (!caregiver.isEmailVerified) {
      // Send verification email if not already sent recently
      try {
        const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
        const locale = caregiver.preferredLanguage || 'en';
        await emailService.sendVerificationEmail(caregiver.email, verifyEmailToken, caregiver.name, locale);
      } catch (emailError) {
        console.error('Failed to resend verification email:', emailError);
      }
      
      throw new ApiError(httpStatus.FORBIDDEN, 'Please verify your email before logging in. A verification email has been sent.');
    }

    // Step 2: Check MFA requirement
    if (caregiver.mfaEnabled) {
      // If MFA is enabled but no token provided, return requireMFA flag
      if (!mfaToken) {
        // Generate a temporary token for MFA verification
        const tempToken = await tokenService.generateToken(
          caregiver.id,
          require('moment')().add(5, 'minutes'),
          'MFA_TEMP'
        );

        return res.status(200).send({
          requireMFA: true,
          tempToken,
          message: 'MFA verification required'
        });
      }
      
      // Verify MFA token
      const mfaValid = await mfaService.verifyMFAToken(caregiver.id, mfaToken);
      if (!mfaValid) {
        // Log failed MFA attempt
        await auditAuthFailure(
          email,
          req.ip || req.connection.remoteAddress,
          req.get('user-agent'),
          'Invalid MFA token'
        );
        throw new Error('Invalid MFA token');
      }
    }
    
    // Step 3: Reset failed login attempts on successful login
    if (caregiver.failedLoginAttempts > 0) {
      await caregiverService.updateCaregiverById(caregiver.id, {
        failedLoginAttempts: 0,
        lastFailedLogin: null
      });
    }

    // Step 4: Create session and audit log
    const alerts = await alertService.getAlerts(caregiver.id);
    const alertDTOs = alerts.map((alert) => AlertDTO(alert));
    const patientDTOs = patients.map((patient) => PatientDTO(patient));
    const caregiverDTO = CaregiverDTO(caregiver);
    const tokens = await tokenService.generateAuthTokens(caregiver);
    
    // Use org from loginData (already populated) or fallback to caregiver.org
    // Ensure org is an object, not just an ID (in case populate failed)
    let orgForDTO = org || caregiver.org;
    
    // If org is not populated (might be ObjectId or string), fetch it manually
    if (orgForDTO) {
      const mongoose = require('mongoose');
      const isObjectId = orgForDTO instanceof mongoose.Types.ObjectId || 
                        (orgForDTO.constructor && orgForDTO.constructor.name === 'ObjectId');
      const isString = typeof orgForDTO === 'string';
      
      // Check if org doesn't have expected properties (means it's not populated)
      const hasOrgProperties = orgForDTO.name !== undefined || orgForDTO.email !== undefined;
      
      if ((isObjectId || isString) || !hasOrgProperties) {
        // org is an ObjectId, string, or not properly populated - fetch it
        const Org = require('../models/org.model');
        const orgId = isObjectId ? orgForDTO : (orgForDTO._id || orgForDTO.toString());
        orgForDTO = await Org.findById(orgId);
      }
    }
    
    // Create audit log for successful login
    await AuditLog.create({
      timestamp: new Date(),
      userId: caregiver.id,
      userRole: caregiver.role,
      action: 'LOGIN',
      resource: 'session',
      resourceId: caregiver.id,
      outcome: 'SUCCESS',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      complianceFlags: {
        phiAccessed: false,
        highRiskAction: false,
        requiresReview: false
      }
    });
    
    res.send({ org: OrgDTO(orgForDTO), caregiver: caregiverDTO, patients: patientDTOs, alerts: alertDTOs, tokens });
  } catch (error) {
    // HIPAA Compliance: Log failed authentication attempts
    await auditAuthFailure(
      email,
      req.ip || req.connection.remoteAddress,
      req.get('user-agent'),
      error.message
    );
    // Re-throw to be handled by error middleware
    // IMPORTANT: Preserve custom properties (requiresPasswordLinking, ssoProvider) when re-throwing
    // This ensures the error middleware can include them in the response
    if (error instanceof ApiError) {
      // If it's already an ApiError, just re-throw (properties are already on it)
      throw error;
    } else {
      // If it's a regular Error, convert to ApiError but preserve custom properties
      const apiError = new ApiError(
        error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error',
        false,
        error.stack
      );
      if (error.requiresPasswordLinking !== undefined) {
        apiError.requiresPasswordLinking = error.requiresPasswordLinking;
      }
      if (error.ssoProvider !== undefined) {
        apiError.ssoProvider = error.ssoProvider;
      }
      throw apiError;
    }
  }
});

const logout = catchAsync(async (req, res) => {
  const { logoutSession } = require('../middlewares/sessionTimeout');
  
  await authService.logout(req.body.refreshToken);
  
  // HIPAA Compliance: Expire session and create audit log
  if (req.caregiver && req.caregiver._id) {
    await logoutSession(
      req.caregiver._id.toString(),
      req.ip || req.connection.remoteAddress,
      req.get('user-agent')
    );
  }
  
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ tokens });
});

const forgotPassword = catchAsync(async (req, res) => {
  try {
    // Get caregiver to retrieve preferred language
    const caregiver = await caregiverService.getCaregiverByEmail(req.body.email);
    const locale = caregiver?.preferredLanguage || 'en';
    
    const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
    await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken, locale);
  } catch (error) {
    // Security best practice: Don't reveal if email exists or not
    // Always return success to prevent email enumeration attacks
    // Log the error for debugging purposes
    if (error.statusCode === httpStatus.NOT_FOUND) {
      logger.debug(`Password reset requested for non-existent email: ${req.body.email}`);
    } else {
      // Re-throw other errors (validation, email service failures, etc.)
      throw error;
    }
  }
  // Always return success (204) regardless of whether email exists
  // This prevents attackers from enumerating valid email addresses
  res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.query.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Set password for SSO user
 * Allows SSO users to set a password so they can login with email/password
 */
const setPasswordForSSO = catchAsync(async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  
  if (!email || !password || !confirmPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email, password, and confirmation password are required');
  }
  
  if (password !== confirmPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Passwords do not match');
  }
  
  // Find the caregiver
  const caregiver = await caregiverService.getCaregiverByEmail(email);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // Verify this is an SSO user without a password
  if (caregiver.password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This account already has a password');
  }
  
  if (!caregiver.ssoProvider) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This account is not an SSO account');
  }
  
  // Set the password
  await caregiverService.updateCaregiverById(caregiver.id, { password });
  
  res.status(httpStatus.OK).send({
    message: 'Password set successfully. You can now login with your email and password.',
    success: true
  });
});

const sendVerificationEmail = catchAsync(async (req, res) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.body.caregiver);
  const locale = req.body.caregiver.preferredLanguage || 'en';
  await emailService.sendVerificationEmail(req.body.caregiver.email, verifyEmailToken, req.body.caregiver.name, locale);
  res.status(httpStatus.NO_CONTENT).send();
});

const resendVerificationEmail = catchAsync(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is required');
  }
  
  // Find caregiver by email
  const caregiver = await caregiverService.getCaregiverByEmail(email);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // Check if already verified
  if (caregiver.isEmailVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }
  
  // Generate and send new verification token
  try {
    const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
    const locale = caregiver.preferredLanguage || 'en';
    await emailService.sendVerificationEmail(caregiver.email, verifyEmailToken, caregiver.name, locale);
    res.status(httpStatus.OK).send({ message: 'Verification email sent successfully' });
  } catch (emailError) {
    console.error('Failed to resend verification email:', emailError);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send verification email');
  }
});

// Helper function to generate styled, themed, and localized HTML pages
const generateVerificationPage = (req, isError, options = {}) => {
  // Get locale from request (i18n middleware sets req.locale)
  const locale = req.locale || req.getLocale?.() || 'en';
  const isAlreadyVerified = options.isAlreadyVerified || false;
  const errorMessage = options.errorMessage || '';
  const isExpired = options.isExpired || false;
  
  // Get translations (fallback to English if not available)
  const t = (key) => {
    try {
      const result = i18n.__({ phrase: key, locale });
      // Ensure we always return a string (i18n might return object if not initialized)
      return (typeof result === 'string' ? result : key);
    } catch {
      return key;
    }
  };
  
  const title = isError 
    ? t('emailVerificationFailedPage.title')
    : (isAlreadyVerified ? t('emailVerifiedPage.titleAlreadyVerified') : t('emailVerifiedPage.title'));
  
  const message = isError
    ? (isExpired ? t('emailVerificationFailedPage.messageExpired') : (errorMessage || t('emailVerificationFailedPage.messageInvalid')))
    : (isAlreadyVerified ? t('emailVerifiedPage.messageAlreadyVerified') : t('emailVerifiedPage.message'));
  
  const helpText = isError
    ? (isExpired ? t('emailVerificationFailedPage.helpExpired') : t('emailVerificationFailedPage.helpGeneric'))
    : '';
  
  const buttonText = isError
    ? t('emailVerificationFailedPage.loginButton')
    : t('emailVerifiedPage.continueButton');
  
  const redirectingText = isError ? '' : t('emailVerifiedPage.redirecting');
  
  return `
    <!DOCTYPE html>
    <html lang="${locale}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - My Phone Friend</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        :root {
          --bg-primary: #ffffff;
          --bg-secondary: #f8f9fa;
          --text-primary: #1a1a1a;
          --text-secondary: #6b7280;
          --text-tertiary: #9ca3af;
          --border-color: #e5e5e5;
          --success-color: #10b981;
          --error-color: #ef4444;
          --success-bg: #d1fae5;
          --error-bg: #fee2e2;
          --button-bg: #10b981;
          --button-hover: #059669;
          --shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg-primary: #1a1a1a;
            --bg-secondary: #000000;
            --text-primary: #ffffff;
            --text-secondary: #d1d5db;
            --text-tertiary: #9ca3af;
            --border-color: #374151;
            --success-color: #34d399;
            --error-color: #f87171;
            --success-bg: #064e3b;
            --error-bg: #7f1d1d;
            --button-bg: #10b981;
            --button-hover: #34d399;
            --shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 16px;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        .container {
          background: var(--bg-primary);
          padding: 40px 32px;
          border-radius: 16px;
          box-shadow: var(--shadow);
          max-width: 480px;
          width: 100%;
          text-align: center;
          border: 1px solid var(--border-color);
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }
        .icon-container {
          margin-bottom: 24px;
        }
        .checkmark {
          color: var(--success-color);
          font-size: 72px;
          line-height: 1;
          display: block;
        }
        .error-icon {
          color: var(--error-color);
          font-size: 72px;
          line-height: 1;
          display: block;
        }
        .title {
          color: var(--text-primary);
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 16px;
          line-height: 1.3;
          transition: color 0.3s ease;
        }
        .message {
          color: var(--text-secondary);
          font-size: 16px;
          margin-bottom: 20px;
          line-height: 1.6;
          transition: color 0.3s ease;
        }
        .help-text {
          color: var(--text-tertiary);
          font-size: 14px;
          margin-top: 16px;
          line-height: 1.5;
          transition: color 0.3s ease;
        }
        .status {
          color: var(--text-secondary);
          font-size: 14px;
          font-style: italic;
          margin-bottom: 16px;
          min-height: 20px;
          transition: color 0.3s ease;
        }
        .button {
          display: inline-block;
          background: var(--button-bg);
          color: white;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: background-color 0.2s ease, transform 0.1s ease;
          margin-top: 8px;
          border: none;
          cursor: pointer;
        }
        .button:hover {
          background: var(--button-hover);
          transform: translateY(-1px);
        }
        .button:active {
          transform: translateY(0);
        }
        .fallback-link {
          display: none;
        }
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid var(--border-color);
          border-radius: 50%;
          border-top-color: var(--success-color);
          animation: spin 0.8s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
          transition: border-color 0.3s ease;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 480px) {
          .container {
            padding: 32px 24px;
          }
          .title {
            font-size: 24px;
          }
          .checkmark, .error-icon {
            font-size: 64px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-container">
          ${isError ? `<div class="error-icon">⚠</div>` : `<div class="checkmark">✓</div>`}
        </div>
        <h1 class="title">${title}</h1>
        <p class="message">${message}</p>
        ${helpText ? `<p class="help-text">${helpText}</p>` : ''}
        ${!isError ? `
        <div class="status" id="status">
          <span class="spinner"></span>
          ${redirectingText}
        </div>
        <a href="${config.frontendUrl}" class="button fallback-link" id="fallback">${buttonText}</a>
        ` : `
        <a href="${config.frontendUrl}" class="button">${buttonText}</a>
        `}
      </div>
      ${!isError ? `
      <script>
        // Attempt deep link to mobile app first
        function attemptDeepLink() {
          const deepLink = 'bianca://email-verified';
          const webFallback = '${config.frontendUrl}';
          
          // Try to open mobile app
          window.location.href = deepLink;
          
          // If mobile app doesn't open in 3 seconds, show fallback
          setTimeout(() => {
            const statusEl = document.getElementById('status');
            const fallbackEl = document.getElementById('fallback');
            if (statusEl) {
              statusEl.innerHTML = 'App not installed? Click below to continue in browser.';
            }
            if (fallbackEl) {
              fallbackEl.style.display = 'inline-block';
            }
            
            // Auto-redirect to web after 5 seconds if user doesn't click
            setTimeout(() => {
              window.location.href = webFallback;
            }, 5000);
          }, 3000);
        }
        
        // Start the process
        attemptDeepLink();
      </script>
      ` : ''}
    </body>
    </html>
  `;
};

const verifyEmail = async (req, res, next) => {
  // Always set Content-Type to HTML before any response
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  // Validate token parameter (manual validation to avoid error middleware)
  const token = req.query.token || req.body.token;
  if (!token) {
    const errorHtml = generateVerificationPage(req, true, {
      errorMessage: 'Verification token is required',
      isExpired: false
    });
    return res.status(httpStatus.BAD_REQUEST).send(errorHtml);
  }
  
  try {
    const result = await authService.verifyEmail(token);
    
    // Generate localized and themed HTML page
    const html = generateVerificationPage(req, false, {
      isAlreadyVerified: result.alreadyVerified,
      message: result.message
    });
  
    res.status(httpStatus.OK).send(html);
  } catch (error) {
    // If verification failed, return a user-friendly error page
    // Don't pass to error middleware - we want to send HTML, not JSON
    const errorMessage = error.message || 'Email verification failed';
    const isExpired = error.message && (error.message.includes('expired') || error.message.includes('Invalid') || error.message.includes('Token not found'));
    
    // Generate localized and themed error HTML page
    const errorHtml = generateVerificationPage(req, true, {
      errorMessage,
      isExpired
    });
    
    res.status(httpStatus.UNAUTHORIZED).send(errorHtml);
  }
};

module.exports = {
  register,
  registerWithInvite,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmail,
  setPasswordForSSO,
};
