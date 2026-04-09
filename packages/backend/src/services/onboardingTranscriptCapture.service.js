const mongoose = require('mongoose');
const { Message } = require('../models');
const logger = require('../config/logger');
const onboardingService = require('./onboarding.service');
const { getQuestionIdsForDay } = require('../templates/onboardingQuestionOrder');

const SPEAKING_PLACEHOLDER = '[Speaking...]';

/**
 * Group consecutive client messages; flush each group when the next assistant message appears.
 * Merged text is one "resident turn" aligned with the scripted question order.
 *
 * @param {{ role: string, content?: string, messageType?: string }[]} messages chronological
 * @returns {string[]}
 */
function extractClientAnswerBlocks(messages) {
  const blocks = [];
  let currentParts = [];

  const flush = () => {
    if (currentParts.length === 0) return;
    const merged = currentParts.map((s) => String(s).trim()).filter(Boolean).join(' ').trim();
    currentParts = [];
    if (!merged || merged === SPEAKING_PLACEHOLDER) return;
    blocks.push(merged);
  };

  for (const msg of messages) {
    const role = msg.role;
    const content = typeof msg.content === 'string' ? msg.content : '';

    if (role === 'debug-user') {
      continue;
    }

    if (role === 'client') {
      if (!content.trim() || content.trim() === SPEAKING_PLACEHOLDER) continue;
      currentParts.push(content);
      continue;
    }

    if (role === 'assistant') {
      flush();
    }
  }

  flush();
  return blocks;
}

/**
 * Persist onboarding answers from saved Realtime transcripts (no model tools).
 *
 * @param {{
 *   conversationId: string,
 *   clientId: string|mongoose.Types.ObjectId,
 *   dayNumber: number,
 *   callMongoId?: string|null,
 * }} params
 * @returns {{ recorded: number, skipped: boolean }}
 */
async function captureFromConversation(params) {
  const { conversationId, clientId, dayNumber, callMongoId } = params;

  if (!conversationId || !clientId || dayNumber < 1 || dayNumber > 4) {
    return { recorded: 0, skipped: true };
  }

  const questionIds = getQuestionIdsForDay(dayNumber);
  if (questionIds.length === 0) {
    return { recorded: 0, skipped: true };
  }

  const convOid = mongoose.Types.ObjectId.isValid(String(conversationId))
    ? new mongoose.Types.ObjectId(String(conversationId))
    : null;
  if (!convOid) {
    logger.warn(`[OnboardingTranscriptCapture] invalid conversationId ${conversationId}`);
    return { recorded: 0, skipped: true };
  }

  const messages = await Message.find({ conversationId: convOid })
    .sort({ createdAt: 1 })
    .select('role content messageType createdAt')
    .lean();

  const blocks = extractClientAnswerBlocks(messages);
  if (blocks.length === 0) {
    logger.info(`[OnboardingTranscriptCapture] no client answer blocks for conversation ${conversationId}`);
    return { recorded: 0, skipped: false };
  }

  const callOid =
    callMongoId && mongoose.Types.ObjectId.isValid(String(callMongoId))
      ? new mongoose.Types.ObjectId(String(callMongoId))
      : undefined;

  let recorded = 0;
  const n = Math.min(blocks.length, questionIds.length);

  for (let i = 0; i < n; i += 1) {
    const questionId = questionIds[i];
    const text = blocks[i];
    await onboardingService.recordCapture({
      clientId,
      dayNumber,
      questionId,
      responseType: 'text',
      responseValue: text,
      verbatimTranscript: text,
      callId: callOid,
      conversationId: convOid,
    });
    recorded += 1;
  }

  if (blocks.length > questionIds.length) {
    logger.info(
      `[OnboardingTranscriptCapture] more client blocks (${blocks.length}) than questions (${questionIds.length}) for day ${dayNumber}; extra not mapped`
    );
  }

  logger.info(
    `[OnboardingTranscriptCapture] recorded ${recorded}/${questionIds.length} answers from transcript conversation=${conversationId} day=${dayNumber}`
  );

  return { recorded, skipped: false };
}

module.exports = {
  extractClientAnswerBlocks,
  captureFromConversation,
};
