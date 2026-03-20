// src/services/emergencyTenseGate.service.js
/**
 * Second-stage gate: LLM classifies whether the utterance describes a current emergency
 * vs past or hypothetical. Only "current" should trigger alerts.
 */

const logger = require('../config/logger');
const { getOpenAIApiKey } = require('../utils/openaiApiKey');

const MODEL = process.env.EMERGENCY_TENSE_MODEL || 'gpt-4.1-mini';

/**
 * @param {string} utterance - Patient text that already passed emergency pattern detection
 * @returns {Promise<'current'|'past'|'hypothetical'|'unknown'>}
 */
async function classifyEmergencyTense(utterance) {
  const apiKey = getOpenAIApiKey();
  if (!apiKey || !utterance || !utterance.trim()) {
    return 'unknown';
  }

  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You classify a single patient utterance. Reply with exactly one word: current, past, or hypothetical. ' +
            'current = they describe something happening to them now or imminently needing help. ' +
            'past = they are clearly recounting something that already happened. ' +
            'hypothetical = what-if, educational, third-party story, or not about their own present situation.',
        },
        {
          role: 'user',
          content:
            'Did the person say this is happening right now, or are they describing something in the past or hypothetical? Answer with one word only: current, past, or hypothetical.\n\nUtterance:\n' +
            utterance.slice(0, 2000),
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const raw = (completion.choices[0]?.message?.content || '').trim().toLowerCase();
    if (raw.includes('current')) return 'current';
    if (raw.includes('past')) return 'past';
    if (raw.includes('hypothetical')) return 'hypothetical';
    logger.warn(`[EmergencyTenseGate] Unexpected LLM response: "${raw}"`);
    return 'unknown';
  } catch (e) {
    logger.error('[EmergencyTenseGate] LLM call failed:', e.message || e);
    return 'unknown';
  }
}

module.exports = {
  classifyEmergencyTense,
  MODEL,
};
