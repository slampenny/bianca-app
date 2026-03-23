/**
 * Embedding-based anchor similarity for emergency, abuse/neglect, and financial detectors.
 * Uses OpenAI text-embedding-3-large; callers must await initialize() before use.
 */
const { getOpenAIConstructor } = require('../utils/openaiSdk');
const OpenAI = getOpenAIConstructor();
const logger = require('../config/logger');
const config = require('../config/config');

const EMBEDDING_MODEL = 'text-embedding-3-large';

/** Stricter similarity for high-FP neglect buckets (embedding similarity) */
const ABUSE_HIGH_FP_BUCKETS = {
  basicNeeds: 0.82,
  medicalCare: 0.82,
};

/**
 * Flat anchor phrases per detector / bucket. Embeddings are computed per unique phrase at init.
 */
const ANCHOR_TREE = {
  emergencyDetector: {
    medical_emergency: {
      severity: 'CRITICAL',
      category: 'medical_emergency',
      phrases: [
        'heart attack',
        'myocardial infarction',
        'having a heart attack',
        'stroke right now',
        'severe stroke',
        'cannot breathe emergency',
        'overdose',
        'severe chest pain',
        'crushing chest pain',
      ],
    },
    breathing: {
      severity: 'CRITICAL',
      category: 'medical_emergency',
      phrases: ["can't breathe", 'cannot breathe', 'choking', 'not getting air'],
    },
    self_harm: {
      severity: 'CRITICAL',
      category: 'self_harm',
      phrases: [
        'kill myself',
        'want to die',
        'end my life',
        'suicide',
        'hurt myself on purpose',
        'self harm',
      ],
    },
    physical_acute: {
      severity: 'HIGH',
      category: 'physical_acute',
      phrases: [
        'fell and cannot get up',
        'severe pain right now',
        'unbearable pain',
        'bleeding heavily',
        'passed out',
      ],
    },
    request_urgent: {
      severity: 'MEDIUM',
      category: 'Request',
      phrases: ['call 911 now', 'need an ambulance immediately', 'emergency help right now'],
    },
    third_party_emergency: {
      severity: 'HIGH',
      category: 'medical_emergency',
      phrases: [
        'someone collapsed',
        'roommate not breathing',
        'person next to me unconscious',
        'they are having a heart attack',
      ],
    },
    passive_ideation: {
      severity: 'HIGH',
      category: 'self_harm',
      phrases: [
        'wish I was dead',
        'no point living',
        'better off dead',
        'thoughts of hurting myself',
      ],
    },
  },
  abuseNeglectDetector: {
    physical: {
      injuries: ['hit me', 'slapped me', 'bruises on my arms', 'someone hurt me'],
      fearOfPerson: ['afraid of the aide', 'scared when they come in'],
      punishment: ['punished me', 'taught me a lesson'],
    },
    emotional: {
      emotionalIsolation: ['not allowed to call my daughter', 'forbidden to leave'],
      control: ['controls everything I do', 'won’t let me choose'],
      threats: ['threatened me', 'said they would hurt me'],
      belittling: ['worthless', 'stupid', 'burden to everyone'],
      fearLanguage: ['walking on eggshells', 'afraid to speak'],
    },
    neglect: {
      basicNeeds: [
        'no food for two days',
        'left hungry',
        'no water',
        'no heat in winter',
      ],
      medicalCare: [
        'cannot see a doctor',
        'missed all my medications',
        'no medical care',
      ],
      neglectIsolation: ['no one visits', 'abandoned here'],
      timeAlone: ['alone for weeks', 'no staff for hours'],
    },
  },
  financialExploitationDetector: {
    scamIndicators: [
      'irs demanding payment in gift cards',
      'you won the lottery send fee',
      'grandchild in jail wire money',
      'social security number verify now',
    ],
    urgencyLanguage: [
      'act now or lose everything',
      'do not tell anyone',
      'deadline today only',
      'urgent send money immediately',
    ],
    transferMethods: [
      'wire transfer to this account',
      'buy gift cards and read numbers',
      'bitcoin wallet address',
      'western union payment',
    ],
    helpRequests: [
      'lend me five thousand dollars',
      'need emergency loan today',
      'borrow money from your account',
    ],
    largeAmounts: [
      'send ten thousand dollars',
      'fifty thousand dollar wire',
    ],
    relationshipMoney: [
      'new friend online needs money',
      'person I met asked me to send cash',
    ],
  },
};

function flattenPhraseList() {
  const list = [];
  const emergency = ANCHOR_TREE.emergencyDetector;
  Object.keys(emergency).forEach((bucket) => {
    emergency[bucket].phrases.forEach((p) => list.push({ detector: 'emergencyDetector', bucket, phrase: p }));
  });
  const abuse = ANCHOR_TREE.abuseNeglectDetector;
  Object.keys(abuse).forEach((cat) => {
    Object.keys(abuse[cat]).forEach((bucket) => {
      abuse[cat][bucket].forEach((p) =>
        list.push({ detector: 'abuseNeglectDetector', category: cat, bucket, phrase: p })
      );
    });
  });
  const fin = ANCHOR_TREE.financialExploitationDetector;
  Object.keys(fin).forEach((bucket) => {
    fin[bucket].forEach((p) => list.push({ detector: 'financialExploitationDetector', bucket, phrase: p }));
  });
  return list;
}

