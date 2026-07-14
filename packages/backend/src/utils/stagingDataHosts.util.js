/**
 * Staging must never connect to production (or any off-box) Mongo/Redis.
 * Fail before any connection attempt when NODE_ENV=staging or the staging secret id is used.
 */

const ALLOWED_MONGO_HOSTS = new Set(['localhost', '127.0.0.1', 'mongodb']);
const ALLOWED_REDIS_HOSTS = new Set(['localhost', '127.0.0.1', 'redis']);

/**
 * @param {string|undefined} url
 * @returns {string|null} hostname or null if empty/unparseable
 */
function hostFromUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return null;
  }
  try {
    const normalized = url.includes('://') ? url : `scheme://${url}`;
    const { hostname } = new URL(normalized);
    return hostname ? hostname.toLowerCase() : null;
  } catch {
    // mongodb://user:pass@host:27017/db — URL() handles this; fallback for redis host:port
    const withoutScheme = url.replace(/^[a-z]+:\/\//i, '');
    const hostPart = withoutScheme.split('/')[0].split('@').pop();
    const host = (hostPart || '').split(':')[0].trim().toLowerCase();
    return host || null;
  }
}

/**
 * @param {{ nodeEnv?: string, secretId?: string, mongodbUrl?: string, redisUrl?: string, redisEndpoint?: string }} opts
 * @returns {{ ok: true } | { ok: false, reason: string, host: string, field: string }}
 */
function checkStagingDataHosts(opts = {}) {
  const nodeEnv = opts.nodeEnv || process.env.NODE_ENV;
  const secretId = opts.secretId || process.env.AWS_SECRET_ID || '';
  const isStaging =
    nodeEnv === 'staging' ||
    secretId === 'MySecretsManagerSecret-Staging' ||
    /staging/i.test(secretId);

  if (!isStaging) {
    return { ok: true };
  }

  const mongoUrl = opts.mongodbUrl || process.env.MONGODB_URL || '';
  const mongoHost = hostFromUrl(mongoUrl);
  if (!mongoHost || !ALLOWED_MONGO_HOSTS.has(mongoHost)) {
    return {
      ok: false,
      field: 'MONGODB_URL',
      host: mongoHost || '(missing)',
      reason: `Staging refuses MongoDB host "${mongoHost || '(missing)'}". Allowed: ${[...ALLOWED_MONGO_HOSTS].join(', ')}`,
    };
  }

  const redisUrl = opts.redisUrl || process.env.REDIS_URL || '';
  const redisEndpoint = opts.redisEndpoint || process.env.REDIS_ENDPOINT || '';
  const redisHost = hostFromUrl(redisUrl) || (redisEndpoint ? redisEndpoint.split(':')[0].toLowerCase() : null);

  if (redisHost && !ALLOWED_REDIS_HOSTS.has(redisHost)) {
    return {
      ok: false,
      field: redisUrl ? 'REDIS_URL' : 'REDIS_ENDPOINT',
      host: redisHost,
      reason: `Staging refuses Redis host "${redisHost}". Allowed: ${[...ALLOWED_REDIS_HOSTS].join(', ')} (or unset for memory cache)`,
    };
  }

  return { ok: true };
}

/**
 * Log and process.exit(1) on violation. No-op when not staging.
 * @param {object} [opts]
 * @param {{ error: Function, info?: Function }} [logger]
 */
function assertStagingDataHostsOrExit(opts = {}, logger = console) {
  const result = checkStagingDataHosts(opts);
  if (result.ok) {
    return;
  }
  const log = typeof logger.error === 'function' ? logger.error.bind(logger) : console.error;
  log(`[StagingDataHostGuard] FATAL: ${result.reason}`);
  log(`[StagingDataHostGuard] Offending field=${result.field} host=${result.host}`);
  process.exit(1);
}

module.exports = {
  ALLOWED_MONGO_HOSTS,
  ALLOWED_REDIS_HOSTS,
  hostFromUrl,
  checkStagingDataHosts,
  assertStagingDataHostsOrExit,
};
