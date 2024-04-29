const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { authService, caregiverService, inviteService, tokenService, emailService } = require('../services');

const register = catchAsync(async (req, res) => {
  const caregiver = await caregiverService.createCaregiver(req.body);
  const org = await orgService.createOrg({ caregiver }); // create an organization for the caregiver
  const tokens = await tokenService.generateAuthTokens(caregiver);
  res.status(httpStatus.CREATED).send({ caregiver, tokens });
});

const registerWithInvite = catchAsync(async (req, res) => {
  const { token, ...caregiverInfo } = req.body;
  const invite = await inviteService.verifyInviteToken(token);
  const caregiver = await caregiverService.createCaregiver({ ...caregiverInfo, org: invite.org });
  const tokens = await tokenService.generateAuthTokens(caregiver);
  res.status(httpStatus.CREATED).send({ caregiver, tokens });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const caregiver = await authService.loginCaregiverWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(caregiver);
  res.send({ caregiver, tokens });
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...tokens });
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
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.caregiver);
  await emailService.sendVerificationEmail(req.caregiver.email, verifyEmailToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
};
