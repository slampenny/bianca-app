const validator = require('validator');

const normalizeEmail = (value) => {
  if (value == null || String(value).trim() === '') {
    return '';
  }
  return String(value).trim().toLowerCase();
};

/**
 * @param {object|null|undefined} emergencyContact
 * @returns {{ enabled: boolean, verifiedAt: Date|null, verifiedEmail: string|null }}
 */
const getFamilyDigestEmailSettings = (emergencyContact) => {
  const fd = emergencyContact?.familyDigestEmail;
  if (!fd || typeof fd !== 'object') {
    return { enabled: false, verifiedAt: null, verifiedEmail: null };
  }
  return {
    enabled: fd.enabled === true,
    verifiedAt: fd.verifiedAt ? new Date(fd.verifiedAt) : null,
    verifiedEmail: fd.verifiedEmail ? normalizeEmail(fd.verifiedEmail) : null,
  };
};

/**
 * Build send eligibility for weekly family digest emails.
 * Preview always renders; send is blocked when ok is false.
 *
 * @param {object} client
 * @param {{ name?: string, relationship?: string, email?: string }} recipient
 */
const buildFamilyDigestEligibility = (client, recipient) => {
  const reasons = [];
  const warnings = [];
  const email = normalizeEmail(recipient?.email);
  const digestEmail = getFamilyDigestEmailSettings(client?.emergencyContact);

  if (client?.consented === false) {
    reasons.push('Client consent is required before family communications.');
  }
  if (!email || !validator.isEmail(email)) {
    reasons.push('Add a valid emergency contact email before sending this digest.');
  }
  if (!digestEmail.enabled) {
    reasons.push('Family weekly digest emails are not enabled for this emergency contact.');
  }
  if (digestEmail.enabled && !digestEmail.verifiedAt) {
    reasons.push('Emergency contact email must be verified before family digest emails can be sent.');
  }
  if (digestEmail.verifiedEmail && email && digestEmail.verifiedEmail !== email) {
    reasons.push(
      'Verified emergency contact email does not match the email on file. Re-verify before sending.'
    );
  }
  if (!recipient?.name && !recipient?.relationship) {
    warnings.push('Add emergency contact name or relationship for a clearer greeting.');
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
