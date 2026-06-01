const { canReceiveDigestEmail } = require('../../../src/utils/digestEmailEligibility');

const baseCaregiver = {
  email: 'staff@test.com',
  isEmailVerified: true,
  active: true,
};

describe('canReceiveDigestEmail', () => {
  it('allows a verified active caregiver with valid email', () => {
    expect(canReceiveDigestEmail(baseCaregiver)).toEqual({ ok: true, reasons: [] });
  });

  it('blocks an unverified caregiver', () => {
    const result = canReceiveDigestEmail({ ...baseCaregiver, isEmailVerified: false });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('A verified email is required on your profile to send this digest');
  });

  it('blocks an inactive caregiver', () => {
    const result = canReceiveDigestEmail({ ...baseCaregiver, active: false });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('Caregiver account must be active to receive digest email');
  });

  it('blocks an invalid email', () => {
    const result = canReceiveDigestEmail({ ...baseCaregiver, email: 'not-an-email' });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('A verified email is required on your profile to send this digest');
  });

  it('blocks a missing email', () => {
    const result = canReceiveDigestEmail({ ...baseCaregiver, email: '' });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('A verified email is required on your profile to send this digest');
  });

  it('blocks automated send when notification preference is not enabled', () => {
    const result = canReceiveDigestEmail(baseCaregiver, { requireNotificationEnabled: true });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('Daily digest email notifications are not enabled');
  });

  it('blocks automated send when dailyDigestEmail is explicitly false', () => {
    const result = canReceiveDigestEmail(
      {
        ...baseCaregiver,
        notificationPreferences: { dailyDigestEmail: false },
      },
      { requireNotificationEnabled: true }
    );
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('Daily digest email notifications are not enabled');
  });

  it('allows automated send when dailyDigestEmail preference is enabled', () => {
    const result = canReceiveDigestEmail(
      {
        ...baseCaregiver,
        notificationPreferences: { dailyDigestEmail: true },
      },
      { requireNotificationEnabled: true }
    );
    expect(result).toEqual({ ok: true, reasons: [] });
  });

  it('does not require notification preference for manual send', () => {
    expect(canReceiveDigestEmail(baseCaregiver)).toEqual({ ok: true, reasons: [] });
  });
});
