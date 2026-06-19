const Joi = require('joi');
const { updateClient } = require('../../../src/validations/client.validation');

describe('client.validation updateClient', () => {
  const validateUpdate = (body) =>
    Joi.compile(updateClient.body).prefs({ abortEarly: false }).validate(body);

  it('accepts emergencyContacts and familyDigestRecipients on PATCH', () => {
    const { error, value } = validateUpdate({
      emergencyContacts: [
        { name: 'Bob', relationship: 'Son', phone: '+16045550101', email: 'bob@test.com' },
      ],
      familyDigestRecipients: [
        {
          name: 'Sarah',
          relationship: 'daughter',
          email: 'family@test.com',
          familyDigestEmail: { enabled: true },
        },
      ],
    });

    expect(error).toBeUndefined();
    expect(value.emergencyContacts).toHaveLength(1);
    expect(value.familyDigestRecipients[0].familyDigestEmail.enabled).toBe(true);
  });

  it('rejects unknown top-level fields', () => {
    const { error } = validateUpdate({
      emergencyContacts: [],
      unknownField: true,
    });

    expect(error).toBeDefined();
    expect(error.details.some((d) => d.message.includes('unknownField'))).toBe(true);
  });
});
