const logger = require('../config/logger');

const TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';

let cachedAccessToken = null;
let tokenExpiresAt = 0;

function isConfigured() {
  return Boolean(
    process.env.ZOHO_MAIL_ORG_ID &&
      process.env.ZOHO_MAIL_CLIENT_ID &&
      process.env.ZOHO_MAIL_CLIENT_SECRET &&
      process.env.ZOHO_MAIL_REFRESH_TOKEN,
  );
}

function apiBase() {
  return (process.env.ZOHO_MAIL_API_BASE || 'https://mail.zoho.com/api').replace(/\/$/, '');
}

async function getAccessToken() {
  if (!isConfigured()) {
    throw new Error('Zoho Mail API is not configured');
  }
  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt > now + 60_000) {
    return cachedAccessToken;
  }

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_MAIL_REFRESH_TOKEN,
    client_id: process.env.ZOHO_MAIL_CLIENT_ID,
    client_secret: process.env.ZOHO_MAIL_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const res = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: 'POST' });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    logger.error('[Zoho Mail] Failed to refresh access token', { status: res.status, body });
    throw new Error('Zoho Mail OAuth token refresh failed');
  }

  cachedAccessToken = body.access_token;
  tokenExpiresAt = now + (body.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

async function zohoRequest(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Zoho-oauthtoken ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    logger.error('[Zoho Mail] API error', { path, status: res.status, parsed });
    throw new Error(parsed?.data?.moreInfo || parsed?.status?.description || `Zoho Mail API error (${res.status})`);
  }

  return parsed;
}

/**
 * Resolve Zoho account + zuid for a corp mailbox address.
 * @param {string} corpEmail
 * @returns {Promise<{ accountId: string, zuid: string } | null>}
 */
async function findAccountForEmail(corpEmail) {
  const zoid = process.env.ZOHO_MAIL_ORG_ID;
  const email = String(corpEmail).trim().toLowerCase();

  const accounts = await zohoRequest(`/organization/${zoid}/accounts?searchKey=${encodeURIComponent(email)}`);
  const list = accounts?.data || accounts?.accounts || [];
  const match =
    list.find((a) => String(a.primaryEmailAddress || a.emailAddress || a.email || '').toLowerCase() === email) ||
    list[0];

  if (!match) {
    return null;
  }

  const accountId = String(match.accountId || match.zaid || match.id || '');
  const zuid = String(match.zuid || match.userId || '');
  if (!accountId || !zuid) {
    return null;
  }
  return { accountId, zuid };
}

/**
 * Configure Zoho Mail forwarding for a corp mailbox.
 * @param {string} corpEmail
 * @param {string|null} forwardToEmail - null clears forwarding
 */
async function syncForwardingForMailbox(corpEmail, forwardToEmail) {
  if (!isConfigured()) {
    return { synced: false, reason: 'Zoho Mail API credentials are not configured' };
  }

  const zoid = process.env.ZOHO_MAIL_ORG_ID;
  const account = await findAccountForEmail(corpEmail);
  if (!account) {
    return { synced: false, reason: `No Zoho mailbox found for ${corpEmail}` };
  }

  const mode = forwardToEmail ? 'addMailForward' : 'deleteMailForward';
  const payload = {
    zuid: account.zuid,
    mode,
    isUserForward: false,
    ...(forwardToEmail
      ? {
          mailForward: [{ mailForwardTo: forwardToEmail }],
        }
      : {}),
  };

  await zohoRequest(`/organization/${zoid}/accounts/${account.accountId}`, {
    method: 'PUT',
    body: payload,
  });

  return { synced: true, accountId: account.accountId };
}

module.exports = {
  isConfigured,
  syncForwardingForMailbox,
  findAccountForEmail,
};
