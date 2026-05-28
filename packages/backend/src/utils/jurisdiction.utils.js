/**
 * Jurisdiction Utilities
 *
 * Determines applicable privacy regulations based on organization country.
 * Supports HIPAA (US), PIPEDA (Canada), GDPR (EU), and OTHER fallbacks.
 */

/** EU member states (ISO 3166-1 alpha-2) — map to GDPR jurisdiction */
const EU_COUNTRY_CODES = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

const GDPR_COUNTRIES = new Set(EU_COUNTRY_CODES);

const GDPR_DATA_RETENTION = {
  conversations: { years: 3, autoDelete: true },
  callRecordings: { years: 1, autoDelete: true },
  calls: { years: 1, autoDelete: true },
  medicalAnalysis: { years: 3, autoDelete: true },
  clientMemory: { years: 3, autoDelete: true },
  auditLog: { years: 3, autoDelete: true },
  patientData: { years: 3, autoDelete: true },
  consentRecords: { years: 3, autoDelete: true },
};

const GDPR_JURISDICTION_BASE = {
  jurisdiction: 'GDPR',
  regulations: ['GDPR'],
  breachNotificationDays: 72,
  breachNotificationRequirement: 'within_72_hours',
  regulator: null,
  regulatorName: null,
  regulatorContact: null,
  complaintEndpoint: 'INTERNAL',
  dataRetention: GDPR_DATA_RETENTION,
};

function buildGdprJurisdiction(country) {
  return {
    ...GDPR_JURISDICTION_BASE,
    country: country || null,
  };
}

function isGdprCountry(country) {
  return country && GDPR_COUNTRIES.has(country.toUpperCase());
}

/**
 * Resolve organization country from an authenticated request (caregiver with populated org).
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getOrgCountryFromRequest(req) {
  const country = req?.caregiver?.org?.country;
  return country ? country.toUpperCase() : null;
}

/**
 * Get jurisdiction from country code
 * @param {string|null|undefined} country - ISO 3166-1 alpha-2 country code
 * @returns {Object} - Jurisdiction information
 */
function getJurisdiction(country) {
  if (!country) {
    return buildGdprJurisdiction(null);
  }

  const countryUpper = country.toUpperCase();

  if (countryUpper === 'US') {
    return {
      country: 'US',
      jurisdiction: 'HIPAA',
      regulations: ['HIPAA'],
      breachNotificationDays: 60,
      breachNotificationRequirement: 'within_60_days',
      regulator: 'HHS',
      regulatorName: 'U.S. Department of Health and Human Services',
      regulatorContact: 'https://www.hhs.gov/hipaa/filing-a-complaint',
      complaintEndpoint: 'HHS',
      dataRetention: {
        patientData: { years: 7, autoDelete: false },
        callRecordings: { years: 7, autoDelete: false },
        conversations: { years: 7, autoDelete: false },
        medicalAnalysis: { years: 7, autoDelete: false },
        consentRecords: { years: 7, autoDelete: false },
        clientMemory: { years: 7, autoDelete: false },
        auditLog: { years: 7, autoDelete: false },
      },
    };
  }

  if (countryUpper === 'CA') {
    return {
      country: 'CA',
      jurisdiction: 'PIPEDA',
      regulations: ['PIPEDA'],
      breachNotificationDays: null,
      breachNotificationRequirement: 'as_soon_as_feasible',
      regulator: 'OPC',
      regulatorName: 'Office of the Privacy Commissioner of Canada',
      regulatorContact: 'https://www.priv.gc.ca/en/report-a-concern/',
      complaintEndpoint: 'PrivacyCommissioner',
      dataRetention: {
        patientData: { years: 7, autoDelete: true },
        callRecordings: { years: 2, autoDelete: true },
        conversations: { years: 5, autoDelete: true },
        medicalAnalysis: { years: 7, autoDelete: true },
        consentRecords: { years: 7, autoDelete: true },
        clientMemory: { years: 5, autoDelete: true },
        auditLog: { years: 7, autoDelete: true },
      },
    };
  }

  if (GDPR_COUNTRIES.has(countryUpper)) {
    return buildGdprJurisdiction(countryUpper);
  }

  return {
    country: countryUpper,
    jurisdiction: 'OTHER',
    regulations: ['GENERAL'],
    breachNotificationDays: null,
    breachNotificationRequirement: 'as_soon_as_feasible',
    regulator: null,
    regulatorName: null,
    regulatorContact: null,
    complaintEndpoint: 'INTERNAL',
    dataRetention: {
      ...GDPR_DATA_RETENTION,
    },
  };
}

/**
 * Check if organization requires HIPAA compliance
 * @param {string} country - ISO 3166-1 alpha-2 country code
 * @returns {boolean}
 */
function requiresHIPAA(country) {
  return getJurisdiction(country).jurisdiction === 'HIPAA';
}

