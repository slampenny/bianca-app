/**
 * Two-stage emergency check: embedding similarity to anchors, then LLM tense (current / past / hypothetical).
 */
const { getOpenAIConstructor } = require('../utils/openaiSdk');
const OpenAI = getOpenAIConstructor();
const logger = require('../config/logger');
const config = require('../config/config');
const { EmbeddingAnchorService } = require('./embeddingAnchor.service');

let embeddingServiceSingleton = null;
function getEmbeddingService() {
  if (!embeddingServiceSingleton) embeddingServiceSingleton = new EmbeddingAnchorService();
  return embeddingServiceSingleton;
}

function getOpenAI() {
  if (!config.openai?.apiKey) return null;
  return new OpenAI({ apiKey: config.openai.apiKey });
}

const TENSE_MODEL = 'gpt-4.1-mini';

/**
 * @returns {Promise<'current'|'past'|'hypothetical'|'third_party'>}
 */
async function runTenseCheck(openai, text) {
  const response = await openai.chat.completions.create({
    model: TENSE_MODEL,
    temperature: 0,
    max_tokens: 20,
    messages: [
      {
        role: 'system',
        content: `Classify the client's utterance for emergency triage. Reply with exactly one word:
- current: happening now / imminent danger / needs help now
- past: happened before, narrative, memory
- hypothetical: if-then, fiction, "what would I do"
- third_party: emergency affecting someone else only with no personal danger`,
      },
      { role: 'user', content: text.slice(0, 4000) },
    ],
  });
  const raw = response.choices[0]?.message?.content?.trim().toLowerCase() || '';
  if (raw.includes('current')) return 'current';
  if (raw.includes('past')) return 'past';
  if (raw.includes('hypothetical')) return 'hypothetical';
  if (raw.includes('third')) return 'third_party';
  return 'current';
}

/**
 * @returns {Promise<{
 *   evaluated: boolean,
 *   isEmergency?: boolean,
 *   severity?: string,
 *   category?: string,
 *   matchedPhrase?: string,
 *   buckets?: string[],
 *   tense?: string,
 *   tenseCheckCalled?: boolean,
 * }>}
 */
async function evaluateEmergencyEmbedding(text) {
  const embeddingService = getEmbeddingService();
  const openai = getOpenAI();

  if (!openai) {
    return { evaluated: false };
  }

  await embeddingService.initialize();

  const queryVector = await embeddingService.embedText(text);
  if (!queryVector) {
    return { evaluated: false };
  }

  const buckets = embeddingService.getMatchingBuckets(queryVector, 'emergencyDetector', 0.78);

  if (buckets.length === 0) {
    return {
      evaluated: true,
      isEmergency: false,
      buckets: [],
      tenseCheckCalled: false,
    };
  }

  let tense;
  try {
    tense = await runTenseCheck(openai, text);
  } catch (e) {
    logger.error(`[EmergencyEmbedding] Tense check failed: ${e.message}`);
    return { evaluated: false };
  }

  if (tense !== 'current') {
    return {
      evaluated: true,
      isEmergency: false,
      buckets,
      tense,
      tenseCheckCalled: true,
    };
  }

  const meta = embeddingService.getHighestSeverityEmergencyBucket(buckets);
  return {
    evaluated: true,
    isEmergency: true,
    severity: meta.severity,
    category: meta.category,
    matchedPhrase: meta.matchedPhrase,
    buckets,
    tense,
    tenseCheckCalled: true,
  };
}

module.exports = {
  evaluateEmergencyEmbedding,
  runTenseCheck,
  getEmbeddingService,
  TENSE_MODEL,
};
