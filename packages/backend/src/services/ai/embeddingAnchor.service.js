// src/services/ai/embeddingAnchor.service.js
/**
 * Loads semantic anchor phrases once, embeds with text-embedding-3-large, caches vectors.
 * Used by abuse/neglect and financial exploitation detectors.
 */

const logger = require('../../config/logger');
const { getOpenAIApiKey } = require('../../utils/openaiApiKey');

const EMBEDDING_MODEL = 'text-embedding-3-large';

const THRESHOLD_STANDARD = 0.78;
const THRESHOLD_STRICT = 0.82;
/** Per-message hit counting in temporal trend analysis only (not warning firing). */
const THRESHOLD_TEMPORAL_ABUSE = 0.66;
const THRESHOLD_TEMPORAL_FINANCIAL = 0.72;

/** Abuse & neglect anchors (English — embeddings handle other languages at query time) */
const ABUSE_ANCHORS = {
  physical: {
    injuries: [
      'Someone hurt me physically',
      'I have injuries from someone hurting me',
      'I was hit, punched, or slapped by someone',
      'Someone grabbed or shoved me and I got hurt',
      'I have bruises or wounds from another person',
      'He hurt me',
      'She hurt me',
      'They hurt me',
      'I was hurt by someone',
      'He hit me',
      'She hit me',
      'I got hit',
      'He pushed me',
      'She pushed me',
    ],
    inconsistentExplanations: [
      'I am not sure how I got this injury',
      'I keep having accidents that I cannot explain',
      'I do not remember how I got hurt this time',
    ],
    fearOfPerson: [
      'I am afraid of the person who takes care of me',
      'The person who looks after me makes me feel unsafe',
      'I feel threatened by someone who is supposed to help me',
      'I am scared of someone I live with or depend on',
      "I'm scared of him",
      "I'm scared of her",
      'He scares me',
      'She scares me',
      "I'm afraid of him",
      "I'm afraid of her",
    ],
    punishment: [
      'I was punished by my caregiver',
      'They said I deserved what happened to me',
      'I was disciplined in a way that hurt me',
    ],
  },
  emotional: {
    isolation: [
      'I am not allowed to talk to my family or friends',
      'Someone is keeping me away from the people I care about',
      'I am forbidden from contacting certain people',
      "They won't let me speak to anyone outside the house",
      'I am not allowed to talk to my friends anymore',
      'I feel isolated and alone',
    ],
    control: [
      'Someone else makes all my decisions for me',
      'I am not allowed to make my own choices',
      'I need to ask permission before I do anything',
      'Someone controls everything I do',
      'They control everything I do',
      'I have to ask permission for everything',
    ],
    threats: [
      'Someone has threatened me',
      'I was told something bad would happen if I did not comply',
      'They threatened to take things away from me or hurt me',
      'I am being warned not to do something',
      'They threatened me',
    ],
    belittling: [
      'I am told I am stupid or worthless',
      'Someone constantly tells me I cannot do anything right',
      'I am made to feel like a burden to everyone around me',
      'The people around me treat me like I am incompetent',
      'I feel worthless',
      'He calls me stupid',
      'She calls me worthless',
      "They say I'm useless",
      "He says I'm a burden",
      "I'm told I'm worthless",
    ],
    fearLanguage: [
      'I am afraid to say the wrong thing to this person',
      'I feel like I am always walking on eggshells at home',
      'I do not want to upset the person who cares for me',
      'I am scared of making the person around me angry',
      'I am walking on eggshells',
      "I don't want to make him angry",
      "I don't want to make her angry",
      "I'm scared to say anything",
      "I'm afraid to speak up",
    ],
  },
  neglect: {
    basicNeeds: [
      'I have not had food or water today and no one is helping me',
      'I have been unable to take my medication because no one will get it for me',
      'I have no heat or basic necessities and no one is taking care of this',
      'I have not been able to bathe or get clean clothes and no one is helping',
    ],
    medicalCare: [
      'I cannot see a doctor even though I need one',
      'Someone is preventing me from getting medical care',
      'I have missed important medical appointments and cannot get help',
      'I need medical attention but no one will take me',
    ],
    isolation: [
      'No one comes to visit me or check on me',
      'I have been completely alone for days with no contact',
      'I feel abandoned by everyone who was supposed to care for me',
      'No one calls or comes to see me anymore',
    ],
    timeAlone: [
      'I have been left alone for days with no one checking on me',
      'The person who cares for me has been gone for a very long time',
      'I have been by myself for weeks with no support',
    ],
  },
};

