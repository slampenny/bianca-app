const {
  resolveEmergencyContacts,
  resolveFamilyDigestRecipients,
  getEligibleFamilyDigestRecipients,
  buildAggregateFamilyDigestEligibility,
  findFamilyDigestRecipientById,
  personalizePayloadForRecipient,
} = require('../../../src/utils/clientContacts.util');

describe('clientContacts.util', () => {
  const legacyClient = () => ({
    consented: true,
    emergencyContact: {
      name: 'Sarah M.',
      relationship: 'daughter',
      phone: '+16045550100',
      email: 'family@test.com',
      familyDigestEmail: {
        enabled: true,
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        verifiedEmail: 'family@test.com',
      },
    },
  });

  const arrayClient = () => ({
    consented: true,
    emergencyContacts: [
      { _id: 'ec1', name: 'Bob', relationship: 'Son', phone: '+16045550101', email: 'bob@test.com' },
      { _id: 'ec2', name: 'Jane', relationship: 'Daughter', phone: '+16045550102', email: '' },
    ],
    familyDigestRecipients: [
      {
        _id: 'fd1',
        name: 'Sarah M.',
        relationship: 'daughter',
        email: 'family@test.com',
        familyDigestEmail: {
          enabled: true,
          verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
          verifiedEmail: 'family@test.com',
        },
      },
      {
        _id: 'fd2',
        name: 'Mike',
        relationship: 'son',
        email: 'mike@test.com',
        familyDigestEmail: { enabled: false, verifiedAt: null, verifiedEmail: null },
      },
    ],
  });

  it('resolveEmergencyContacts falls back to legacy emergencyContact', () => {
    const contacts = resolveEmergencyContacts(legacyClient());
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      name: 'Sarah M.',
      relationship: 'daughter',
      phone: '+16045550100',
      email: 'family@test.com',
    });
  });

  it('resolveEmergencyContacts prefers emergencyContacts array', () => {
    const contacts = resolveEmergencyContacts(arrayClient());
    expect(contacts).toHaveLength(2);
    expect(contacts[0].id).toBe('ec1');
    expect(contacts[1].name).toBe('Jane');
  });

  it('resolveFamilyDigestRecipients falls back to legacy emergencyContact digest settings', () => {
    const recipients = resolveFamilyDigestRecipients(legacyClient());
    expect(recipients).toHaveLength(1);
    expect(recipients[0].email).toBe('family@test.com');
    expect(recipients[0].familyDigestEmail.enabled).toBe(true);
  });

  it('resolveFamilyDigestRecipients uses familyDigestRecipients array', () => {
    const recipients = resolveFamilyDigestRecipients(arrayClient());
    expect(recipients).toHaveLength(2);
    expect(recipients[0].id).toBe('fd1');
    expect(recipients[1].email).toBe('mike@test.com');
  });

  it('findFamilyDigestRecipientById finds recipient in array', () => {
    const match = findFamilyDigestRecipientById(arrayClient(), 'fd2');
    expect(match).toMatchObject({ name: 'Mike', email: 'mike@test.com' });
  });

  it('getEligibleFamilyDigestRecipients returns only verified enabled recipients', () => {
    const eligible = getEligibleFamilyDigestRecipients(arrayClient());
    expect(eligible).toHaveLength(1);
    expect(eligible[0].email).toBe('family@test.com');
  });

  it('buildAggregateFamilyDigestEligibility is ok when at least one recipient is eligible', () => {
    const result = buildAggregateFamilyDigestEligibility(arrayClient());
    expect(result.ok).toBe(true);
    expect(result.recipients).toHaveLength(2);
  });

  it('buildAggregateFamilyDigestEligibility fails when no recipients exist', () => {
    const result = buildAggregateFamilyDigestEligibility({ consented: true });
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toMatch(/at least one family digest recipient/i);
  });

  it('personalizePayloadForRecipient updates subtitle line', () => {
    const payload = {
      subtitleParts: { recipientLine: 'For authorized contact on file', residentLine: 'Your loved one: Ada' },
    };
    const personalized = personalizePayloadForRecipient(payload, {
      name: 'Sarah M.',
      relationship: 'daughter',
      email: 'family@test.com',
    });
    expect(personalized.subtitleParts.recipientLine).toBe('For Sarah M. (daughter)');
  });
});
