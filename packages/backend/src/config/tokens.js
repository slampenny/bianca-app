const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_PASSWORD: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
  INVITE: 'invite',
  CLIENT_CONSENT: 'patientConsent', // DB value kept for backward compat
};

module.exports = {
  tokenTypes,
};
