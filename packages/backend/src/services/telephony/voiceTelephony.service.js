/**
 * Voice telephony facade: outbound calls, answer markup (e.g. TwiML), status webhooks, hangup, retries.
 * Active implementation is selected via config.telephony.provider (VOICE_TELEPHONY_PROVIDER).
 *
 * Call sites should depend on this module (or services.voiceTelephonyService), not Twilio SDK types.
 * Database field Call.callSid remains the provider’s external call identifier (Twilio Call SID today).
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

function getProviderId() {
  return config.telephony?.provider || 'twilio';
}

module.exports = {
  get providerId() {
    return getProviderId();
  },
  getImplementation,
  initiateCall: (clientId) => getImplementation().initiateCall(clientId),
  hangupCall: (externalCallId) => getImplementation().hangupCall(externalCallId),
  handleCallStatus: (req) => getImplementation().handleCallStatus(req),
  /** Twilio-specific TwiML; other providers may use a different HTTP entrypoint. */
  generateCallTwiML: (req) => getImplementation().generateCallTwiML(req),
  scheduleRetryCall: (call, org) => getImplementation().scheduleRetryCall(call, org),
  calculateCallCost: (duration) => getImplementation().calculateCallCost(duration),
};
