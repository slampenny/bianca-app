/** GDPR client/resident consent purposes — all must be granted for `consented` virtual to be true. */
const REQUIRED_CLIENT_CONSENT_PURPOSES = ['recording', 'transcription', 'aiAnalysis', 'familyReports'];

const CLIENT_CONSENT_VERSION = '2.0';

const PURPOSE_LABELS = {
  recording: 'Call recording',
  transcription: 'Call transcription',
  aiAnalysis: 'AI analysis of call content',
  familyReports: 'Family wellness reports',
};

const PURPOSE_DESCRIPTIONS = {
  recording:
    'Record wellness check calls for quality assurance and care coordination. Calls can still occur without recording if you decline.',
  transcription:
    'Convert call audio into text so caregivers can review conversations and provide better support.',
  aiAnalysis:
    'Use AI to analyze call content and generate wellness insights for your care team.',
  familyReports:
    'Share weekly call summaries with an authorized emergency contact or family member you designate.',
};

const defaultConsentedPurposes = () =>
  REQUIRED_CLIENT_CONSENT_PURPOSES.reduce((acc, purpose) => {
    acc[purpose] = false;
    return acc;
  }, {});

const normalizePurposes = (purposes) => {
  if (!Array.isArray(purposes)) return [];
  const allowed = new Set(REQUIRED_CLIENT_CONSENT_PURPOSES);
  return [...new Set(purposes.filter((p) => allowed.has(p)))];
};

const isFullyConsented = (consentedPurposes) => {
  if (!consentedPurposes) return false;
  return REQUIRED_CLIENT_CONSENT_PURPOSES.every((purpose) => consentedPurposes[purpose] === true);
};

const hasPurposeConsent = (consentedPurposes, purpose) => consentedPurposes?.[purpose] === true;

module.exports = {
  REQUIRED_CLIENT_CONSENT_PURPOSES,
  CLIENT_CONSENT_VERSION,
  PURPOSE_LABELS,
  PURPOSE_DESCRIPTIONS,
  defaultConsentedPurposes,
  normalizePurposes,
  isFullyConsented,
  hasPurposeConsent,
};
