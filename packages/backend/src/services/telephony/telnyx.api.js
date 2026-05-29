const axios = require('axios');
const config = require('../../config/config');
const logger = require('../../config/logger');

function getTelnyxConfig() {
  return config.telnyx || {};
}

function getAuthHeaders() {
  const { apiKey } = getTelnyxConfig();
  if (!apiKey) {
    throw new Error('Telnyx API key not configured');
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function getBaseUrl() {
  return getTelnyxConfig().apiBaseUrl || 'https://api.telnyx.com/v2';
}

/**
 * @returns {Promise<{ callControlId: string, callSessionId?: string, raw: object }>}
 */
async function createOutboundCall({ to, from, texmlUrl, webhookUrl, clientState }) {
  const { connectionId } = getTelnyxConfig();
  if (!connectionId) {
    throw new Error('Telnyx connection ID not configured');
  }

  const body = {
    connection_id: connectionId,
    to,
    from,
    texml_url: texmlUrl,
    texml_url_method: 'POST',
    webhook_url: webhookUrl,
    webhook_url_method: 'POST',
    answering_machine_detection: 'detect',
  };

  if (clientState) {
    body.client_state = Buffer.from(JSON.stringify(clientState)).toString('base64');
  }

  logger.info(`[Telnyx API] Creating outbound call to ${to} from ${from}`);
  const response = await axios.post(`${getBaseUrl()}/calls`, body, {
    headers: getAuthHeaders(),
    timeout: 30000,
  });

  const data = response.data?.data || {};
  const callControlId = data.call_control_id;
  if (!callControlId) {
    throw new Error('Telnyx API did not return call_control_id');
  }

  return {
    callControlId,
    callSessionId: data.call_session_id,
    raw: data,
  };
}

async function hangupCall(callControlId) {
  if (!callControlId) return;
  logger.info(`[Telnyx API] Hanging up call ${callControlId}`);
  await axios.post(
    `${getBaseUrl()}/calls/${encodeURIComponent(callControlId)}/actions/hangup`,
    {},
    { headers: getAuthHeaders(), timeout: 15000 }
  );
}

async function fetchCall(callControlId) {
  const response = await axios.get(`${getBaseUrl()}/calls/${encodeURIComponent(callControlId)}`, {
    headers: getAuthHeaders(),
    timeout: 15000,
  });
  return response.data?.data;
}

module.exports = {
  createOutboundCall,
  hangupCall,
  fetchCall,
};
