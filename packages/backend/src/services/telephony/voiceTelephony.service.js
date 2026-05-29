/**
 * Voice telephony facade: outbound calls, answer markup, status webhooks, hangup, retries.
 * Active implementation is selected via config.telephony.provider (VOICE_TELEPHONY_PROVIDER).
 *
 * Call sites should depend on this module (or services.voiceTelephonyService), not provider SDK types.
 * Database field Call.callSid stores the provider's external call identifier.
 */
const config = require('../../config/config');
const logger = require('../../config/logger');

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
    logger.info('[VoiceTelephony] Active provider: telnyx (stub)');
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

function getProviderId() {
  return config.telephony?.provider || 'twilio';
}

module.exports = {
  get providerId() {
    return getProviderId();
  },
  getImplementation,
  clearImplementationCache,
  initiateCall: (clientId) => getImplementation().initiateCall(clientId),
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
