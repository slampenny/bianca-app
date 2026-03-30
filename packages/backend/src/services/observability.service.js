const mongoose = require('mongoose');
const config = require('../config/config');

/**
 * Same payload as GET /health (used by load balancers and the admin app).
 */
function getPublicHealthSnapshot() {
  let emailStatus = { ready: false, status: 'Service not loaded' };
  try {
    const emailService = require('./email.service');
    emailStatus = {
      ready: emailService.isReady(),
      status: emailService.getStatus(),
    };
  } catch (error) {
    emailStatus = { ready: false, status: 'Service not available' };
  }

  let ariStatus = { ready: false, status: 'Service not loaded' };
  try {
    const { getAriClientInstance } = require('./ari.client');
    const ariClient = getAriClientInstance();
    ariStatus = {
      ready: ariClient && ariClient.isConnected,
      status: ariClient && ariClient.isConnected ? 'Connected' : 'Not connected',
    };
  } catch (error) {
    ariStatus = { ready: false, status: 'Service not available' };
  }

  const openaiKey = config.openai?.apiKey;
  const openaiStatus = {
    apiKeyConfigured: typeof openaiKey === 'string' && openaiKey.length > 0,
  };

  return {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.env,
    services: {
      mongodb: {
        ready: mongoose.connection.readyState === 1,
        status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      },
      email: emailStatus,
      asterisk: ariStatus,
      openai: openaiStatus,
    },
  };
}

function getProcessSnapshot() {
  const mem = process.memoryUsage();
  return {
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    pid: process.pid,
    memory: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
    },
  };
}

/**
 * Super-admin observability bundle (no secrets).
 */
function getAdminObservabilitySnapshot() {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const pkg = require('../../package.json');
  return {
    health: getPublicHealthSnapshot(),
    process: getProcessSnapshot(),
    api: {
      name: pkg.name,
      version: pkg.version,
    },
  };
}

module.exports = {
  getPublicHealthSnapshot,
  getAdminObservabilitySnapshot,
};
