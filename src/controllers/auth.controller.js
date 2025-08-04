const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');
const { authService, caregiverService, orgService, tokenService, emailService, alertService } = require('../services');
const { AlertDTO, CaregiverDTO, OrgDTO, PatientDTO } = require('../dtos');

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
    }
  );

  const caregiver = org.caregivers[0];
  const tokens = await tokenService.generateAuthTokens(caregiver);
  
  // Send verification email automatically after registration
  try {
    const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
    await emailService.sendVerificationEmail(caregiver.email, verifyEmailToken);
  } catch (emailError) {
    // Log the error but don't fail the registration
    console.error('Failed to send verification email during registration:', emailError);
  }
  
  res.status(httpStatus.CREATED).send({ org, caregiver: CaregiverDTO(caregiver), tokens });
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
  const { email, password } = req.body;
  const { caregiver, patients } = await authService.loginCaregiverWithEmailAndPassword(email, password);

  const alerts = await alertService.getAlerts(caregiver.id);
  const alertDTOs = alerts.map((alert) => AlertDTO(alert));
  const patientDTOs = patients.map((patient) => PatientDTO(patient));
  const caregiverDTO = CaregiverDTO(caregiver);
  const tokens = await tokenService.generateAuthTokens(caregiver);
  res.send({ org: OrgDTO(caregiver.org), caregiver: caregiverDTO, patients: patientDTOs, alerts: alertDTOs, tokens });
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
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
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          text-align: center;
        }
        .container {
          background: white;
          color: #333;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          max-width: 400px;
          width: 90%;
        }
        .checkmark {
          color: #27ae60;
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #2c3e50;
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }
        p {
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }
        .loading {
          margin: 1rem 0;
          color: #7f8c8d;
        }
        .fallback-link {
          display: inline-block;
          background: #3498db;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 1rem;
          transition: background 0.3s;
        }
        .fallback-link:hover {
          background: #2980b9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="checkmark">✓</div>
        <h1>Email Verified Successfully!</h1>
        <p>Your My Phone Friend account is now verified.</p>
        <div class="loading" id="status">Opening app...</div>
        <a href="${config.frontendUrl}" class="fallback-link" id="fallback">Continue to App</a>
      </div>
      
      <script>
        // Attempt deep link to mobile app first
        function attemptDeepLink() {
          const deepLink = 'bianca://email-verified';
          const webFallback = '${config.frontendUrl}';
          
          // Try to open mobile app
          window.location.href = deepLink;
          
          // If mobile app doesn't open in 2 seconds, redirect to web
          setTimeout(() => {
            document.getElementById('status').textContent = 'App not installed? Click below to continue in browser.';
            document.getElementById('fallback').style.display = 'inline-block';
            
            // Auto-redirect to web after 5 seconds if user doesn't click
            setTimeout(() => {
              window.location.href = webFallback;
            }, 5000);
          }, 2000);
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
  verifyEmail,
};
