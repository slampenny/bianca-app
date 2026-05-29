const config = require('../config/config');
const logger = require('../config/logger');
const { verifyTelnyxSignature } = require('../services/telephony/telnyx.webhook');

/**
 * Capture raw body for Telnyx Ed25519 verification (must run before JSON parser on Telnyx routes).
 */
const captureTelnyxRawBody = (req, res, buf) => {
  if (buf?.length) {
    req.rawBody = buf.toString('utf8');
  }
};

const validateTelnyxRequest = (req, res, next) => {
  const signature = req.headers['telnyx-signature-ed25519'];
  const timestamp = req.headers['telnyx-timestamp'];
  const publicKey = config.telnyx?.publicKey;

  if (!signature || !timestamp || !publicKey) {
    logger.error('[Telnyx] Missing signature headers or TELNYX_PUBLIC_KEY');
    return res.status(403).json({ error: 'Authentication Error: Missing Telnyx signature configuration' });
  }

  const rawBody =
    req.rawBody ||
    (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

  const isValid = verifyTelnyxSignature({
    rawBody,
    signature,
    timestamp,
    publicKey,
  });

  if (!isValid) {
    logger.error('[Telnyx] Invalid webhook signature');
    return res.status(403).json({ error: 'Authentication Error: Invalid Telnyx signature' });
  }

  logger.info('[Telnyx] Webhook signature verified');
  next();
};

module.exports = {
  validateTelnyxRequest,
  captureTelnyxRawBody,
};
