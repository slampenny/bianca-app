/**
 * Placeholder for Telnyx (or other) voice provider.
 * Implement initiateCall, webhooks, and SIP bridging when migrating off Twilio.
 */
const httpStatus = require('http-status');
const ApiError = require('../../../utils/ApiError');
const logger = require('../../../config/logger');

class TelnyxVoiceProvider {
  notImplemented(method) {
    logger.warn(`[TelnyxVoiceProvider] ${method} called but provider is not implemented`);
    throw new ApiError(
      httpStatus.NOT_IMPLEMENTED,
      'Telnyx voice telephony is not implemented yet. Set VOICE_TELEPHONY_PROVIDER=twilio in your environment.'
    );
  }

  initiateCall() {
    return this.notImplemented('initiateCall');
  }

  generateCallTwiML() {
    return this.notImplemented('generateCallTwiML');
  }

  hangupCall() {
    return this.notImplemented('hangupCall');
  }

  handleCallStatus() {
    return this.notImplemented('handleCallStatus');
  }

  scheduleRetryCall() {
    return this.notImplemented('scheduleRetryCall');
  }

  calculateCallCost(duration) {
    const config = require('../../../config/config');
    const minimumBillableDuration = config.billing.minimumBillableDuration || 30;
    const billableDuration = Math.max(duration, minimumBillableDuration);
    const totalMinutes = billableDuration / 60;
    return totalMinutes * config.billing.ratePerMinute;
  }
}

module.exports = TelnyxVoiceProvider;
