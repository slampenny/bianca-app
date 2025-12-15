/**
 * Jurisdiction Utilities
 * 
 * Determines applicable privacy regulations based on organization country
 * Supports dual compliance: HIPAA (US) and PIPEDA (Canada)
 */

const logger = require('../config/logger');

/**
 * Get jurisdiction from country code
 * @param {string} country - ISO 3166-1 alpha-2 country code
 * @returns {Object} - Jurisdiction information
 */
function getJurisdiction(country) {
  if (!country) {
    // Default to US if country not specified
    return {
      country: 'US',
      jurisdiction: 'HIPAA',
      regulations: ['HIPAA'],
      breachNotificationDays: 60,
      breachNotificationRequirement: 'within_60_days',
      regulator: 'HHS',
      regulatorName: 'U.S. Department of Health and Human Services',
      regulatorContact: 'https://www.hhs.gov/hipaa/filing-a-complaint',
      complaintEndpoint: 'HHS'
    };
  }

  const countryUpper = country.toUpperCase();

  // HIPAA jurisdiction (United States)
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
      complaintEndpoint: 'HHS'
    };
  }

  // PIPEDA jurisdiction (Canada)
  if (countryUpper === 'CA') {
    return {
      country: 'CA',
      jurisdiction: 'PIPEDA',
      regulations: ['PIPEDA'],
      breachNotificationDays: null, // "As soon as feasible" - no fixed days
      breachNotificationRequirement: 'as_soon_as_feasible',
      regulator: 'OPC',
      regulatorName: 'Office of the Privacy Commissioner of Canada',
      regulatorContact: 'https://www.priv.gc.ca/en/report-a-concern/',
      complaintEndpoint: 'PrivacyCommissioner'
    };
  }

  // Other countries - default to most stringent (PIPEDA-like)
  // This is a conservative approach
  return {
    country: countryUpper,
    jurisdiction: 'OTHER',
    regulations: ['GENERAL'],
    breachNotificationDays: null, // Use "as soon as feasible" for safety
    breachNotificationRequirement: 'as_soon_as_feasible',
    regulator: null,
    regulatorName: null,
    regulatorContact: null,
    complaintEndpoint: 'INTERNAL'
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
 * Get breach notification deadline based on jurisdiction
 * @param {string} country - ISO 3166-1 alpha-2 country code
 * @param {Date} breachDate - Date breach was detected
 * @returns {Date|null} - Deadline date, or null if "as soon as feasible"
 */
function getBreachNotificationDeadline(country, breachDate = new Date()) {
  const jurisdiction = getJurisdiction(country);
  
  if (jurisdiction.breachNotificationDays) {
    // Fixed deadline (e.g., HIPAA: 60 days)
    return new Date(breachDate.getTime() + jurisdiction.breachNotificationDays * 24 * 60 * 60 * 1000);
  }
  
  // "As soon as feasible" - return null to indicate urgency
  return null;
}

/**
 * Get appropriate privacy policy type for jurisdiction
 * @param {string} country - ISO 3166-1 alpha-2 country code
 * @returns {string} - 'HIPAA', 'PIPEDA', or 'GENERAL'
 */
function getPrivacyPolicyType(country) {
  const jurisdiction = getJurisdiction(country);
  
  if (jurisdiction.jurisdiction === 'HIPAA') {
    return 'HIPAA';
  }
  
  if (jurisdiction.jurisdiction === 'PIPEDA') {
    return 'PIPEDA';
  }
  
  return 'GENERAL';
}

module.exports = {
  getJurisdiction,
  requiresHIPAA,
  requiresPIPEDA,
  getBreachNotificationDeadline,
  getPrivacyPolicyType
};

