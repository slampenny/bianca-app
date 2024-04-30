const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { authService, caregiverService, inviteService, orgService, tokenService, emailService } = require('../services');

const register = catchAsync(async (req, res, next) => {
  try {
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
    res.status(httpStatus.CREATED).send({ org, tokens });
  } catch (error) {
    next(error);
  }
});

const registerWithInvite = catchAsync(async (req, res) => {
  try {
    const { token, ...caregiverInfo } = req.body;
    const invite = await inviteService.verifyInviteToken(token);
    const caregiver = await caregiverService.createCaregiver({ ...caregiverInfo, org: invite.org });
    const tokens = await tokenService.generateAuthTokens(caregiver);
    res.status(httpStatus.CREATED).send({ caregiver, tokens });
  } catch (error) {
    next(error);
  }
});

const login = catchAsync(async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const caregiver = await authService.loginCaregiverWithEmailAndPassword(email, password);
    const tokens = await tokenService.generateAuthTokens(caregiver);
    res.send({ caregiver, tokens });
  } catch (error) {
    next(error);
  }
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
  registerWithInvite,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
};
