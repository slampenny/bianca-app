const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_PASSWORD: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
  INVITE: 'invite',
  /** Completes registration as superAdmin (Bianca console), not facility staff */
  SUPERADMIN_INVITE: 'superAdminInvite',
  CLIENT_CONSENT: 'clientConsent',
  /** Public link for emergency contact to verify weekly family digest email */
  FAMILY_DIGEST_EMAIL_VERIFY: 'familyDigestEmailVerify',
};

module.exports = {
  tokenTypes,
};