const FINANCIAL_ANCHORS = {
  transferMethods: [
    'Someone is asking me to send money by wire transfer',
    'I was told to pay using gift cards or prepaid cards',
    'Someone wants me to send money through Western Union or MoneyGram',
    'I am being asked to send cryptocurrency or Bitcoin',
    'Someone is asking me to use Venmo, Zelle, or Cash App to send them money',
  ],
  scamIndicators: [
    'Someone told me I won a prize or lottery and need to pay a fee to collect it',
    'Someone claiming to be from the IRS or Social Security is threatening me',
    'I received a call saying I have an arrest warrant and must pay immediately',
    'Someone told me I have unclaimed inheritance money waiting for me',
    'A tech support person called and said my computer has a virus and needs payment',
    'Someone claiming to be from Microsoft or Apple asked me for money or access',
    'I was told my government benefits are suspended and I need to verify my information',
  ],
  urgencyLanguage: [
    'I was told I must send money today or something terrible will happen',
    'Someone told me not to tell my family about this financial arrangement',
    'I am being pressured to act immediately before it is too late',
    'I was told to keep this payment completely secret from everyone I know',
    'Someone said this is my last chance and I must decide right now',
  ],
  helpRequests: [
    'Someone is asking me to give them or lend them money',
    'Someone I know is asking me to send them emergency funds',
    'I am being asked to help someone with their financial problems by sending money',
  ],
  relationshipMoney: [
    'A new person I met is asking me to send them money',
    'Someone I recently became friends with needs me to transfer money to them',
    'A person I met online is asking me for financial help',
    'Someone I do not know well is pressuring me to give them money',
  ],
};

