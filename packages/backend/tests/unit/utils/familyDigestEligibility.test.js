const validator = require('validator');
const {
  buildFamilyDigestEligibility,
  getFamilyDigestEmailSettings,
  normalizeEmail,
} = require('../../../src/utils/familyDigestEligibility');

describe('familyDigestEligibility', () => {
  const baseClient = () => ({
    consented: true,
    emergencyContact: {
      name: 'Sarah M.',
      relationship: 'daughter',
      email: 'family@test.com',
      familyDigestEmail: {
        enabled: true,
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        verifiedEmail: 'family@test.com',
      },
    },
  });

  const recipient = () => ({
    name: 'Sarah M.',
    relationship: 'daughter',
    email: 'family@test.com',
  });

  it('allows send when consent, email, opt-in, and verification are valid', () => {
    const result = buildFamilyDigestEligibility(baseClient(), recipient());
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('blocks when emergency contact email is missing', () => {
    const client = baseClient();
    client.emergencyContact.email = '';
    const result = buildFamilyDigestEligibility(client, { ...recipient(), email: '' });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('valid emergency contact email'))).toBe(true);
  });

  it('blocks when emergency contact email is invalid', () => {
    const result = buildFamilyDigestEligibility(baseClient(), { ...recipient(), email: 'not-an-email' });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('valid emergency contact email'))).toBe(true);
  });

  it('blocks when client consented is false', () => {
    const client = baseClient();
    client.consented = false;
    const result = buildFamilyDigestEligibility(client, recipient());
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('consent'))).toBe(true);
  });

  it('blocks when family digest opt-in is false', () => {
    const client = baseClient();
    client.emergencyContact.familyDigestEmail.enabled = false;
    const result = buildFamilyDigestEligibility(client, recipient());
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('not enabled'))).toBe(true);
  });

  it('blocks when opt-in is true but email is not verified', () => {
    const client = baseClient();
    client.emergencyContact.familyDigestEmail.verifiedAt = null;
    const result = buildFamilyDigestEligibility(client, recipient());
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('verified'))).toBe(true);
  });

  it('blocks when verifiedEmail does not match current emergency contact email', () => {
    const client = baseClient();
    client.emergencyContact.familyDigestEmail.verifiedEmail = 'old@test.com';
    const result = buildFamilyDigestEligibility(client, recipient());
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('does not match'))).toBe(true);
  });

  it('getFamilyDigestEmailSettings defaults to disabled when absent', () => {
    expect(getFamilyDigestEmailSettings(null)).toEqual({
      enabled: false,
      verifiedAt: null,
      verifiedEmail: null,
    });
  });

  it('normalizeEmail lowercases and trims', () => {
    expect(normalizeEmail('  Family@Test.COM ')).toBe('family@test.com');
    expect(normalizeEmail('')).toBe('');
  });
});

describe('familyDigestEligibility migration defaults', () => {
  it('treats missing familyDigestEmail as opt-in false', () => {
    const client = { consented: true, emergencyContact: { email: 'family@test.com' } };
    const result = buildFamilyDigestEligibility(client, {
      name: 'Sarah',
      relationship: 'daughter',
      email: 'family@test.com',
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('not enabled'))).toBe(true);
  });
});
