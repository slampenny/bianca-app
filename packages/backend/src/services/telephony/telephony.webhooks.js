/**
 * Provider-agnostic webhook URL helpers for voice telephony.
 * Default webhook path prefix is /v1/twilio until Telnyx cutover (set TELEPHONY_WEBHOOK_PATH=/v1/telephony).
 */
const config = require('../../config/config');

function getApiBaseUrl() {
  return (
    config.telephony?.apiUrl ||
    config.twilio?.apiUrl ||
    `http://localhost:${config.port || 3000}`
  );
}

function getWebhookPathPrefix() {
  return config.telephony?.webhookPathPrefix || '/v1/twilio';
}

function buildWebhookUrl(pathSegment) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const prefix = getWebhookPathPrefix().replace(/\/$/, '');
  const path = pathSegment.startsWith('/') ? pathSegment : `/${pathSegment}`;
  return `${base}${prefix}${path}`;
}

function getStartCallWebhookUrl(clientId, fromNumber) {
  const path = `/start-call/${clientId}`;
  if (fromNumber) {
    return buildWebhookUrl(`${path}?from=${encodeURIComponent(fromNumber)}`);
  }
  return buildWebhookUrl(path);
}

function getCallStatusWebhookUrl() {
  return buildWebhookUrl('/call-status');
}

module.exports = {
  getApiBaseUrl,
  getWebhookPathPrefix,
  buildWebhookUrl,
  getStartCallWebhookUrl,
  getCallStatusWebhookUrl,
};
