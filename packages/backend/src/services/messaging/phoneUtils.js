/**
 * Shared E.164-style helpers for SMS providers (Twilio, SNS, etc.)
 */

function formatPhoneNumber(phone) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (phone.startsWith('+') && digits.length >= 10) {
    return phone;
  }

  return null;
}

function isValidPhoneNumber(phone) {
  if (!phone) return false;
  const formatted = formatPhoneNumber(phone);
  if (!formatted) return false;
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  return phoneRegex.test(formatted);
}

function maskPhoneNumber(phone) {
  if (!phone) return '';

  const formatted = formatPhoneNumber(phone);
  if (!formatted) return phone;

  const match = formatted.match(/^(\+\d{1,2})(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `${match[1]} (${match[2]}) ***-${match[4]}`;
  }

  return formatted;
}

function extractPhoneNumbers(caregivers) {
  const phoneNumbers = new Set();

  caregivers.forEach((caregiver) => {
    if (caregiver.phone) {
      const formattedPhone = formatPhoneNumber(caregiver.phone);
      if (formattedPhone && isValidPhoneNumber(formattedPhone)) {
        phoneNumbers.add(formattedPhone);
      }
    }
  });

  return Array.from(phoneNumbers);
}

module.exports = {
  formatPhoneNumber,
  isValidPhoneNumber,
  maskPhoneNumber,
  extractPhoneNumbers,
};