function countUniquePhrases() {
  const seen = new Set();
  flattenPhraseList().forEach((x) => seen.add(x.phrase));
  return seen.size;
}

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
    /** detector -> bucketKey -> max phrase list (for getAnchors) */
    this._flatList = flattenPhraseList();
    this.totalUniquePhrases = countUniquePhrases();
  }

  getOpenAI() {
    if (!this.openai && config.openai?.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.openai;
  }

  /**
   * Embed arbitrary text (e.g. user utterance) for similarity search.
   */
  async embedText(text) {
    const client = this.getOpenAI();
    if (!client || !text?.trim()) return null;
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim().slice(0, 8000),
    });
    return res.data[0].embedding;
  }

  async initialize() {
    if (this.initialized) return;
    const client = this.getOpenAI();
    if (!client) {
      logger.warn('[EmbeddingAnchor] OpenAI not configured; anchor embeddings unavailable');
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
    this.initialized = true;
    logger.info(`[EmbeddingAnchor] Initialized ${unique.length} unique anchor embeddings`);
  }

  /**
   * @returns {{ phrase: string, vector: number[] }[]}
   */
  getAnchors(detectorName, category, bucket) {
    const out = [];
    if (detectorName === 'abuseNeglectDetector') {
      const phrases = ANCHOR_TREE.abuseNeglectDetector[category]?.[bucket] || [];
      phrases.forEach((phrase) => {
        const vector = this.phraseVectors.get(phrase);
        if (vector) out.push({ phrase, vector });
      });
      return out;
    }
    if (detectorName === 'emergencyDetector') {
      const block = ANCHOR_TREE.emergencyDetector[bucket];
      if (!block) return [];
      block.phrases.forEach((phrase) => {
        const vector = this.phraseVectors.get(phrase);
        if (vector) out.push({ phrase, vector });
      });
      return out;
    }
    const list = ANCHOR_TREE.financialExploitationDetector[bucket] || [];
    list.forEach((phrase) => {
      const vector = this.phraseVectors.get(phrase);
      if (vector) out.push({ phrase, vector });
    });
    return out;
  }

  /**
   * Max cosine similarity between query vector and all anchor vectors in each bucket.
   * @returns string[] bucket keys meeting threshold rules
   */
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

  /**
   * Exposed for detectors / tests: raw max cosine per bucket name.
   */
  getBucketScores(queryVector, detectorName) {
    return this._scoreAllBucketsInternal(queryVector, detectorName);
  }

  _scoreAllBucketsInternal(queryVector, detectorName) {
    const scores = {};
    if (detectorName === 'emergencyDetector') {
      Object.keys(ANCHOR_TREE.emergencyDetector).forEach((bucket) => {
        const anchors = this.getAnchors('emergencyDetector', null, bucket);
        scores[bucket] = this._maxSim(queryVector, anchors);
      });
      return scores;
    }
    if (detectorName === 'abuseNeglectDetector') {
      const abuse = ANCHOR_TREE.abuseNeglectDetector;
      Object.keys(abuse).forEach((cat) => {
        Object.keys(abuse[cat]).forEach((bucket) => {
          const anchors = this.getAnchors('abuseNeglectDetector', cat, bucket);
          scores[bucket] = this._maxSim(queryVector, anchors);
        });
      });
      return scores;
    }
    if (detectorName === 'financialExploitationDetector') {
      Object.keys(ANCHOR_TREE.financialExploitationDetector).forEach((bucket) => {
        const anchors = this.getAnchors('financialExploitationDetector', null, bucket);
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

  /**
   * Per-bucket max similarity scores for tuning (manual script).
   */
  async scoreAgainstAllBuckets(text) {
    await this.initialize();
    const q = await this.embedText(text);
    if (!q) return {};
    const emergency = this._scoreAllBucketsInternal(q, 'emergencyDetector');
    const abuse = this._scoreAllBucketsInternal(q, 'abuseNeglectDetector');
    const fin = this._scoreAllBucketsInternal(q, 'financialExploitationDetector');
    return { ...emergency, ...abuse, ...fin };
  }

  getEmergencyMetaForBucket(bucketKey) {
    const b = ANCHOR_TREE.emergencyDetector[bucketKey];
    if (!b) return { severity: 'HIGH', category: 'medical_emergency', matchedPhrase: 'emergency similarity' };
    return {
      severity: b.severity,
      category: b.category,
      matchedPhrase: b.phrases[0] || 'emergency',
    };
  }

  /** Pick highest severity bucket from matched bucket names */
  getHighestSeverityEmergencyBucket(matchedBuckets) {
    const order = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
    let best = null;
    let bestScore = -1;
    matchedBuckets.forEach((bk) => {
      const meta = ANCHOR_TREE.emergencyDetector[bk];
      if (!meta) return;
      const s = order[meta.severity] || 0;
      if (s > bestScore) {
        bestScore = s;
        best = bk;
      }
    });
    if (!best) return this.getEmergencyMetaForBucket(matchedBuckets[0]);
    const m = ANCHOR_TREE.emergencyDetector[best];
    return {
      severity: m.severity,
      category: m.category,
      matchedPhrase: m.phrases[0],
    };
  }
}

module.exports = {
  EmbeddingAnchorService,
  cosineSimilarity,
  ANCHOR_TREE,
  countUniquePhrases,
  flattenPhraseList,
  ABUSE_HIGH_FP_BUCKETS,
};
