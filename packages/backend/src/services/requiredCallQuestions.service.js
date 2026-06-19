const mongoose = require('mongoose');
const { getOpenAIConstructor } = require('../utils/openaiSdk');
const config = require('../config/config');
const logger = require('../config/logger');
const { Client, Org, Message } = require('../models');
const { buildRequiredQuestionsInstructions } = require('../templates/requiredCallQuestionsPrompts');

const MAX_QUESTIONS = 10;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

const getOpenAI = () => {
  const OpenAI = getOpenAIConstructor();
  return new OpenAI({ apiKey: config.openai.apiKey });
};

/**
 * @param {{ enabled?: boolean, questions?: { id?: string, prompt?: string }[] }} config
 */
function assertValidRequiredCallQuestionsConfig(configInput) {
  if (!configInput || typeof configInput !== 'object') {
    throw new Error('requiredCallQuestions must be an object');
  }
  const enabled = configInput.enabled === true;
  const questions = configInput.questions || [];
  if (!Array.isArray(questions)) {
    throw new Error('requiredCallQuestions.questions must be an array');
  }
  if (questions.length > MAX_QUESTIONS) {
    throw new Error(`requiredCallQuestions allows up to ${MAX_QUESTIONS} questions`);
  }
  const ids = new Set();
  for (const q of questions) {
    const id = String(q?.id || '').trim();
    const prompt = String(q?.prompt || '').trim();
    if (!id || !ID_PATTERN.test(id)) {
      throw new Error('Each required question needs a unique id (letters, numbers, underscore, hyphen)');
    }
    if (!prompt || prompt.length > 1000) {
      throw new Error('Each required question needs a prompt (max 1000 characters)');
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate required question id: ${id}`);
    }
    ids.add(id);
  }
  if (enabled && questions.length === 0) {
    throw new Error('Enable required call questions only when at least one question is configured');
  }
}

/**
 * @param {object|null|undefined} orgRequired
 * @returns {{ enabled: boolean, questions: { id: string, prompt: string }[] }}
 */
function normalizeOrgConfig(orgRequired) {
  if (!orgRequired || typeof orgRequired !== 'object') {
    return { enabled: false, questions: [] };
  }
  const questions = (orgRequired.questions || [])
    .map((q) => ({
      id: String(q?.id || '').trim(),
      prompt: String(q?.prompt || '').trim(),
    }))
    .filter((q) => q.id && q.prompt);
  const enabled = orgRequired.enabled === true && questions.length > 0;
  return { enabled, questions };
}

/**
 * @param {string|mongoose.Types.ObjectId} clientId
 */
async function getQuestionsForClient(clientId) {
  const client = await Client.findById(clientId).select('org').lean();
  if (!client?.org) {
    return { enabled: false, questions: [], facilityName: '' };
  }
  const org = await Org.findById(client.org).select('name requiredCallQuestions').lean();
  const normalized = normalizeOrgConfig(org?.requiredCallQuestions);
  return {
    ...normalized,
    facilityName: org?.name || '',
  };
}

/**
 * @param {{ id: string, prompt: string }[]} questions
 * @param {string} facilityName
 */
function buildPromptSection(questions, facilityName) {
  if (!questions?.length) return '';
  return buildRequiredQuestionsInstructions(questions, facilityName);
}

/**
 * Extract structured answers from transcript using LLM (pleasantries make block-mapping unreliable).
 * @param {string} conversationText
 * @param {{ id: string, prompt: string }[]} questions
 */
async function extractAnswersFromTranscript(conversationText, questions) {
  if (!conversationText?.trim() || conversationText === 'No conversation content recorded.' || !questions?.length) {
    return questions.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      answer: null,
      asked: false,
    }));
  }

  const questionBlock = questions.map((q) => `${q.id}: ${q.prompt}`).join('\n');
  const model = config.openai.sentimentModel || config.openai.model || 'gpt-4o';

  const system = `You extract answers to standard care-team questions from wellness call transcripts.
Return ONLY valid JSON — an array of objects with keys: questionId, answer, asked.
- questionId must match one of the provided ids exactly.
- answer: short plain-language summary of what the resident said (null if unclear or not answered).
- asked: true if Bianca asked this question (or clearly attempted it), false otherwise.
For medication questions, record only general adherence (e.g. "yes, took medication", "forgot this morning") — never list specific drug names or dosages.
Do not invent answers not supported by the transcript.`;

  const user = `Questions:\n${questionBlock}\n\nTranscript:\n${conversationText}\n\nJSON array:`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0,
      max_tokens: 800,
    });
    const text = response.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array in extraction response');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      throw new Error('Extraction response is not an array');
    }
    const byId = new Map(parsed.map((row) => [String(row.questionId), row]));
    return questions.map((q) => {
      const row = byId.get(q.id);
      const answerRaw = row?.answer != null ? String(row.answer).trim() : '';
      const asked = row?.asked === true || answerRaw.length > 0;
      return {
        questionId: q.id,
        prompt: q.prompt,
        answer: answerRaw || null,
        asked,
      };
    });
  } catch (err) {
    logger.error(`[RequiredCallQuestions] LLM extraction failed: ${err.message}`);
    return questions.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      answer: null,
      asked: false,
      extractionError: true,
    }));
  }
}

/**
 * @param {{
 *   conversationId: string,
 *   clientId: string|mongoose.Types.ObjectId,
 *   conversationText?: string,
 *   callMongoId?: string|null,
 * }} params
 */
async function captureFromConversation(params) {
  const { conversationId, clientId, conversationText: providedText, callMongoId } = params;
  if (!conversationId || !clientId) {
    return { recorded: 0, skipped: true };
  }

  const { enabled, questions } = await getQuestionsForClient(clientId);
  if (!enabled || questions.length === 0) {
    return { recorded: 0, skipped: true };
  }

  let conversationText = providedText;
  if (!conversationText) {
    const convOid = mongoose.Types.ObjectId.isValid(String(conversationId))
      ? new mongoose.Types.ObjectId(String(conversationId))
      : null;
    if (!convOid) {
      return { recorded: 0, skipped: true };
    }
    const messages = await Message.find({ conversationId: convOid })
      .sort({ createdAt: 1 })
      .select('role content')
      .lean();
    if (!messages.length) {
      return { recorded: 0, skipped: false };
    }
    conversationText = messages
      .filter((m) => m.role === 'client' || m.role === 'assistant')
      .map((m) => `${m.role === 'assistant' ? 'Bianca' : 'Resident'}: ${m.content}`)
      .join('\n');
  }

  const answers = await extractAnswersFromTranscript(conversationText, questions);
  const recorded = answers.filter((a) => a.answer).length;

  const { Conversation } = require('../models');
  await Conversation.findByIdAndUpdate(conversationId, {
    'analyzedData.requiredQuestions': {
      answers,
      capturedAt: new Date(),
      callId: callMongoId || undefined,
    },
  });

  logger.info(
    `[RequiredCallQuestions] captured ${recorded}/${questions.length} answers for conversation ${conversationId}`
  );

  return { recorded, skipped: false, answers };
}

/**
 * @param {object|null|undefined} analyzedData
 * @returns {{ question: string, answer: string, asked: boolean }[]}
 */
function pickAnswersForDigest(analyzedData) {
  const answers = analyzedData?.requiredQuestions?.answers;
  if (!Array.isArray(answers)) return [];
  return answers
    .filter((a) => a && (a.answer || a.asked))
    .map((a) => ({
      question: String(a.prompt || a.questionId || '').trim(),
      answer: a.answer ? String(a.answer).trim() : '',
      asked: a.asked === true,
    }));
}

/**
 * @param {{ question: string, answer: string }[]} rows
 */
function formatAnswersPlain(rows) {
  if (!rows?.length) return '';
  return rows
    .map((r) => {
      if (r.answer) return `${r.question}: ${r.answer}`;
      return `${r.question}: (not answered)`;
    })
    .join('; ');
}

module.exports = {
  MAX_QUESTIONS,
  assertValidRequiredCallQuestionsConfig,
  normalizeOrgConfig,
  getQuestionsForClient,
  buildPromptSection,
  extractAnswersFromTranscript,
  captureFromConversation,
  pickAnswersForDigest,
  formatAnswersPlain,
};
