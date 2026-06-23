const SMS_ELIGIBLE_ROLES = new Set(['staff', 'orgAdmin', 'superAdmin']);

const isOrgFamilyMode = (caregiver) => Boolean(caregiver && caregiver.role === 'family');

const isSmsEligibleRole = (role) => SMS_ELIGIBLE_ROLES.has(role);

const accountModeForRole = (role) => (role === 'family' ? 'orgFamily' : 'b2c');

module.exports = {
  SMS_ELIGIBLE_ROLES,
  isOrgFamilyMode,
  isSmsEligibleRole,
  accountModeForRole,
};
