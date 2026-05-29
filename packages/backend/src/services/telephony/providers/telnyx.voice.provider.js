/**
 * Telnyx Call Control + TeXML voice provider.
 * Outbound calls bridge to Asterisk SIP via TeXML (Twilio-compatible XML).
 */
const httpStatus = require('http-status');
const config = require('../../../config/config');
const logger = require('../../../config/logger');
const { Client } = require('../../../models');
const ApiError = require('../../../utils/ApiError');
const telnyxApi = require('../telnyx.api');
const {
  getStartCallWebhookUrl,
  getCallStatusWebhookUrl,
} = require('../telephony.webhooks');
const { buildAnswerMarkup, buildErrorMarkup, isVoicemailAnsweredBy } = require('../answerMarkup.builder');
const {
  extractTexmlRequestFields,
  normalizeTelnyxStatusWebhook,
} = require('../telnyx.webhook');
const {
  calculateCallCost,
  updateCallStatus,
  createOutboundCallRecord,
  handleNormalizedCallStatus,
} = require('../voiceCallStatus.handler');

class TelnyxVoiceProvider {
  async initiateCall(clientId) {
    logger.info(`[Telnyx Service] Initiating call for client ID: ${clientId}`);

    try {
      const client = await Client.findById(clientId);
      if (!client?.phone) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Client or phone number not found');
      }

      if (!config.telnyx?.apiKey) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Telnyx API key not configured');
      }
      if (!config.telnyx?.connectionId) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Telnyx connection ID not configured');
      }
      if (!config.telnyx?.phone) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Telnyx phone number not configured');
      }

      const texmlUrl = getStartCallWebhookUrl(clientId);
      const webhookUrl = getCallStatusWebhookUrl();
      logger.info(`[Telnyx Service] TeXML URL: ${texmlUrl}`);
      logger.info(`[Telnyx Service] Webhook URL: ${webhookUrl}`);

      const clientService = require('../../client.service');
      const hasConsent = await clientService.checkClientConsent(clientId);
      const recordCalls = config.telnyx.recordCalls && hasConsent;

      let result;
      try {
        result = await telnyxApi.createOutboundCall({
          to: client.phone,
          from: config.telnyx.phone,
          texmlUrl,
          webhookUrl,
          clientState: { clientId: clientId.toString(), recordCalls },
        });
      } catch (apiError) {
        const status = apiError.response?.status;
        const detail = apiError.response?.data?.errors?.[0]?.detail || apiError.message;
        logger.error(`[Telnyx Service] API error (${status}): ${detail}`);
        if (status === 401 || status === 403) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'Telnyx authentication failed');
        }
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Telnyx API error: ${detail}`);
      }

      await createOutboundCallRecord(client, clientId, result.callControlId, '[Telnyx Service]');
      logger.info(`[Telnyx Service] Call initiated with call_control_id: ${result.callControlId}`);
      return result.callControlId;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error(`[Telnyx Service] Error initiating call: ${error.message}`);
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to initiate call: ${error.message || 'Unknown error'}`
      );
    }
  }

  generateAnswerMarkup(req) {
    const clientId = req.params.clientId;
    const { callSid, answeredBy } = extractTexmlRequestFields(req);

    logger.info(
      `[Telnyx Service] Generating TeXML for callSid: ${callSid}, AnsweredBy: ${answeredBy || 'null'}, clientId: ${clientId}`
    );

    if (!callSid) {
      logger.error('[Telnyx Service] Missing callSid on TeXML request');
      return buildErrorMarkup();
    }

    try {
      const markup = buildAnswerMarkup({
        callSid,
        clientId,
        answeredBy,
        callerId: config.telnyx.phone,
        recordCalls: config.telnyx.recordCalls,
      });

      if (isVoicemailAnsweredBy(answeredBy)) {
        this.updateCallStatus(callSid, 'machine');
      } else {
        this.updateCallStatus(callSid, 'in-progress');
      }

      logger.info(`[Telnyx Service] Generated TeXML for ${callSid}`);
      return markup;
    } catch (error) {
      logger.error(`[Telnyx Service] Error generating TeXML: ${error.message}`);
      return buildErrorMarkup();
    }
  }

  generateCallTwiML(req) {
    return this.generateAnswerMarkup(req);
  }

  getAnswerMarkupContentType() {
    return 'application/xml';
  }

  sendStatusWebhookAck(res) {
    res.status(200).json({ received: true });
  }

  generateTestSipMarkup(req) {
    const testClientId = req.query.testClientId || req.query.testPatientId || 'direct-sip-test';
    const testCallSid =
      req.query.testCallSid || req.query.testTwilioSid || `TEST_SIP_${Date.now()}`;

    return buildAnswerMarkup({
      callSid: testCallSid,
      clientId: testClientId,
      callerId: config.telnyx.phone || '+15551234567',
      testIntroSay: 'Testing SIP connection to Asterisk from telephony provider.',
      dialTimeout: 15,
    });
  }

  calculateCallCost(duration) {
    return calculateCallCost(duration);
  }

  updateCallStatus(callSid, status) {
    return updateCallStatus(callSid, status, '[Telnyx Service]');
  }

  async handleCallStatus(req) {
    logger.info('[Telnyx Service] Webhook received', JSON.stringify(req.body));

    const normalized = normalizeTelnyxStatusWebhook(req.body);
    if (!normalized) {
      return;
    }

    await handleNormalizedCallStatus(normalized, {
      hangupCall: (id) => this.hangupCall(id),
      logPrefix: '[Telnyx Service]',
    });
  }

  scheduleRetryCall(call, org) {
    const { scheduleRetryCall: scheduleRetry } = require('../voiceCallStatus.handler');
    return scheduleRetry(call, org, '[Telnyx Service]');
  }

  async hangupCall(callControlId) {
    if (!callControlId) {
      logger.warn('[Telnyx Service] hangupCall called without call_control_id');
      return;
    }

    try {
      if (!config.telnyx?.apiKey) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Telnyx API key not configured');
      }

      try {
        const current = await telnyxApi.fetchCall(callControlId);
        const terminal = ['hangup', 'completed', 'failed'];
        if (current?.is_alive === false || terminal.includes(String(current?.state).toLowerCase())) {
          logger.info(`[Telnyx Service] Call ${callControlId} already ended (${current?.state})`);
          return current;
        }
      } catch (fetchErr) {
        logger.warn(
          `[Telnyx Service] Could not fetch call ${callControlId}: ${fetchErr.message}. Proceeding with hangup.`
        );
      }

      await telnyxApi.hangupCall(callControlId);
      logger.info(`[Telnyx Service] Hung up call ${callControlId}`);
    } catch (err) {
      logger.error(`[Telnyx Service] Error hanging up call ${callControlId}: ${err.message}`);
      throw err;
    }
  }
}

module.exports = TelnyxVoiceProvider;
