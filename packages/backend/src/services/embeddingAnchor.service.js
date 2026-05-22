/**
 * Embedding-based anchor similarity for emergency, abuse/neglect, financial, and relationship-pattern detectors.
 * Phrase text is stored in Mongo (EmbeddingAnchorPhrase), seeded from defaults when empty; editable via admin API.
 * Uses OpenAI text-embedding-3-large; callers must await initialize() before use.
 */
const mongoose = require('mongoose');
const { getOpenAIConstructor } = require('../utils/openaiSdk');
const OpenAI = getOpenAIConstructor();
const logger = require('../config/logger');
const config = require('../config/config');
const {
  ANCHOR_TREE,
  flattenListFromTree,
  countUniquePhrasesInTree,
  flattenPhraseList,
  countUniquePhrases,
} = require('../config/embeddingAnchor.defaults');

const EMBEDDING_MODEL = 'text-embedding-3-large';

function hasEmbeddingsApi(client) {
  return Boolean(client?.embeddings?.create);
}

/** Stricter similarity for high-FP neglect buckets (embedding similarity) */
const ABUSE_HIGH_FP_BUCKETS = {
  basicNeeds: 0.82,
  medicalCare: 0.82,
};

/**
 * Cosine similarity for equal-length number arrays.
 */
function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

class EmbeddingAnchorService {
  constructor() {
    this.openai = null;
    this.initialized = false;
    /** phrase -> Float32Array or number[] */
    this.phraseVectors = new Map();
    /** resolved at initialize from DB or defaults */
    this._runtimeTree = null;
    this._flatList = null;
    this.totalUniquePhrases = countUniquePhrases();
  }

  getTree() {
    return this._runtimeTree != null ? this._runtimeTree : ANCHOR_TREE;
  }

