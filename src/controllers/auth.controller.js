const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');
const { authService, caregiverService, orgService, tokenService, emailService, alertService, mfaService } = require('../services');
const { AlertDTO, CaregiverDTO, OrgDTO, PatientDTO } = require('../dtos');
const { auditAuthFailure } = require('../middlewares/auditLog');
const { AuditLog } = require('../models');

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
    await emailService.sendVerificationEmail(caregiver.email, verifyEmailToken);
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
  const { token, ...caregiverInfo } = req.body;
  const invite = await tokenService.verifyToken(token);
  const caregiver = await caregiverService.createCaregiver({ ...caregiverInfo, org: invite.cargiver.org });
  const caregiverDTO = CaregiverDTO(caregiver);
  const tokens = await tokenService.generateAuthTokens(caregiver);
  res.status(httpStatus.CREATED).send({ caregiver: caregiverDTO, tokens });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password, mfaToken } = req.body;
  
  try {
    // Step 1: Validate credentials
    const { caregiver, patients } = await authService.loginCaregiverWithEmailAndPassword(email, password);

    // Check if account is locked
    if (caregiver.accountLocked) {
      throw new Error(`Account is locked: ${caregiver.lockedReason || 'Contact support for assistance'}`);
    }

    // Step 1.5: Check email verification status
    if (!caregiver.isEmailVerified) {
      // Send verification email if not already sent recently
      try {
        const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
        await emailService.sendVerificationEmail(caregiver.email, verifyEmailToken);
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
    
    res.send({ org: OrgDTO(caregiver.org), caregiver: caregiverDTO, patients: patientDTOs, alerts: alertDTOs, tokens });
  } catch (error) {
    // HIPAA Compliance: Log failed authentication attempts
    await auditAuthFailure(
      email,
      req.ip || req.connection.remoteAddress,
      req.get('user-agent'),
      error.message
    );
    throw error; // Re-throw to be handled by error middleware
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
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.query.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

const sendVerificationEmail = catchAsync(async (req, res) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.body.caregiver);
  await emailService.sendVerificationEmail(req.body.caregiver.email, verifyEmailToken);
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
    await emailService.sendVerificationEmail(caregiver.email, verifyEmailToken);
    res.status(httpStatus.OK).send({ message: 'Verification email sent successfully' });
  } catch (emailError) {
    console.error('Failed to resend verification email:', emailError);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send verification email');
  }
});

const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token);
  
  // Return HTML page that handles both mobile deep linking and web redirect
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verified - My Phone Friend</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f8f9fa;
          color: #1a1a1a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 16px;
        }
        .container {
          background: white;
          padding: 32px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          max-width: 320px;
          width: 100%;
          text-align: center;
          border: 1px solid #e5e5e5;
        }
        .checkmark {
          color: #10B981;
          font-size: 60px;
          margin-bottom: 16px;
          display: block;
        }
        .title {
          color: #1a1a1a;
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 16px;
          line-height: 1.2;
        }
        .message {
          color: #6b7280;
          font-size: 16px;
          margin-bottom: 24px;
          line-height: 1.5;
        }
        .status {
          color: #6b7280;
          font-size: 14px;
          font-style: italic;
          margin-bottom: 16px;
        }
        .fallback-link {
          display: inline-block;
          background: #10B981;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          font-size: 16px;
          transition: background 0.2s;
          display: none;
        }
        .fallback-link:hover {
          background: #059669;
        }
        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid #e5e5e5;
          border-radius: 50%;
          border-top-color: #10B981;
          animation: spin 1s ease-in-out infinite;
          margin-right: 8px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="checkmark">✓</div>
        <h1 class="title">Email Verified!</h1>
        <p class="message">Your My Phone Friend account has been successfully verified.</p>
        <div class="status" id="status">
          <span class="spinner"></span>
          Redirecting you to the app...
        </div>
        <a href="${config.frontendUrl}" class="fallback-link" id="fallback">Continue to App</a>
      </div>
      
      <script>
        // Attempt deep link to mobile app first
        function attemptDeepLink() {
          const deepLink = 'bianca://email-verified';
          const webFallback = '${config.frontendUrl}';
          
          // Try to open mobile app
          window.location.href = deepLink;
          
          // If mobile app doesn't open in 3 seconds, show fallback
          setTimeout(() => {
            document.getElementById('status').innerHTML = 'App not installed? Click below to continue in browser.';
            document.getElementById('fallback').style.display = 'inline-block';
            
            // Auto-redirect to web after 5 seconds if user doesn't click
            setTimeout(() => {
              window.location.href = webFallback;
            }, 5000);
          }, 3000);
        }
        
        // Start the process
        attemptDeepLink();
      </script>
    </body>
    </html>
  `;
  
  res.status(httpStatus.OK).send(html);
});

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
};
