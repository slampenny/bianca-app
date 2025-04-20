const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
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

  const tokens = await tokenService.generateAuthTokens(org.caregivers[0]);
  res.status(httpStatus.CREATED).send({ org, caregiver: CaregiverDTO(org.caregivers[0]), tokens });
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
  res.status(httpStatus.NO_CONTENT).send();
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
