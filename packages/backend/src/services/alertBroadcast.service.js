const logger = require('../config/logger');
const { Client, Caregiver, Schedule } = require('../models');

/** @type {import('socket.io').Server | null} */
let ioRef = null;

function setAlertIo(io) {
  ioRef = io;
}

/**
 * Resolve org id for routing alert fan-out (org-scoped Socket.IO room).
 * @param {import('mongoose').Document|object} alert
 * @returns {Promise<string|null>}
 */
async function resolveOrgIdForAlert(alert) {
  if (!alert) return null;

  const { relatedClient } = alert;
  if (relatedClient) {
    const cid = relatedClient._id || relatedClient.id || relatedClient;
    const client = await Client.findById(cid).select('org');
    return client && client.org ? client.org.toString() : null;
  }

  const { createdBy: createdByRaw, createdModel: model } = alert;
  const createdBy = createdByRaw && createdByRaw._id ? createdByRaw._id : createdByRaw;
  if (!createdBy || !model) return null;

  if (model === 'Org') {
    return createdBy.toString();
  }
  if (model === 'Caregiver') {
    const cg = await Caregiver.findById(createdBy).select('org');
    return cg && cg.org ? cg.org.toString() : null;
  }
  if (model === 'Client') {
    const client = await Client.findById(createdBy).select('org');
    return client && client.org ? client.org.toString() : null;
  }
  if (model === 'Schedule') {
    const sch = await Schedule.findById(createdBy).select('client').populate({ path: 'client', select: 'org' });
    const org = sch && sch.client && sch.client.org ? sch.client.org : null;
    return org ? org.toString() : null;
  }

  return null;
}

function broadcastOrgAlertsChanged(orgId) {
  if (!ioRef || !orgId) return;
  try {
    ioRef.to(`org:${orgId}`).emit('alerts:changed', { t: Date.now() });
  } catch (err) {
    logger.warn(`[alertBroadcast] emit failed: ${err.message}`);
  }
}

async function broadcastAfterAlertChange(alertDocLike) {
  const orgId = await resolveOrgIdForAlert(alertDocLike);
  broadcastOrgAlertsChanged(orgId);
}

/**
 * Non-blocking: run after HTTP handler returns; avoids adding latency to REST.
 * @param {import('mongoose').Document|object} alertDocLike
 */
function scheduleBroadcastAfterAlertChange(alertDocLike) {
  setImmediate(() => {
    broadcastAfterAlertChange(alertDocLike).catch((err) => {
      logger.warn(`[alertBroadcast] ${err.message}`);
    });
  });
}

module.exports = {
  setAlertIo,
  broadcastOrgAlertsChanged,
  broadcastAfterAlertChange,
  scheduleBroadcastAfterAlertChange,
  resolveOrgIdForAlert,
};