function normalize(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function maxCosineToAnchors(queryNorm, anchorNorms) {
  let max = -1;
  for (let i = 0; i < anchorNorms.length; i++) {
    const c = cosineSimilarity(queryNorm, anchorNorms[i]);
    if (c > max) max = c;
  }
  return max;
}

/**
 * Map similarity in [threshold, 1] to roughly 0–100 for downstream weighted formulas.
 */
function similarityToSubScore(sim, threshold) {
  if (sim < threshold) return 0;
  return Math.min(100, ((sim - threshold) / (1 - threshold)) * 100);
}

class EmbeddingAnchorService {
  constructor() {
    this.ready = false;
    this.initPromise = null;
    this.abuseVectors = { physical: {}, emotional: {}, neglect: {} };
    this.financialVectors = {};
    /** Flattened abuse anchors for temporal embedding (all buckets) */
    this._abuseAllNorms = [];
    /** Financial embedding buckets union for temporal (excludes help for stability) */
    this._financialTemporalNorms = [];
  }

  isConfigured() {
    return !!getOpenAIApiKey();
  }

  async ensureInitialized() {
    if (this.ready) return;
    if (!this.isConfigured()) {
      logger.warn('[EmbeddingAnchor] OpenAI API key not configured — abuse/financial embedding detection disabled');
      this.ready = true;
      return;
    }
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._loadAllEmbeddings();
    await this.initPromise;
    this.ready = true;
  }

  async _embedBatch(texts) {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: getOpenAIApiKey() });
    const BATCH = 100;
    const all = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const chunk = texts.slice(i, i + BATCH);
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunk,
      });
      const ordered = [...res.data].sort((a, b) => a.index - b.index);
      for (let j = 0; j < ordered.length; j++) {
        all.push(ordered[j].embedding);
      }
    }
    return all.map(normalize);
  }

  async _loadAllEmbeddings() {
    try {
      const abuseTexts = [];
      const abuseMeta = [];

      for (const [domain, buckets] of Object.entries(ABUSE_ANCHORS)) {
        for (const [bucket, phrases] of Object.entries(buckets)) {
          for (const p of phrases) {
            abuseTexts.push(p);
            abuseMeta.push({ domain, bucket });
          }
        }
      }

      const finTexts = [];
      const finMeta = [];
      for (const [bucket, phrases] of Object.entries(FINANCIAL_ANCHORS)) {
        for (const p of phrases) {
          finTexts.push(p);
          finMeta.push({ bucket });
        }
      }

      const [abuseNorms, finNorms] = await Promise.all([
        this._embedBatch(abuseTexts),
        this._embedBatch(finTexts),
      ]);

      for (let i = 0; i < abuseMeta.length; i++) {
        const { domain, bucket } = abuseMeta[i];
        if (!this.abuseVectors[domain][bucket]) this.abuseVectors[domain][bucket] = [];
        this.abuseVectors[domain][bucket].push(abuseNorms[i]);
      }

      this._abuseAllNorms = abuseNorms;

      for (let i = 0; i < finMeta.length; i++) {
        const { bucket } = finMeta[i];
        if (!this.financialVectors[bucket]) this.financialVectors[bucket] = [];
        this.financialVectors[bucket].push(finNorms[i]);
      }

      // Temporal trend = max sim vs union of transfer + scam + urgency + relationship (romance-scam escalation)
      const temporalBuckets = ['transferMethods', 'scamIndicators', 'urgencyLanguage', 'relationshipMoney'];
      this._financialTemporalNorms = [];
      for (const b of temporalBuckets) {
        if (this.financialVectors[b]) {
          this._financialTemporalNorms.push(...this.financialVectors[b]);
        }
      }

      logger.info(
        `[EmbeddingAnchor] Loaded ${abuseTexts.length} abuse + ${finTexts.length} financial anchor embeddings (${EMBEDDING_MODEL})`
      );
    } catch (e) {
      logger.error('[EmbeddingAnchor] Failed to load embeddings:', e.message);
      throw e;
    }
  }

  async embedQuery(text) {
    await this.ensureInitialized();
    if (!this.isConfigured() || !text || !text.trim()) return null;
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: getOpenAIApiKey() });
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    return normalize(res.data[0].embedding);
  }

  /** Batch embed for temporal analysis. Empty strings → null (no API call for that slot). */
  async embedQueries(texts) {
    await this.ensureInitialized();
    if (!this.isConfigured() || !texts.length) {
      return texts.map(() => null);
    }
    const results = texts.map(() => null);
    const indices = [];
    const payloads = [];
    texts.forEach((t, i) => {
      const s = t && String(t).trim() ? String(t).trim().slice(0, 8000) : '';
      if (s) {
        indices.push(i);
        payloads.push(s);
      }
    });
    if (!payloads.length) return results;

    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: getOpenAIApiKey() });
    const BATCH = 50;
    let offset = 0;
    while (offset < payloads.length) {
      const chunk = payloads.slice(offset, offset + BATCH);
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunk,
      });
      const ordered = [...res.data].sort((a, b) => a.index - b.index);
      for (let j = 0; j < ordered.length; j++) {
        results[indices[offset + j]] = normalize(ordered[j].embedding);
      }
      offset += BATCH;
    }
    return results;
  }

  /**
   * Max cosine per abuse bucket. Keys: physical.*, emotional.*, neglect.*
   */
  getAbuseBucketSimilarities(queryNorm) {
    if (!queryNorm || !this._abuseAllNorms.length) return null;
    const out = { physical: {}, emotional: {}, neglect: {} };
    for (const domain of ['physical', 'emotional', 'neglect']) {
      for (const [bucket, norms] of Object.entries(this.abuseVectors[domain] || {})) {
        out[domain][bucket] = maxCosineToAnchors(queryNorm, norms);
      }
    }
    return out;
  }

  maxSimilarityToAllAbuseAnchors(queryNorm) {
    if (!queryNorm || !this._abuseAllNorms.length) return 0;
    return maxCosineToAnchors(queryNorm, this._abuseAllNorms);
  }

  /**
   * Raw max cosine per financial embedding bucket (before gating).
   */
  getFinancialBucketSimilarities(queryNorm) {
    if (!queryNorm) return null;
    const out = {};
    for (const bucket of Object.keys(FINANCIAL_ANCHORS)) {
      const norms = this.financialVectors[bucket] || [];
      out[bucket] = norms.length ? maxCosineToAnchors(queryNorm, norms) : 0;
    }
    return out;
  }

  maxSimilarityFinancialTemporal(queryNorm) {
    if (!queryNorm || !this._financialTemporalNorms.length) return 0;
    return maxCosineToAnchors(queryNorm, this._financialTemporalNorms);
  }

  hasAbuseEmbeddings() {
    return this._abuseAllNorms.length > 0;
  }

  hasFinancialEmbeddings() {
    return Object.keys(this.financialVectors).length > 0;
  }
}

const embeddingAnchorService = new EmbeddingAnchorService();

module.exports = {
  embeddingAnchorService,
  EmbeddingAnchorService,
  ABUSE_ANCHORS,
  FINANCIAL_ANCHORS,
  THRESHOLD_STANDARD,
  THRESHOLD_STRICT,
  THRESHOLD_TEMPORAL_ABUSE,
  THRESHOLD_TEMPORAL_FINANCIAL,
  similarityToSubScore,
  EMBEDDING_MODEL,
};
