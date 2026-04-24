const mongoose = require('mongoose');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { ANCHOR_TREE, flattenListFromTree } = require('../config/embeddingAnchor.defaults');
const { EmbeddingAnchorPhrase } = require('../models/embeddingAnchorPhrase.model');

function buildTreeFromDocuments(docs) {
  const tree = {
    emergencyDetector: {},
    abuseNeglectDetector: { physical: {}, emotional: {}, neglect: {} },
    financialExploitationDetector: {},
    relationshipPatternDetector: {},
  };
  const active = (docs || []).filter((d) => d.isActive !== false);
  const sorted = [...active].sort((a, b) => {
    const o = (a.order || 0) - (b.order || 0);
    if (o !== 0) return o;
    return String(a.phrase).localeCompare(String(b.phrase));
  });
  for (const d of sorted) {
    if (d.detector === 'emergencyDetector') {
      if (!tree.emergencyDetector[d.bucket]) {
        tree.emergencyDetector[d.bucket] = {
          severity: d.emergencySeverity || 'HIGH',
          category: d.emergencyCategory || 'medical_emergency',
          phrases: [],
        };
      }
      tree.emergencyDetector[d.bucket].phrases.push(d.phrase);
    } else if (d.detector === 'abuseNeglectDetector') {
      const cat = d.category;
      if (!cat) continue;
      if (!tree.abuseNeglectDetector[cat]) tree.abuseNeglectDetector[cat] = {};
      if (!tree.abuseNeglectDetector[cat][d.bucket]) tree.abuseNeglectDetector[cat][d.bucket] = [];
      tree.abuseNeglectDetector[cat][d.bucket].push(d.phrase);
    } else if (d.detector === 'financialExploitationDetector') {
      if (!tree.financialExploitationDetector[d.bucket]) tree.financialExploitationDetector[d.bucket] = [];
      tree.financialExploitationDetector[d.bucket].push(d.phrase);
    } else if (d.detector === 'relationshipPatternDetector') {
      if (!tree.relationshipPatternDetector[d.bucket]) tree.relationshipPatternDetector[d.bucket] = [];
      tree.relationshipPatternDetector[d.bucket].push(d.phrase);
    }
  }
  return tree;
}

function buildSeedDocumentsFromDefaults() {
  const out = [];
  let order = 0;
  const em = ANCHOR_TREE.emergencyDetector;
  Object.keys(em).forEach((bucket) => {
    const block = em[bucket];
    block.phrases.forEach((phrase) => {
      out.push({
        detector: 'emergencyDetector',
        category: null,
        bucket,
        phrase,
        order: order++,
        isActive: true,
        emergencySeverity: block.severity,
        emergencyCategory: block.category,
      });
    });
  });
  const abuse = ANCHOR_TREE.abuseNeglectDetector;
  Object.keys(abuse).forEach((cat) => {
    Object.keys(abuse[cat]).forEach((bucket) => {
      (abuse[cat][bucket] || []).forEach((phrase) => {
        out.push({
          detector: 'abuseNeglectDetector',
          category: cat,
          bucket,
          phrase,
          order: order++,
          isActive: true,
        });
      });
    });
  });
  const fin = ANCHOR_TREE.financialExploitationDetector;
  Object.keys(fin).forEach((bucket) => {
    (fin[bucket] || []).forEach((phrase) => {
      out.push({
        detector: 'financialExploitationDetector',
        category: null,
        bucket,
        phrase,
        order: order++,
        isActive: true,
      });
    });
  });
  const rel = ANCHOR_TREE.relationshipPatternDetector;
  Object.keys(rel).forEach((bucket) => {
    (rel[bucket] || []).forEach((phrase) => {
      out.push({
        detector: 'relationshipPatternDetector',
        category: null,
        bucket,
        phrase,
        order: order++,
        isActive: true,
      });
    });
  });
  return out;
}

/**
 * Inserts default phrases if the collection is empty (idempotent; safe for concurrent first calls).
 */
async function seedIfEmpty() {
  if (mongoose.connection.readyState !== 1) return;
  const n = await EmbeddingAnchorPhrase.estimatedDocumentCount();
  if (n > 0) return;
  const batch = buildSeedDocumentsFromDefaults();
  try {
    await EmbeddingAnchorPhrase.insertMany(batch, { ordered: true });
    logger.info(`[EmbeddingAnchorPhrase] Seeded ${batch.length} default anchor phrases`);
  } catch (e) {
    if (e?.code === 11000) {
      logger.info('[EmbeddingAnchorPhrase] Seed skipped (another worker inserted first)');
      return;
    }
    const retryCount = await EmbeddingAnchorPhrase.estimatedDocumentCount();
    if (retryCount > 0) return;
    throw e;
  }
}

async function loadRuntimeTreeFromDatabase() {
  if (mongoose.connection.readyState !== 1) {
    return ANCHOR_TREE;
  }
  await seedIfEmpty();
  const docs = await EmbeddingAnchorPhrase.find({ isActive: true })
    .sort({ detector: 1, category: 1, bucket: 1, order: 1, phrase: 1 })
    .lean();
  if (docs.length === 0) {
    return ANCHOR_TREE;
  }
  return buildTreeFromDocuments(docs);
}

function notifyEmbeddingCacheReload() {
  try {
    const { getEmbeddingAnchorService } = require('./embeddingAnchor.service');
    getEmbeddingAnchorService().forceReload();
  } catch (e) {
    logger.warn(`[EmbeddingAnchorPhrase] forceReload: ${e.message}`);
  }
}

