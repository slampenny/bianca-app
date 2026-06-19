/**
 * Voice telephony facade: outbound calls, answer markup, status webhooks, hangup, retries.
 * Active implementation is selected via config.telephony.provider (VOICE_TELEPHONY_PROVIDER).
 *
 * Call sites should depend on this module (or services.voiceTelephonyService), not provider SDK types.
 * Database field Call.callSid stores the provider's external call identifier.
 */
const config = require('../../config/config');
const logger = require('../../config/logger');
const { requiresHIPAA } = require('../../utils/jurisdiction.utils');

let cachedImpl;
let cachedProviderId;

function getImplementation() {
  const providerId = config.telephony?.provider || 'twilio';
  if (cachedImpl && cachedProviderId === providerId) {
    return cachedImpl;
  }
  cachedProviderId = providerId;

  if (providerId === 'telnyx') {
    const TelnyxVoiceProvider = require('./providers/telnyx.voice.provider');
    cachedImpl = new TelnyxVoiceProvider();
    logger.info('[VoiceTelephony] Active provider: telnyx');
    return cachedImpl;
  }

  const TwilioVoiceProvider = require('./providers/twilio.voice.provider');
  cachedImpl = new TwilioVoiceProvider();
  logger.info('[VoiceTelephony] Active provider: twilio');
  return cachedImpl;
}

function clearImplementationCache() {
  cachedImpl = null;
  cachedProviderId = null;
}

/**
 * Returns the outbound caller ID to use for an org based on its country.
 * US orgs get the US number when configured; all others get the default number.
 * @param {string|undefined} country - ISO 3166-1 alpha-2 country code from the org
 * @returns {string|undefined}
 */
function getFromNumber(country) {
  const providerId = getProviderId();
  if (requiresHIPAA(country)) {
    const usPhone = providerId === 'telnyx' ? config.telnyx?.phoneUS : config.twilio?.phoneUS;
    if (usPhone) return usPhone;
  }
  return providerId === 'telnyx' ? config.telnyx?.phone : config.twilio?.phone;
}

function getProviderId() {
  return config.telephony?.provider || 'twilio';
}

module.exports = {
  get providerId() {
    return getProviderId();
  },
  getImplementation,
  clearImplementationCache,
  getFromNumber,
  initiateCall: (clientId, fromNumber) => getImplementation().initiateCall(clientId, fromNumber),
  hangupCall: (externalCallId) => getImplementation().hangupCall(externalCallId),
  handleCallStatus: (req) => getImplementation().handleCallStatus(req),
  /** Provider answer markup (TwiML, TeXML, etc.) for inbound answer webhooks */
  generateAnswerMarkup: (req) => getImplementation().generateAnswerMarkup(req),
  /** @deprecated use generateAnswerMarkup */
  generateCallTwiML: (req) => getImplementation().generateAnswerMarkup(req),
  generateTestSipMarkup: (req) => getImplementation().generateTestSipMarkup(req),
  getAnswerMarkupContentType: () => getImplementation().getAnswerMarkupContentType(),
  sendStatusWebhookAck: (res) => getImplementation().sendStatusWebhookAck(res),
  scheduleRetryCall: (call, org) => getImplementation().scheduleRetryCall(call, org),
  calculateCallCost: (duration) => getImplementation().calculateCallCost(duration),
};