/**
 * Check if organization requires PIPEDA compliance
 * @param {string} country - ISO 3166-1 alpha-2 country code
 * @returns {boolean}
 */
function requiresPIPEDA(country) {
  return getJurisdiction(country).jurisdiction === 'PIPEDA';
}

/**
 * Check if organization requires GDPR compliance
 * @param {string} country - ISO 3166-1 alpha-2 country code
 * @returns {boolean}
 */
function requiresGDPR(country) {
  const { jurisdiction } = getJurisdiction(country);
  return jurisdiction === 'GDPR';
}

/**
 * Get breach notification deadline based on jurisdiction
 * @param {string} country - ISO 3166-1 alpha-2 country code
 * @param {Date} breachDate - Date breach was detected
 * @returns {Date|null} - Deadline date, or null if "as soon as feasible"
 */
function getBreachNotificationDeadline(country, breachDate = new Date()) {
  const jurisdiction = getJurisdiction(country);

  if (jurisdiction.breachNotificationDays) {
    return new Date(breachDate.getTime() + jurisdiction.breachNotificationDays * 24 * 60 * 60 * 1000);
  }

  return null;
}

/**
 * Get appropriate privacy policy type for server-side policy routing
 * @param {string|null|undefined} country - ISO 3166-1 alpha-2 country code
 * @returns {string} - 'HIPAA', 'PIPEDA', 'GDPR', or 'GENERAL'
 */
function getPrivacyPolicyType(country) {
  const { jurisdiction } = getJurisdiction(country);

  if (jurisdiction === 'HIPAA') {
    return 'HIPAA';
  }

  if (jurisdiction === 'PIPEDA') {
    return 'PIPEDA';
  }

  if (jurisdiction === 'GDPR') {
    return 'GDPR';
  }

  return 'GENERAL';
}

/**
 * Get data retention period for a specific data type based on jurisdiction
 * @param {string|null|undefined} country - ISO 3166-1 alpha-2 country code
 * @param {string} dataType - e.g. callRecordings, conversations, medicalAnalysis, clientMemory, auditLog
 * @returns {Object} - Retention period in years and whether to auto-delete
 */
function getDataRetentionPeriod(country, dataType) {
  const jurisdiction = getJurisdiction(country);
  const retention = jurisdiction.dataRetention?.[dataType];
  if (retention) {
    return retention;
  }
  if (jurisdiction.jurisdiction === 'GDPR') {
    return { years: 3, autoDelete: true };
  }
  if (jurisdiction.jurisdiction === 'HIPAA') {
    return { years: 7, autoDelete: false };
  }
  return { years: 7, autoDelete: true };
}

/**
 * Check if data should be auto-deleted after retention period for this jurisdiction
 * @param {string|null|undefined} country - ISO 3166-1 alpha-2 country code
 * @returns {boolean}
 */
function shouldAutoDeleteData(country) {
  const jurisdiction = getJurisdiction(country);
  return jurisdiction.jurisdiction !== 'HIPAA';
}

/** Initial response deadline in days (GDPR Art. 12, PIPEDA s.8). */
function getPrivacyResponseDeadlineDays(jurisdictionKey) {
  return 30;
}

/** Maximum extension days with notice (GDPR: +60 days; PIPEDA: +30 days). */
function getPrivacyExtensionDays(jurisdictionKey) {
  if (jurisdictionKey === 'GDPR') {
    return 60;
  }
  return 30;
}

function computePrivacyResponseDeadline(requestDate, jurisdictionKey) {
  const deadline = new Date(requestDate);
  deadline.setDate(deadline.getDate() + getPrivacyResponseDeadlineDays(jurisdictionKey));
  return deadline;
}

function allowsErasureRequest(jurisdictionKey) {
  return jurisdictionKey !== 'HIPAA';
}

function getErasureDenialLegalBasis(jurisdictionKey) {
  if (jurisdictionKey === 'HIPAA') {
    return 'HIPAA §164.316(b)(2)(i) requires retention of medical records for a minimum of 6 years. '
      + 'Erasure is not permitted while the legal retention obligation applies.';
  }
  return 'Legal obligation to retain data for compliance purposes.';
}

module.exports = {
  EU_COUNTRY_CODES,
  GDPR_COUNTRIES,
  getJurisdiction,
  getOrgCountryFromRequest,
  isGdprCountry,
  requiresHIPAA,
  requiresPIPEDA,
  requiresGDPR,
  getBreachNotificationDeadline,
  getPrivacyPolicyType,
  getDataRetentionPeriod,
  shouldAutoDeleteData,
  getPrivacyResponseDeadlineDays,
  getPrivacyExtensionDays,
  computePrivacyResponseDeadline,
  allowsErasureRequest,
  getErasureDenialLegalBasis,
};
