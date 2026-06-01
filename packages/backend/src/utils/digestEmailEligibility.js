const validator = require('validator');

/**
 * Whether a caregiver may receive Daily Wellness Digest email.
 *
 * Automated scheduler sends require notificationPreferences.dailyDigestEmail === true.
 * Manual UI sends do not require this preference (requireNotificationEnabled: false).
 *
 * @param {object|null|undefined} caregiver
 * @param {{ requireNotificationEnabled?: boolean }} [options]
 * @returns {{ ok: boolean, reasons: string[] }}
 */
const canReceiveDigestEmail = (caregiver, options = {}) => {
  const reasons = [];
  const requireNotificationEnabled = Boolean(options.requireNotificationEnabled);

  if (!caregiver) {
    return { ok: false, reasons: ['Caregiver not found'] };
  }

  const email = caregiver.email ? String(caregiver.email).trim() : '';
  if (!email || !validator.isEmail(email)) {
    reasons.push('A verified email is required on your profile to send this digest');
  } else if (caregiver.isEmailVerified !== true) {
    reasons.push('A verified email is required on your profile to send this digest');
  }

  if (Object.prototype.hasOwnProperty.call(caregiver, 'active') && caregiver.active !== true) {
    reasons.push('Caregiver account must be active to receive digest email');
  }

  if (requireNotificationEnabled) {
    const prefs = caregiver.notificationPreferences;
    if (!prefs || typeof prefs !== 'object' || prefs.dailyDigestEmail !== true) {
      reasons.push('Daily digest email notifications are not enabled');
    }
  }

  return { ok: reasons.length === 0, reasons };
};

module.exports = {
  canReceiveDigestEmail,
};
