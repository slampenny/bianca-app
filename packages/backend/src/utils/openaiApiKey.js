/**
 * Single OpenAI API key for Realtime, embeddings, chat completions, etc.
 * Matches config.openai.apiKey (Bearer token used by openai.realtime.service.js).
 */
function getOpenAIApiKey() {
  const config = require('../config/config');
  const fromConfig = config.openai && config.openai.apiKey;
  if (fromConfig && String(fromConfig).trim()) {
    return String(fromConfig).trim();
  }
  return process.env.OPENAI_API_KEY ? String(process.env.OPENAI_API_KEY).trim() : '';
}

module.exports = { getOpenAIApiKey };
