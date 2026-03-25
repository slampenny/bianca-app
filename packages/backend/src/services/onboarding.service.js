const { OnboardingResponse } = require('../models/onboardingResponse.model');
const { Call } = require('../models');
const logger = require('../config/logger');

/**
 * Upsert by client + day + question (latest capture wins per PRD).
 */
const recordCapture = async (payload) => {
  const {
    clientId,
    dayNumber,
    questionId,
    responseType,
    responseValue,
    verbatimTranscript,
    callId,
    conversationId,
    safety_flag,
    memory_flag,
    mood_flag,
    distress_flag,
    confusion_flag,
    notes,
  } = payload;

  const doc = await OnboardingResponse.findOneAndUpdate(
    { clientId, dayNumber, questionId },
    {
      $set: {
        responseType,
        responseValue,
        verbatimTranscript: verbatimTranscript || undefined,
        callId: callId || undefined,
        conversationId: conversationId || undefined,
        capturedAt: new Date(),
        safety_flag: !!safety_flag,
        memory_flag: !!memory_flag,
        mood_flag: !!mood_flag,
        distress_flag: !!distress_flag,
        confusion_flag: !!confusion_flag,
        notes: notes || undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  logger.info(`[Onboarding] Captured ${questionId} day ${dayNumber} client ${clientId}`);
  return doc;
};

const completeSession = async ({ callMongoId, endedEarlyReason, summaryNotes }) => {
  if (!callMongoId) return null;
  const update = {
    onboardingCompletedAt: new Date(),
    onboardingEndedEarlyReason: endedEarlyReason || 'completed',
  };
  if (summaryNotes) {
    update.onboardingSessionSummaryNotes = summaryNotes;
  }
  const call = await Call.findByIdAndUpdate(callMongoId, { $set: update }, { new: true });
  if (call) {
    logger.info(`[Onboarding] Session complete call ${callMongoId} reason ${endedEarlyReason}`);
  }
  return call;
};

const listByClient = async (clientId, { dayNumber } = {}) => {
  const q = { clientId };
  if (dayNumber != null && dayNumber >= 1 && dayNumber <= 4) {
    q.dayNumber = dayNumber;
  }
  return OnboardingResponse.find(q).sort({ dayNumber: 1, capturedAt: -1 }).lean();
};

const dashboardSummary = async (clientId) => {
  const rows = await OnboardingResponse.find({ clientId }).lean();
  const byDay = { 1: [], 2: [], 3: [], 4: [] };
  let anySafety;
  let anyMemory;
  let anyMood;
  let anyDistress;
  let anyConfusion;
  for (const r of rows) {
    if (byDay[r.dayNumber]) byDay[r.dayNumber].push(r);
    if (r.safety_flag) anySafety = true;
    if (r.memory_flag) anyMemory = true;
    if (r.mood_flag) anyMood = true;
    if (r.distress_flag) anyDistress = true;
    if (r.confusion_flag) anyConfusion = true;
  }
  return {
    responses: rows,
    byDay,
    flags: {
      safety: !!anySafety,
      memory: !!anyMemory,
      mood: !!anyMood,
      distress: !!anyDistress,
      confusion: !!anyConfusion,
    },
    questionCount: rows.length,
  };
};

module.exports = {
  recordCapture,
  completeSession,
  listByClient,
  dashboardSummary,
};
