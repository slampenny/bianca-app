const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../config/logger');
const { Caregiver } = require('../models');
const { tokenTypes } = require('../config/tokens');
const { setAlertIo } = require('../services/alertBroadcast.service');

/** Bounded wait so HTTP listen is never blocked on Redis. */
const REDIS_CONNECT_TIMEOUT_MS = 4000;
/** Background retry interval after fail-open degraded start. */
const REDIS_RETRY_INTERVAL_MS = 10000;

let ioInstance = null;
let pubClient = null;
let subClient = null;
let redisRetryTimer = null;
let redisAttachInProgress = false;
let shuttingDown = false;
/** True once Redis adapter is attached (startup or background). */
let redisAdapterAttached = false;

const SOCKET_EXTRA_ORIGINS = [
  'https://app.biancawellness.com',
  'http://app.biancawellness.com',
  'https://staging.biancawellness.com',
  'http://staging.biancawellness.com',
  'https://app.myphonefriend.com',
  'http://app.myphonefriend.com',
];

function socketCorsOrigin(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }
  const normalized = origin.toLowerCase().replace(/\/$/, '');
  if (config.env === 'development' || config.env === 'test') {
    const isLocalhost = normalized.startsWith('http://localhost:') || normalized.startsWith('https://localhost:');
    const isLoopback = normalized.startsWith('http://127.0.0.1:') || normalized.startsWith('https://127.0.0.1:');
    if (isLocalhost || isLoopback) {
      callback(null, true);
      return;
    }
  }
  const fe = config.frontendUrl ? config.frontendUrl.toLowerCase().replace(/\/$/, '') : null;
  if (fe && normalized === fe) {
    callback(null, true);
    return;
  }
  if (SOCKET_EXTRA_ORIGINS.includes(normalized)) {
    callback(null, true);
    return;
  }
  if (normalized.endsWith('.vercel.app')) {
    callback(null, true);
    return;
  }
  if (config.env === 'staging' && normalized.includes('staging.biancawellness.com')) {
    callback(null, true);
    return;
  }
  callback(new Error('Not allowed by CORS'));
}

function clearRedisRetryTimer() {
  if (redisRetryTimer) {
    clearTimeout(redisRetryTimer);
    redisRetryTimer = null;
  }
}

/**
 * Destroy Redis clients that failed or timed out so they do not keep retrying
 * underneath a discarded attempt. Must not hang — a mid-connect client can
 * block forever on quit()/disconnect(), which would re-block HTTP listen.
 * @param {import('redis').RedisClientType | null} pub
 * @param {import('redis').RedisClientType | null} sub
 */
