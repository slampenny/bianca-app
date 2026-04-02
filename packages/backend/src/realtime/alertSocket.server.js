const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../config/logger');
const { Caregiver } = require('../models');
const { tokenTypes } = require('../config/tokens');
const { setAlertIo } = require('../services/alertBroadcast.service');

let ioInstance = null;
let pubClient = null;
let subClient = null;

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

/**
 * @param {import('http').Server} httpServer
 */
async function initAlertSocketServer(httpServer) {
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
    pubClient = createClient({ url: redisUrl });
    subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('[AlertSocket] Redis adapter enabled (multi-instance alert broadcast)');
  } else {
    logger.info('[AlertSocket] REDIS_URL not set; using default in-memory adapter (single Node process only)');
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
}

module.exports = {
  initAlertSocketServer,
  shutdownAlertSocketServer,
};