function validatePayload(body, isUpdate = false) {
  const d = body.detector;
  if (!isUpdate) {
    if (!d || !body.bucket || !body.phrase || !String(body.phrase).trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'detector, bucket, and phrase are required');
    }
  } else if (body.phrase != null && !String(body.phrase).trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'phrase must not be empty');
  }

  const det = isUpdate && body.detector == null ? null : d || body.detector;
  if (det) {
    if (det === 'abuseNeglectDetector' && (body.category == null || body.category === '')) {
      if (!isUpdate) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'category is required for abuseNeglectDetector');
      }
    }
    if (det !== 'abuseNeglectDetector' && body.category) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'category must be null for this detector');
    }
    if (det === 'emergencyDetector' && !isUpdate) {
      if (!body.emergencySeverity) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'emergencySeverity is required for emergencyDetector');
      }
      if (!body.emergencyCategory || !String(body.emergencyCategory).trim()) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'emergencyCategory is required for emergencyDetector');
      }
    }
  }
}

async function listPhrases({ detector } = {}) {
  const q = {};
  if (detector) q.detector = detector;
  return EmbeddingAnchorPhrase.find(q)
    .sort({ detector: 1, category: 1, bucket: 1, order: 1, phrase: 1 })
    .lean();
}

async function createPhrase(data) {
  validatePayload({ ...data }, false);
  const doc = { ...data, phrase: data.phrase.trim() };
  if (doc.detector !== 'abuseNeglectDetector') {
    doc.category = null;
  }
  if (doc.detector === 'abuseNeglectDetector') {
    const maxOrder = await EmbeddingAnchorPhrase.findOne(
      { detector: doc.detector, category: doc.category, bucket: doc.bucket },
      { order: 1 }
    )
      .sort({ order: -1 })
      .lean();
    doc.order = maxOrder && typeof maxOrder.order === 'number' ? maxOrder.order + 1 : 0;
  } else {
    const maxOrder = await EmbeddingAnchorPhrase.findOne(
      { detector: doc.detector, bucket: doc.bucket, category: null },
      { order: 1 }
    )
      .sort({ order: -1 })
      .lean();
    doc.order = maxOrder && typeof maxOrder.order === 'number' ? maxOrder.order + 1 : 0;
  }
  try {
    const created = await EmbeddingAnchorPhrase.create(doc);
    notifyEmbeddingCacheReload();
    return created.toObject();
  } catch (e) {
    if (e.code === 11000) {
      throw new ApiError(httpStatus.CONFLICT, 'That phrase already exists in this bucket');
    }
    throw e;
  }
}

async function updatePhrase(id, data) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid id');
  }
  const existing = await EmbeddingAnchorPhrase.findById(id);
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Anchor phrase not found');
  }
  if (data.phrase != null && !String(data.phrase).trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'phrase must not be empty');
  }
  const nextDetector = data.detector != null ? data.detector : existing.detector;
  if (nextDetector === 'abuseNeglectDetector') {
    const cat = data.category !== undefined ? data.category : existing.category;
    if (!cat) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'category is required for abuseNeglectDetector');
    }
  }
  if (nextDetector === 'emergencyDetector' && (data.emergencySeverity != null || data.emergencyCategory != null)) {
    if (data.emergencyCategory != null && !String(data.emergencyCategory).trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'emergencyCategory must not be empty when set');
    }
  }
  const $set = { ...data };
  if ($set.phrase != null) $set.phrase = String($set.phrase).trim();
  const resultDetector = $set.detector != null ? $set.detector : existing.detector;
  if (resultDetector !== 'abuseNeglectDetector') {
    $set.category = null;
  }
  try {
    const updated = await EmbeddingAnchorPhrase.findByIdAndUpdate(id, { $set }, { new: true, runValidators: true }).lean();
    notifyEmbeddingCacheReload();
    return updated;
  } catch (e) {
    if (e.code === 11000) {
      throw new ApiError(httpStatus.CONFLICT, 'That phrase already exists in this bucket');
    }
    throw e;
  }
}

async function deletePhrase(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid id');
  }
  const res = await EmbeddingAnchorPhrase.findByIdAndDelete(id);
  if (!res) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Anchor phrase not found');
  }
  notifyEmbeddingCacheReload();
  return { deleted: true, id: String(res._id) };
}

/**
 * Re-insert defaults for any (detector, category, bucket, phrase) that is missing.
 * Does not remove custom phrases.
 */
async function mergeMissingFromDefaults() {
  if (mongoose.connection.readyState !== 1) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Database not available');
  }
  const want = buildSeedDocumentsFromDefaults();
  let added = 0;
  for (const row of want) {
    const q =
      row.detector === 'abuseNeglectDetector'
        ? { detector: row.detector, category: row.category, bucket: row.bucket, phrase: row.phrase }
        : { detector: row.detector, category: null, bucket: row.bucket, phrase: row.phrase };
    const ex = await EmbeddingAnchorPhrase.findOne(q);
    if (!ex) {
      await EmbeddingAnchorPhrase.create(row);
      added += 1;
    }
  }
  notifyEmbeddingCacheReload();
  return { merged: added };
}

module.exports = {
  buildTreeFromDocuments,
  buildSeedDocumentsFromDefaults,
  seedIfEmpty,
  loadRuntimeTreeFromDatabase,
  listPhrases,
  createPhrase,
  updatePhrase,
  deletePhrase,
  mergeMissingFromDefaults,
  notifyEmbeddingCacheReload,
};