async function destroyRedisClients(pub, sub) {
  const closeOne = async (client) => {
    if (!client) return;
    try {
      client.removeAllListeners?.();
    } catch (_) {
      /* ignore */
    }
    // node-redis destroy() aborts in-flight connect without awaiting sockets.
    if (typeof client.destroy === 'function') {
      try {
        client.destroy();
      } catch (_) {
        /* ignore */
      }
      return;
    }
    await Promise.race([
      (async () => {
        try {
          await client.disconnect();
        } catch (_) {
          /* ignore */
        }
      })(),
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
  };
  await Promise.all([closeOne(pub), closeOne(sub)]);
}

/**
 * Connect pub/sub with a hard timeout and no auto-reconnect on this attempt.
 * @param {string} redisUrl
 * @returns {Promise<{ pub: import('redis').RedisClientType, sub: import('redis').RedisClientType }>}
 */
async function connectRedisPubSubOnce(redisUrl) {
  const pub = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: false,
    },
  });
  const sub = pub.duplicate();

  pub.on('error', (err) => {
    logger.error('[AlertSocket] Redis pub client error:', err);
  });
  sub.on('error', (err) => {
    logger.error('[AlertSocket] Redis sub client error:', err);
  });

  const connectPromise = Promise.all([pub.connect(), sub.connect()]);
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(
        `[AlertSocket] Redis connect timed out after ${REDIS_CONNECT_TIMEOUT_MS}ms`
      );
      err.code = 'REDIS_CONNECT_TIMEOUT';
      reject(err);
    }, REDIS_CONNECT_TIMEOUT_MS);
  });

  try {
    await Promise.race([connectPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return { pub, sub };
  } catch (err) {
    clearTimeout(timeoutId);
    await destroyRedisClients(pub, sub);
    throw err;
  }
}

/**
 * Attach Redis adapter to a live Socket.IO server (startup or background recover).
 * @param {import('socket.io').Server} io
 * @param {string} redisUrl
 * @param {'startup' | 'background'} phase
 * @returns {Promise<boolean>} true if adapter attached
 */
async function tryAttachRedisAdapter(io, redisUrl, phase) {
  if (shuttingDown || redisAdapterAttached || redisAttachInProgress) {
    return redisAdapterAttached;
  }
  redisAttachInProgress = true;
  try {
    const { pub, sub } = await connectRedisPubSubOnce(redisUrl);
    if (shuttingDown) {
      await destroyRedisClients(pub, sub);
      return false;
    }
    io.adapter(createAdapter(pub, sub));
    pubClient = pub;
    subClient = sub;
    redisAdapterAttached = true;
    clearRedisRetryTimer();
    if (phase === 'startup') {
      logger.info('[AlertSocket] Redis adapter enabled (multi-instance alert broadcast)');
    } else {
      logger.info(
        '[AlertSocket] Redis recovered — multi-instance alert broadcast adapter attached after degraded start'
      );
    }
    return true;
  } catch (err) {
    logger.warn(
      `[AlertSocket] Redis adapter attach failed (${phase}): ${err.message || err}`
    );
    return false;
  } finally {
    redisAttachInProgress = false;
  }
}

/**
 * Keep retrying Redis until attached or shutdown.
 * @param {import('socket.io').Server} io
 * @param {string} redisUrl
 */
function scheduleRedisAdapterRetry(io, redisUrl) {
  clearRedisRetryTimer();
  if (shuttingDown || redisAdapterAttached) return;

  redisRetryTimer = setTimeout(async () => {
    redisRetryTimer = null;
    if (shuttingDown || redisAdapterAttached) return;
    const ok = await tryAttachRedisAdapter(io, redisUrl, 'background');
    if (!ok && !shuttingDown && !redisAdapterAttached) {
      scheduleRedisAdapterRetry(io, redisUrl);
    }
  }, REDIS_RETRY_INTERVAL_MS);
}

/**
 * @param {import('http').Server} httpServer
 */
async function initAlertSocketServer(httpServer) {
  shuttingDown = false;
  redisAdapterAttached = false;

  const io = new Server(httpServer, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    cors: {
      origin: socketCorsOrigin,
      credentials: true,
    },
  });

  const redisUrl = config.redis && config.redis.url;
  if (redisUrl) {
    const attached = await tryAttachRedisAdapter(io, redisUrl, 'startup');
    if (!attached) {
      logger.error(
        '[AlertSocket] DEGRADED MODE: Redis unavailable at startup — using in-memory Socket.IO adapter. ' +
          'HTTP API will start; multi-instance alert fan-out is disabled until Redis reconnects. ' +
          `Retrying in background every ${REDIS_RETRY_INTERVAL_MS / 1000}s.`
      );
      scheduleRedisAdapterRetry(io, redisUrl);
    }
  } else {
    logger.info(
      '[AlertSocket] REDIS_URL not set; using default in-memory adapter (single Node process only)'
    );
  }

  io.use(async (socket, next) => {
    try {
      let raw = socket.handshake.auth && socket.handshake.auth.token;
      if (!raw && socket.handshake.headers && socket.handshake.headers.authorization) {
        raw = socket.handshake.headers.authorization;
      }
      if (typeof raw === 'string' && raw.startsWith('Bearer ')) {
        raw = raw.slice(7);
      }
      if (!raw) {
        return next(new Error('Unauthorized'));
      }
      const payload = jwt.verify(raw, config.jwt.secret);
      if (payload.type !== tokenTypes.ACCESS) {
        return next(new Error('Unauthorized'));
      }
      const caregiver = await Caregiver.findById(payload.sub).select('org role');
      if (!caregiver) {
        return next(new Error('Unauthorized'));
      }
      const { data } = socket;
      data.caregiverId = caregiver.id.toString();
      data.orgId = caregiver.org ? caregiver.org.toString() : null;
      return next();
    } catch (e) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { orgId } = socket.data;
    if (orgId) {
      socket.join(`org:${orgId}`);
      logger.debug(`[AlertSocket] socket ${socket.id} joined org:${orgId}`);
    } else {
      logger.warn(`[AlertSocket] socket ${socket.id} has no orgId; not joining alert room`);
    }
  });

  ioInstance = io;
  setAlertIo(io);
  return io;
}

async function shutdownAlertSocketServer() {
  shuttingDown = true;
  clearRedisRetryTimer();
  setAlertIo(null);
  if (ioInstance) {
    await new Promise((resolve) => {
      ioInstance.close(() => resolve());
    });
    ioInstance = null;
  }
  if (pubClient) {
    await pubClient.quit().catch(() => {});
    pubClient = null;
  }
  if (subClient) {
    await subClient.quit().catch(() => {});
    subClient = null;
  }
  redisAdapterAttached = false;
}

module.exports = {
  initAlertSocketServer,
  shutdownAlertSocketServer,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_RETRY_INTERVAL_MS,
};
