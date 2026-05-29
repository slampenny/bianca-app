const crypto = require('crypto');
const config = require('../../config/config');
const logger = require('../../config/logger');

/**
 * Telnyx webhook envelope (API v2): { data: { event_type, payload } } or flat { event_type, payload }.
 */
function getTelnyxEvent(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.data && typeof body.data === 'object') return body.data;
  if (body.event_type) return body;
  return null;
}

function parseDurationSeconds(payload) {
  if (!payload) return 0;
  if (payload.call_duration_secs != null) return parseInt(payload.call_duration_secs, 10) || 0;
  if (payload.duration_secs != null) return parseInt(payload.duration_secs, 10) || 0;
  if (payload.start_time && payload.end_time) {
    const start = new Date(payload.start_time).getTime();
    const end = new Date(payload.end_time).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Math.round((end - start) / 1000);
    }
  }
  return 0;
}

function mapMachineResult(result) {
  if (!result) return null;
  const normalized = String(result).toLowerCase();
  if (normalized === 'human') return null;
  if (normalized === 'machine') return 'machine_end_beep';
  if (normalized === 'not_sure') return 'machine_start';
  return normalized;
}

function mapHangupCauseToStatus(hangupCause) {
  const cause = String(hangupCause || '').toLowerCase();
  if (cause === 'user_busy' || cause === 'busy') return 'busy';
  if (cause === 'no_answer' || cause === 'timeout' || cause === 'originator_cancel') return 'no-answer';
  if (cause === 'normal_clearing' || cause === 'success') return 'completed';
  if (cause === 'call_rejected' || cause === 'failed') return 'failed';
  return 'completed';
}

/**
 * Normalize Telnyx JSON webhook to Twilio-shaped status fields for shared handler.
 * Returns null if event should be ignored (no status mapping).
 */
function normalizeTelnyxStatusWebhook(body) {
  const event = getTelnyxEvent(body);
  if (!event?.event_type || !event.payload) return null;

  const { event_type: eventType, payload } = event;
  const callSid = payload.call_control_id || payload.call_session_id;
  if (!callSid) return null;

  switch (eventType) {
    case 'call.initiated':
      return { callSid, callStatus: 'initiated', callDuration: 0, answeredBy: null };
    case 'call.ringing':
      return { callSid, callStatus: 'ringing', callDuration: 0, answeredBy: null };
    case 'call.answered':
      return { callSid, callStatus: 'answered', callDuration: 0, answeredBy: null };
    case 'call.hangup':
      return {
        callSid,
        callStatus: mapHangupCauseToStatus(payload.hangup_cause),
        callDuration: parseDurationSeconds(payload),
        answeredBy: null,
      };
    case 'call.machine.detection.ended':
    case 'call.machine.greeting.ended':
      return {
        callSid,
        callStatus: null,
        callDuration: 0,
        answeredBy: mapMachineResult(payload.result),
      };
    case 'call.machine.detection.failed':
      logger.warn(`[Telnyx] AMD failed for ${callSid}: ${payload.reason || 'unknown'}`);
      return null;
    default:
      logger.debug(`[Telnyx] Ignoring unhandled webhook event: ${eventType}`);
      return null;
  }
}

/**
 * Extract call identifiers from TeXML fetch callback (form or JSON).
 */
function extractTexmlRequestFields(req) {
  const body = req.body || {};
  const query = req.query || {};
  const callSid =
    body.CallSid ||
    body.call_control_id ||
    body.call_session_id ||
    query.CallSid ||
    query.call_control_id;
  const answeredBy = body.AnsweredBy || body.answered_by || query.AnsweredBy || null;
  return { callSid, answeredBy };
}

/**
 * Verify Telnyx Ed25519 webhook signature.
 * @see https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-webhooks
 */
function verifyTelnyxSignature({ rawBody, signature, timestamp, publicKey }) {
  if (!signature || !timestamp || !publicKey) return false;

  try {
    const signedPayload = `${timestamp}|${rawBody}`;
    const signatureBuffer = Buffer.from(signature, 'base64');

    let keyObject;
    if (publicKey.includes('BEGIN PUBLIC KEY')) {
      keyObject = crypto.createPublicKey(publicKey);
    } else {
      keyObject = crypto.createPublicKey({
        key: Buffer.from(publicKey, 'base64'),
        format: 'der',
        type: 'spki',
      });
    }

    return crypto.verify(null, Buffer.from(signedPayload), keyObject, signatureBuffer);
  } catch (error) {
    logger.error(`[Telnyx] Signature verification error: ${error.message}`);
    return false;
  }
}

module.exports = {
  getTelnyxEvent,
  normalizeTelnyxStatusWebhook,
  extractTexmlRequestFields,
  verifyTelnyxSignature,
  mapHangupCauseToStatus,
};
