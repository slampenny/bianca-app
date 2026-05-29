const config = require('../../config/config');

/**
 * Resolve Asterisk SIP host/port for the current environment.
 * @returns {{ sipHost: string, sipPort: number|string }}
 */
function getSipEndpoint() {
  const primaryDomain = config.primaryDomain || 'biancawellness.com';
  if (config.env === 'staging') {
    return { sipHost: `staging-sip.${primaryDomain}`, sipPort: 5061 };
  }
  return {
    sipHost: `sip.${primaryDomain}`,
    sipPort: config.asterisk.externalPort || 5061,
  };
}

/**
 * Build SIP URI passed to Asterisk with callSid and clientId query params.
 * @param {{ callSid: string, clientId: string }} params
 */
function buildSipUri({ callSid, clientId }) {
  const { sipHost, sipPort } = getSipEndpoint();
  const sipUser = config.asterisk.sipUserName || 'bianca';
  return `sip:${sipUser}@${sipHost}:${sipPort};transport=tcp;callSid=${encodeURIComponent(callSid)};clientId=${encodeURIComponent(clientId)}`;
}

module.exports = {
  getSipEndpoint,
  buildSipUri,
};
