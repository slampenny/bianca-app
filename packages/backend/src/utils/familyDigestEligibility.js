const validator = require('validator');

const normalizeEmail = (value) => {
  if (value == null || String(value).trim() === '') {
    return '';
  }
  return String(value).trim().toLowerCase();
};

/**
 * @param {object|null|undefined} contactOrRecipient - object with optional familyDigestEmail
 * @returns {{ enabled: boolean, verifiedAt: Date|null, verifiedEmail: string|null }}
 */
const getFamilyDigestEmailSettings = (contactOrRecipient) => {
  const fd = contactOrRecipient?.familyDigestEmail;
  if (!fd || typeof fd !== 'object') {
    return { enabled: false, verifiedAt: null, verifiedEmail: null };
  }
  return {
    enabled: fd.enabled === true,
    verifiedAt: fd.verifiedAt ? new Date(fd.verifiedAt) : null,
    verifiedEmail: fd.verifiedEmail ? normalizeEmail(fd.verifiedEmail) : null,
  };
};

const resolveDigestSettingsForRecipient = (client, recipient) => {
  if (recipient?.familyDigestEmail != null) {
    return getFamilyDigestEmailSettings(recipient);
  }
  return getFamilyDigestEmailSettings(client?.emergencyContact);
};

/**
 * Build send eligibility for weekly family digest emails.
 * Preview always renders; send is blocked when ok is false.
 *
 * @param {object} client
 * @param {{ name?: string, relationship?: string, email?: string, familyDigestEmail?: object }} recipient
 */
const buildFamilyDigestEligibility = (client, recipient) => {
  const reasons = [];
  const warnings = [];
  const email = normalizeEmail(recipient?.email);
  const digestEmail = resolveDigestSettingsForRecipient(client, recipient);

  if (client?.consented === false) {
    reasons.push('Client consent is required before family communications.');
  }
  if (!email || !validator.isEmail(email)) {
    reasons.push('Add a valid family digest recipient email before sending this digest.');
  }
  if (!digestEmail.enabled) {
    reasons.push('Family weekly digest emails are not enabled for this recipient.');
  }
  if (digestEmail.enabled && !digestEmail.verifiedAt) {
    reasons.push('Family digest recipient email must be verified before emails can be sent.');
  }
  if (digestEmail.verifiedEmail && email && digestEmail.verifiedEmail !== email) {
    reasons.push('Verified email does not match the email on file. Re-verify before sending.');
  }
  if (!recipient?.name && !recipient?.relationship) {
    warnings.push('Add recipient name or relationship for a clearer greeting.');
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
  };
};

module.exports = {
  normalizeEmail,
  getFamilyDigestEmailSettings,
  buildFamilyDigestEligibility,
};
