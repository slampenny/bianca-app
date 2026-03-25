const mongoose = require('mongoose');
const { MedicalAnalysis, FraudAbuseAnalysis } = require('../models');
const sentimentService = require('./sentiment.service');
const logger = require('../config/logger');

/**
 * @param {string[]} idStrings
 */
const getSentimentSnapshots = async (idStrings) => {
  const map = {};
  await Promise.all(
    idStrings.map(async (id) => {
      try {
        const s = await sentimentService.getSentimentSummary(id, { maxAgeDays: 120 });
        map[id] = {
          sentimentTrendDirection: s.trendDirection || null,
          sentimentAnalyzedConversations: typeof s.analyzedConversations === 'number' ? s.analyzedConversations : 0,
        };
      } catch (err) {
        logger.warn(`[clientHomeSnapshot] sentiment summary failed for ${id}: ${err.message}`);
        map[id] = {
          sentimentTrendDirection: null,
          sentimentAnalyzedConversations: null,
        };
      }
    }),
  );
  return map;
};

/**
 * @param {mongoose.Types.ObjectId[]} oids
 */
const getLatestMedicalScoresByClientIds = async (oids) => {
  if (!oids.length) {
    return {};
  }
  const rows = await MedicalAnalysis.aggregate([
    { $match: { clientId: { $in: oids } } },
    { $sort: { analysisDate: -1 } },
    { $group: { _id: '$clientId', doc: { $first: '$$ROOT' } } },
  ]);
  const map = {};
  for (const row of rows) {
    try {
      const inst = new MedicalAnalysis(row.doc);
      map[row._id.toString()] = {
        latestOverallHealthScore: Math.round(Number(inst.overallHealthScore) || 0),
      };
    } catch (err) {
      logger.debug(`[clientHomeSnapshot] medical hydrate skip: ${err.message}`);
    }
  }
  return map;
};

/**
 * @param {mongoose.Types.ObjectId[]} oids
 */
const getLatestFraudScoresByClientIds = async (oids) => {
  if (!oids.length) {
    return {};
  }
  const rows = await FraudAbuseAnalysis.aggregate([
    { $match: { clientId: { $in: oids } } },
    { $sort: { analysisDate: -1 } },
    { $group: { _id: '$clientId', doc: { $first: '$$ROOT' } } },
  ]);
  const map = {};
  for (const row of rows) {
    const score = row.doc?.overallRiskScore;
    if (score == null) continue;
    map[row._id.toString()] = {
      latestOverallRiskScore: Math.round(Number(score)),
    };
  }
  return map;
};

/**
 * Report fields for home client list (batched).
 * @param {Array<mongoose.Types.ObjectId|string>} clientIds
 * @returns {Promise<Record<string, object>>}
 */
const getHomeReportSnapshotsForClientIds = async (clientIds) => {
  if (!clientIds?.length) {
    return {};
  }
  const idStrings = [...new Set(clientIds.map((id) => (id._id || id).toString()).filter(Boolean))];
  if (!idStrings.length) {
    return {};
  }
  let oids;
  try {
    oids = idStrings.map((s) => new mongoose.Types.ObjectId(s));
  } catch (e) {
    return {};
  }

  const [sent, med, fraud] = await Promise.all([
    getSentimentSnapshots(idStrings),
    getLatestMedicalScoresByClientIds(oids),
    getLatestFraudScoresByClientIds(oids),
  ]);

  const merged = {};
  for (const id of idStrings) {
    merged[id] = {
      ...(sent[id] || {}),
      ...(med[id] || {}),
      ...(fraud[id] || {}),
    };
  }
  return merged;
};

module.exports = {
  getHomeReportSnapshotsForClientIds,
};