  getOpenAI() {
    if (!this.openai && config.openai?.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.openai;
  }

  /**
   * Clear cached vectors and runtime tree so the next initialize() reloads from DB/defaults.
   */
  forceReload() {
    this.initialized = false;
    this.phraseVectors.clear();
    this._runtimeTree = null;
    this._flatList = null;
    this.totalUniquePhrases = countUniquePhrases();
  }

  /**
   * Embed arbitrary text (e.g. user utterance) for similarity search.
   */
  async embedText(text) {
    const client = this.getOpenAI();
    if (!hasEmbeddingsApi(client) || !text?.trim()) return null;
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim().slice(0, 8000),
    });
    return res.data[0].embedding;
  }

  async initialize() {
    if (this.initialized) return;

    const phraseMod = require('./embeddingAnchorPhrase.service');
    if (mongoose.connection.readyState === 1) {
      try {
        await phraseMod.seedIfEmpty();
        this._runtimeTree = await phraseMod.loadRuntimeTreeFromDatabase();
      } catch (e) {
        logger.error(`[EmbeddingAnchor] Failed to load phrases from DB, using static defaults: ${e.message}`);
        this._runtimeTree = ANCHOR_TREE;
      }
    } else {
      this._runtimeTree = ANCHOR_TREE;
    }

    this._flatList = flattenListFromTree(this._runtimeTree);

    const client = this.getOpenAI();
    if (!hasEmbeddingsApi(client)) {
      const reason = client
        ? 'OpenAI client missing embeddings API'
        : 'OpenAI not configured';
      logger.warn(`[EmbeddingAnchor] ${reason}; anchor embeddings unavailable`);
      this.totalUniquePhrases = countUniquePhrasesInTree(this._runtimeTree);
      this.initialized = true;
      return;
    }

    const unique = [...new Set(this._flatList.map((x) => x.phrase))];
    for (const phrase of unique) {
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: phrase,
      });
      this.phraseVectors.set(phrase, res.data[0].embedding);
    }
    this.totalUniquePhrases = unique.length;
    this.initialized = true;
    logger.info(`[EmbeddingAnchor] Initialized ${unique.length} unique anchor embeddings`);
  }

  /**
   * @returns {{ phrase: string, vector: number[] }[]}
   */
  getAnchors(detectorName, category, bucket) {
    const tree = this.getTree();
    const out = [];
    if (detectorName === 'abuseNeglectDetector') {
      const phrases = tree.abuseNeglectDetector[category]?.[bucket] || [];
      phrases.forEach((phrase) => {
        const vector = this.phraseVectors.get(phrase);
        if (vector) out.push({ phrase, vector });
      });
      return out;
    }
    if (detectorName === 'emergencyDetector') {
      const block = tree.emergencyDetector[bucket];
      if (!block) return [];
      block.phrases.forEach((phrase) => {
        const vector = this.phraseVectors.get(phrase);
        if (vector) out.push({ phrase, vector });
      });
      return out;
    }
    if (detectorName === 'financialExploitationDetector') {
      const list = tree.financialExploitationDetector[bucket] || [];
      list.forEach((phrase) => {
        const vector = this.phraseVectors.get(phrase);
        if (vector) out.push({ phrase, vector });
      });
      return out;
    }
    if (detectorName === 'relationshipPatternDetector') {
      const list = tree.relationshipPatternDetector[bucket] || [];
      list.forEach((phrase) => {
        const vector = this.phraseVectors.get(phrase);
        if (vector) out.push({ phrase, vector });
      });
      return out;
    }
    return out;
  }

  getMatchingBuckets(queryVector, detectorName, baseThreshold = 0.78) {
    if (!queryVector) return [];
    const scores = this._scoreAllBucketsInternal(queryVector, detectorName);
    const matched = [];
    Object.entries(scores).forEach(([bucket, sim]) => {
      let t = baseThreshold;
      if (detectorName === 'abuseNeglectDetector' && ABUSE_HIGH_FP_BUCKETS[bucket] != null) {
        t = ABUSE_HIGH_FP_BUCKETS[bucket];
      }
      if (sim >= t) matched.push(bucket);
    });
    return matched;
  }

  getBucketScores(queryVector, detectorName) {
    return this._scoreAllBucketsInternal(queryVector, detectorName);
  }

  _scoreAllBucketsInternal(queryVector, detectorName) {
    const tree = this.getTree();
    const scores = {};
    if (detectorName === 'emergencyDetector') {
      Object.keys(tree.emergencyDetector).forEach((bucket) => {
        const anchors = this.getAnchors('emergencyDetector', null, bucket);
        scores[bucket] = this._maxSim(queryVector, anchors);
      });
      return scores;
    }
    if (detectorName === 'abuseNeglectDetector') {
      const abuse = tree.abuseNeglectDetector;
      Object.keys(abuse).forEach((cat) => {
        Object.keys(abuse[cat]).forEach((bucket) => {
          const anchors = this.getAnchors('abuseNeglectDetector', cat, bucket);
          scores[bucket] = this._maxSim(queryVector, anchors);
        });
      });
      return scores;
    }
    if (detectorName === 'financialExploitationDetector') {
      Object.keys(tree.financialExploitationDetector).forEach((bucket) => {
        const anchors = this.getAnchors('financialExploitationDetector', null, bucket);
        scores[bucket] = this._maxSim(queryVector, anchors);
      });
      return scores;
    }
    if (detectorName === 'relationshipPatternDetector') {
      Object.keys(tree.relationshipPatternDetector).forEach((bucket) => {
        const anchors = this.getAnchors('relationshipPatternDetector', null, bucket);
        scores[bucket] = this._maxSim(queryVector, anchors);
      });
      return scores;
    }
    return scores;
  }

  _maxSim(queryVector, anchorRows) {
    let max = 0;
    anchorRows.forEach(({ vector }) => {
      const s = cosineSimilarity(queryVector, vector);
      if (s > max) max = s;
    });
    return max;
  }

  async scoreAgainstAllBuckets(text) {
    await this.initialize();
    const q = await this.embedText(text);
    if (!q) return {};
    const emergency = this._scoreAllBucketsInternal(q, 'emergencyDetector');
    const abuse = this._scoreAllBucketsInternal(q, 'abuseNeglectDetector');
    const fin = this._scoreAllBucketsInternal(q, 'financialExploitationDetector');
    const rel = this._scoreAllBucketsInternal(q, 'relationshipPatternDetector');
    return { ...emergency, ...abuse, ...fin, ...rel };
  }

  getEmergencyMetaForBucket(bucketKey) {
    const b = this.getTree().emergencyDetector[bucketKey];
    if (!b) return { severity: 'HIGH', category: 'medical_emergency', matchedPhrase: 'emergency similarity' };
    return {
      severity: b.severity,
      category: b.category,
      matchedPhrase: b.phrases[0] || 'emergency',
    };
  }

  getHighestSeverityEmergencyBucket(matchedBuckets) {
    const order = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
    const tree = this.getTree();
    let best = null;
    let bestScore = -1;
    matchedBuckets.forEach((bk) => {
      const meta = tree.emergencyDetector[bk];
      if (!meta) return;
      const s = order[meta.severity] || 0;
      if (s > bestScore) {
        bestScore = s;
        best = bk;
      }
    });
    if (!best) return this.getEmergencyMetaForBucket(matchedBuckets[0]);
    const m = tree.emergencyDetector[best];
    return {
      severity: m.severity,
      category: m.category,
      matchedPhrase: m.phrases[0],
    };
  }
}

let singleton = null;
function getEmbeddingAnchorService() {
  if (!singleton) {
    // Runtime self-require so Jest can substitute EmbeddingAnchorService with a mock (partial mock does not
    // replace the constructor reference used by lexical new EmbeddingAnchorService in this file).
    const { EmbeddingAnchorService: Ctor } = require('./embeddingAnchor.service');
    singleton = new Ctor();
  }
  return singleton;
}

/** Test-only: clears singleton so Jest mocks of EmbeddingAnchorService apply to the next getEmbeddingAnchorService(). */
function resetEmbeddingAnchorServiceForTests() {
  singleton = null;
}

module.exports = {
  EmbeddingAnchorService,
  getEmbeddingAnchorService,
  resetEmbeddingAnchorServiceForTests,
  cosineSimilarity,
  ANCHOR_TREE,
  countUniquePhrases,
  flattenPhraseList,
  ABUSE_HIGH_FP_BUCKETS,
};
