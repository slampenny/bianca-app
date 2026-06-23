const {
  SMS_ELIGIBLE_ROLES,
  isOrgFamilyMode,
  isSmsEligibleRole,
  accountModeForRole,
} = require('../../../src/utils/familyAccess.util');

describe('familyAccess.util', () => {
  it('isSmsEligibleRole includes staff and org admins but not family', () => {
    expect(isSmsEligibleRole('staff')).toBe(true);
    expect(isSmsEligibleRole('orgAdmin')).toBe(true);
    expect(isSmsEligibleRole('superAdmin')).toBe(true);
    expect(isSmsEligibleRole('family')).toBe(false);
    expect(isSmsEligibleRole('invited')).toBe(false);
    expect(SMS_ELIGIBLE_ROLES.has('family')).toBe(false);
  });

  it('isOrgFamilyMode is true only for family role', () => {
    expect(isOrgFamilyMode({ role: 'family' })).toBe(true);
    expect(isOrgFamilyMode({ role: 'orgAdmin' })).toBe(false);
    expect(isOrgFamilyMode(null)).toBe(false);
  });

  it('accountModeForRole maps family to orgFamily and others to b2c', () => {
    expect(accountModeForRole('family')).toBe('orgFamily');
    expect(accountModeForRole('orgAdmin')).toBe('b2c');
    expect(accountModeForRole('staff')).toBe('b2c');
  });
});
