const { ClientMemory } = require('../models/clientMemory.model');
const logger = require('../config/logger');
const { getOpenAIConstructor } = require('../utils/openaiSdk');
const OpenAI = getOpenAIConstructor();
const config = require('../config/config');

const VALID_CATEGORIES = new Set([
  'preference',
  'relationship',
  'health',
  'mood',
  'concern',
  'life_event',
  'cognitive',
  'safety',
  'general',
]);

let openaiClient = null;
const getOpenAI = () => {
  if (!openaiClient && config.openai?.apiKey) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
};

/**
 * THE EXTRACTION PROMPT
 *
 * Tuned for Bianca's context: elderly care home residents, daily wellness check-ins,
 * detecting depression and cognitive decline early.
 *
 * Key signals we care about:
 * - Emotional state and mood patterns
 * - Family/relationship mentions (who matters to them)
 * - Health concerns (physical and cognitive)
 * - Preferences (how they like to be addressed, what they enjoy talking about)
 * - Unresolved concerns (things Bianca should follow up on next call)
 * - Life events (changes in routine, losses, milestones)
 * - Cognitive signals (repetition, confusion, memory gaps — note carefully, not diagnose)
 * - Safety signals (falls, isolation, anything that escalated or nearly escalated)
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a clinical notes assistant for Bianca, an AI wellness companion that makes daily check-in calls to elderly care home residents. Your job is to extract discrete, specific facts from a conversation transcript that will help Bianca have warmer, more continuous conversations with this resident in the future.

Extract facts that would help Bianca:
- Remember personal details so the resident feels heard and remembered
- Follow up on things the resident mentioned (health concerns, upcoming events, worries)
- Understand the resident's emotional patterns over time
- Detect early signs of declining mood, cognitive changes, or safety concerns

IMPORTANT RULES:
- Extract facts, not summaries. "Has a daughter named Sarah who visits Sundays" is a fact. "Client seemed happy" is too vague — instead write "Described feeling 'much better' after Sarah's visit on Sunday".
- Be specific. Include names, dates, and direct emotional language when the client used it.
- Do not diagnose. Note observations, not conclusions. "Repeated the same question about her medication three times" not "Client shows signs of dementia".
- One fact per item. Do not combine multiple facts into one.
- Confidence: high = client stated it directly and clearly. medium = implied or mentioned briefly. low = you inferred it.
- Only extract facts worth remembering across multiple future calls. Skip one-off pleasantries.
- Safety/urgent facts: anything involving falls, expressions of hopelessness, thoughts of self-harm, expressions of fear, or mentions of abuse — mark as priority: urgent.

Categories:
- preference: how they like to be addressed, topics they enjoy, things they dislike
- relationship: family members, friends, caregivers, pets mentioned by name or role
- health: physical conditions, medications, symptoms, upcoming procedures, pain
- mood: emotional state during this call, patterns mentioned, changes from before
- concern: unresolved worries Bianca should follow up on next call
- life_event: recent or upcoming changes — moves, losses, milestones, anniversaries
- cognitive: repetition, confusion, memory gaps (note observations only)
- safety: fall risk, isolation, anything adjacent to an emergency
- general: useful facts that don't fit above

Return ONLY a JSON array. No preamble, no markdown, no explanation. Example format:
[
  {
    "fact": "Prefers to be called Rose, not Margaret",
    "category": "preference",
    "confidence": "high"
  },
  {
    "fact": "Daughter named Sarah visits every Sunday afternoon",
    "category": "relationship",
    "confidence": "high"
  },
  {
    "fact": "Knee replacement surgery scheduled for April — expressed anxiety about the recovery",
    "category": "health",
    "confidence": "high"
  },
  {
    "fact": "Said she has been feeling 'a bit blue' since her roommate moved out last month",
    "category": "mood",
    "confidence": "high"
  },
  {
    "fact": "Asked Bianca to check in about how the surgery went next call",
    "category": "concern",
    "confidence": "high"
  }
]

If there are no facts worth extracting, return an empty array: []`;

/**
 * Extract facts from a completed conversation transcript.
 * Called as async fire-and-forget from finalizeConversation.
 */
