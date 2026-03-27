/**
 * Back-compat entry: TwilioSmsProvider class for tests/direct use, and sms facade as twilioSmsService.
 */
const smsService = require('./messaging/sms.service');
const TwilioSMSService = require('./messaging/providers/twilio.sms.provider');

module.exports = {
  TwilioSMSService,
  /** @deprecated prefer smsService — routes through SMS_PROVIDER (twilio | sns) */
  twilioSmsService: smsService,
  smsService,
};
