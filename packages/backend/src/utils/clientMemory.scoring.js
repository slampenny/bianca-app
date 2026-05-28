const crypto = require('crypto');

const PROVISIONAL_THRESHOLD = 0.45;
const ACTIVE_THRESHOLD = 0.55;
const HIGH_SENSITIVITY_THRESHOLD = 0.65;
const REINFORCEMENT_BOOST = 0.08;
const MAX_CONFIDENCE = 0.95;
const ACTIVATION_REINFORCEMENT_COUNT = 2;
const NEW_FACT_SCORE_CAP = 0.5;

const UNSAFE_FACT_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /\byou\s+must\b/i,
  /assistant\s+should/i,
  /\boverride\b/i,
  /\bjailbreak\b/i,
  /do\s+not\s+follow/i,
];

const HALF_LIFE_BY_CATEGORY = {
  mood: 14,
  concern: 14,
  health: 60,
  cognitive: 30,
  safety: 90,
  preference: 180,
  relationship: 180,
  life_event: 90,
  general: 60,
};

const CATEGORY_PRIORITY = {
  urgent: 100,
  safety: 90,
  concern: 80,
  health: 75,
  mood: 70,
  cognitive: 65,
  life_event: 50,
  relationship: 45,
  preference: 40,
  general: 30,
};

const normalizeFactText = (fact) => {
  if (!fact || typeof fact !== 'string') return '';
  return fact
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'-]/g, '');
};

const buildNormalizedKey = (category, fact) => {
  const normalized = normalizeFactText(fact);
  const raw = `${category || 'general'}:${normalized}`;
  if (raw.length <= 200) return raw;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
};

const mapConfidenceToScore = (confidence) => {
  if (confidence === 'high') return 0.85;
  if (confidence === 'low') return 0.35;
  return 0.55;
};

const inferSensitivity = (category, priority) => {
  if (priority === 'urgent') return 'high';
  if (['health', 'safety', 'cognitive'].includes(category)) return 'elevated';
  return 'normal';
};

const getDefaultDecayPolicy = (category, sensitivity = 'normal') => {
  let halfLifeDays = HALF_LIFE_BY_CATEGORY[category] || HALF_LIFE_BY_CATEGORY.general;
  if (sensitivity === 'high') {
    halfLifeDays = Math.min(halfLifeDays, 30);
  }
  const minConfidence = sensitivity === 'high' ? HIGH_SENSITIVITY_THRESHOLD : PROVISIONAL_THRESHOLD;
  return { halfLifeDays, minConfidence };
};

const computeExpiresAt = (fromDate, decayPolicy) => {
  const halfLifeDays = decayPolicy?.halfLifeDays || HALF_LIFE_BY_CATEGORY.general;
  return new Date(fromDate.getTime() + halfLifeDays * 24 * 60 * 60 * 1000);
};

const scoreFact = (fact, now = new Date()) => {
  const observedAt = fact.lastObservedAt || fact.extractedAt || fact.createdAt || now;
  const observed = observedAt instanceof Date ? observedAt : new Date(observedAt);
  const ageDays = Math.max(0, (now.getTime() - observed.getTime()) / (24 * 60 * 60 * 1000));
  const halfLifeDays = fact.decayPolicy?.halfLifeDays || HALF_LIFE_BY_CATEGORY[fact.category] || 60;
  const timeDecay = Math.exp(-ageDays / halfLifeDays);
  const reinforcementBoost = 1 + 0.05 * Math.min(Math.max((fact.reinforcementCount || 1) - 1, 0), 5);
  const contradictionPenalty = 1 - 0.15 * Math.min(fact.contradictionCount || 0, 3);
  const baseScore = fact.confidenceScore ?? mapConfidenceToScore(fact.confidence);
  return Math.max(0, Math.min(1, baseScore * timeDecay * reinforcementBoost * contradictionPenalty));
};

const isUnsafeFactText = (fact) => {
  if (!fact || typeof fact !== 'string') return true;
  return UNSAFE_FACT_PATTERNS.some((pattern) => pattern.test(fact));
};

const hydrateFact = (fact) => {
  if (!fact) return fact;
  const sensitivity = fact.sensitivity || inferSensitivity(fact.category, fact.priority);
  return {
    ...fact,
    status: fact.status || 'active',
    confidenceScore: fact.confidenceScore ?? mapConfidenceToScore(fact.confidence),
    reinforcementCount: fact.reinforcementCount ?? 1,
    contradictionCount: fact.contradictionCount ?? 0,
    sensitivity,
    decayPolicy: fact.decayPolicy || getDefaultDecayPolicy(fact.category, sensitivity),
    normalizedKey: fact.normalizedKey || buildNormalizedKey(fact.category, fact.fact),
    firstObservedAt: fact.firstObservedAt || fact.extractedAt || fact.createdAt,
    lastObservedAt: fact.lastObservedAt || fact.extractedAt || fact.createdAt,
  };
};

const getCategorySortPriority = (fact) => {
  if (fact.priority === 'urgent') return CATEGORY_PRIORITY.urgent;
  return CATEGORY_PRIORITY[fact.category] || CATEGORY_PRIORITY.general;
};

const shouldActivate = (reinforcementCount, confidenceScore) =>
  reinforcementCount >= ACTIVATION_REINFORCEMENT_COUNT || confidenceScore >= ACTIVE_THRESHOLD;

/**
 * Minimum effective score required for prompt retrieval.
 * Active urgent facts use a lower bar than other high-sensitivity memory.
 */
const getRetrievalMinConfidence = (fact) => {
  if (fact.priority === 'urgent' && fact.status === 'active') {
    return ACTIVE_THRESHOLD;
  }
  if (fact.sensitivity === 'high') {
    return HIGH_SENSITIVITY_THRESHOLD;
  }
  return fact.decayPolicy?.minConfidence || PROVISIONAL_THRESHOLD;
};

module.exports = {
  PROVISIONAL_THRESHOLD,
  ACTIVE_THRESHOLD,
  HIGH_SENSITIVITY_THRESHOLD,
  REINFORCEMENT_BOOST,
  MAX_CONFIDENCE,
  ACTIVATION_REINFORCEMENT_COUNT,
  NEW_FACT_SCORE_CAP,
  normalizeFactText,
  buildNormalizedKey,
  mapConfidenceToScore,
  inferSensitivity,
  getDefaultDecayPolicy,
  computeExpiresAt,
  scoreFact,
  isUnsafeFactText,
  hydrateFact,
  getCategorySortPriority,
  shouldActivate,
  getRetrievalMinConfidence,
};