const extractAndStoreFacts = async (clientId, conversationId, conversationText) => {
  if (!conversationText || conversationText === 'No conversation content recorded.') {
    logger.info(`[ClientMemory] Skipping extraction for conversation ${conversationId} — no content`);
    return;
  }

  const openai = getOpenAI();
  if (!openai) {
    logger.warn('[ClientMemory] OpenAI client not configured — skipping extraction');
    return;
  }

  try {
    logger.info(`[ClientMemory] Starting fact extraction for client ${clientId}, conversation ${conversationId}`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract facts from this Bianca wellness check-in call transcript:\n\n${conversationText}`,
        },
      ],
      temperature: 0.1, // Low temperature — we want consistent, factual extraction
      max_tokens: 2000,
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      logger.warn(`[ClientMemory] Empty extraction response for conversation ${conversationId}`);
      return;
    }

    let facts;
    try {
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      facts = JSON.parse(cleaned);
    } catch (parseErr) {
      logger.error(`[ClientMemory] Failed to parse extraction response for conversation ${conversationId}: ${parseErr.message}`);
      logger.debug(`[ClientMemory] Raw response was: ${raw}`);
      return;
    }

    if (!Array.isArray(facts) || facts.length === 0) {
      logger.info(`[ClientMemory] No facts extracted for conversation ${conversationId}`);
      return;
    }

    const docs = facts
      .filter((f) => f && typeof f.fact === 'string' && f.fact.trim().length > 0)
      .map((f) => {
        const cat = f.category && VALID_CATEGORIES.has(f.category) ? f.category : 'general';
        const conf = ['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium';
        const pri = f.priority === 'urgent' ? 'urgent' : 'normal';
        return {
          clientId,
          conversationId,
          fact: f.fact.trim().slice(0, 500),
          category: cat,
          confidence: conf,
          priority: pri,
          source: 'post_call_extraction',
          extractedAt: new Date(),
        };
      });

    if (docs.length > 0) {
      await ClientMemory.insertMany(docs, { ordered: false });
      logger.info(`[ClientMemory] Stored ${docs.length} facts for client ${clientId} from conversation ${conversationId}`);
    }
  } catch (err) {
    // Never let this crash the finalization flow
    logger.error(`[ClientMemory] Extraction failed for conversation ${conversationId}: ${err.message}`, err);
  }
};

/**
 * Write a single urgent fact mid-call.
 * Called by the emergency processor when a significant signal is detected.
 * conversationId may be null if we don't have it at point of detection.
 */
const writeUrgentFact = async (clientId, fact, conversationId = null) => {
  try {
    const dup = await ClientMemory.findOne({
      clientId,
      source: 'mid_call_emergency',
      fact,
      extractedAt: { $gte: new Date(Date.now() - 60000) },
    })
      .select('_id')
      .lean();
    if (dup) {
      logger.debug(`[ClientMemory] Skipping duplicate urgent fact for client ${clientId} within 60s window`);
      return;
    }

    await ClientMemory.create({
      clientId,
      conversationId,
      fact: fact.slice(0, 500),
      category: 'safety',
      confidence: 'high',
      priority: 'urgent',
      source: 'mid_call_emergency',
      extractedAt: new Date(),
    });
    logger.info(`[ClientMemory] Wrote urgent mid-call fact for client ${clientId}: "${fact.substring(0, 80)}"`);
  } catch (err) {
    logger.error(`[ClientMemory] Failed to write urgent fact for client ${clientId}: ${err.message}`);
  }
};

/**
 * Retrieve ranked facts for a client to inject into buildEnhancedPrompt.
 * Returns recency-sorted facts, with urgent/concern/health/mood categories prioritized.
 */
const getClientFacts = async (clientId, limit = 25) => {
  try {
    // Pull urgent/high-priority facts first (always surface these)
    const urgentFacts = await ClientMemory.find({ clientId, priority: 'urgent' })
      .sort({ extractedAt: -1 })
      .limit(5)
      .lean();

    // Pull concern/health/mood/cognitive — the most actionable categories
    const actionableFacts = await ClientMemory.find({
      clientId,
      priority: 'normal',
      category: { $in: ['concern', 'health', 'mood', 'cognitive', 'safety'] },
    })
      .sort({ extractedAt: -1 })
      .limit(10)
      .lean();

    // Pull remaining categories for warmth/continuity
    const contextFacts = await ClientMemory.find({
      clientId,
      priority: 'normal',
      category: { $in: ['preference', 'relationship', 'life_event', 'general'] },
    })
      .sort({ extractedAt: -1 })
      .limit(10)
      .lean();

    // Deduplicate by _id and return ordered: urgent first, then actionable, then context
    const seen = new Set();
    const all = [...urgentFacts, ...actionableFacts, ...contextFacts].filter((f) => {
      const id = f._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return all.slice(0, limit);
  } catch (err) {
    logger.error(`[ClientMemory] Failed to retrieve facts for client ${clientId}: ${err.message}`);
    return [];
  }
};

/**
 * Format facts into a readable block for injection into the system prompt.
 */
const formatFactsForPrompt = (facts, clientName) => {
  if (!facts || facts.length === 0) return '';

  const urgentFacts = facts.filter((f) => f.priority === 'urgent');
  const concernFacts = facts.filter((f) => f.category === 'concern' && f.priority !== 'urgent');
  const otherFacts = facts.filter((f) => f.priority !== 'urgent' && f.category !== 'concern');

  const lines = [];

  if (urgentFacts.length > 0) {
    lines.push('IMPORTANT — follow up on these from previous calls:');
    urgentFacts.forEach((f) => lines.push(`  - ${f.fact}`));
  }

  if (concernFacts.length > 0) {
    lines.push('Things to gently follow up on:');
    concernFacts.forEach((f) => lines.push(`  - ${f.fact}`));
  }

  if (otherFacts.length > 0) {
    lines.push(`What we know about ${clientName || 'this resident'}:`);
    otherFacts.forEach((f) => lines.push(`  - ${f.fact}`));
  }

  return lines.join('\n');
};

module.exports = {
  extractAndStoreFacts,
  writeUrgentFact,
  getClientFacts,
  formatFactsForPrompt,
};
