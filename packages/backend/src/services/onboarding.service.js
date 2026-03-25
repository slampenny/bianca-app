const mongoose = require('mongoose');
const { OnboardingResponse } = require('../models/onboardingResponse.model');
const { Call } = require('../models');
const logger = require('../config/logger');

/** Expected capture topics per day (matches onboardingPrompts.js). */
const QUESTIONS_PER_DAY = { 1: 6, 2: 5, 3: 4, 4: 4 };

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

/**
 * Journey + optional day-filtered responses for caregiver UI.
 * @param {string|mongoose.Types.ObjectId} clientId
 * @param {{ dayNumber?: number }} [opts]
 */
const getDashboardForClient = async (clientId, { dayNumber } = {}) => {
  const cid = clientId instanceof mongoose.Types.ObjectId ? clientId : new mongoose.Types.ObjectId(String(clientId));

  const [rows, calls] = await Promise.all([
    OnboardingResponse.find({ clientId: cid }).sort({ dayNumber: 1, capturedAt: -1 }).lean(),
    Call.find({ clientId: cid, onboardingDay: { $gte: 1, $lte: 4 } })
      .select('onboardingDay onboardingCompletedAt onboardingEndedEarlyReason startTime createdAt')
      .sort({ startTime: -1 })
      .lean(),
  ]);

  const latestCallByDay = {};
  for (const c of calls) {
    const d = c.onboardingDay;
    if (!d || d < 1 || d > 4) continue;
    const t = new Date(c.startTime || c.createdAt || 0).getTime();
    if (!latestCallByDay[d] || t > latestCallByDay[d].t) {
      latestCallByDay[d] = { t, call: c };
    }
  }

  const sessionByDay = {};
  for (let d = 1; d <= 4; d += 1) {
    const entry = latestCallByDay[d];
    if (entry?.call?.onboardingCompletedAt) {
      sessionByDay[d] = {
        sessionCompleted: true,
        sessionCompletedAt: entry.call.onboardingCompletedAt,
        sessionEndedReason: entry.call.onboardingEndedEarlyReason || null,
      };
    } else {
      sessionByDay[d] = {
        sessionCompleted: false,
        sessionCompletedAt: null,
        sessionEndedReason: null,
      };
    }
  }

  const uniqueQuestionsByDay = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
  for (const r of rows) {
    if (r.dayNumber >= 1 && r.dayNumber <= 4) {
      uniqueQuestionsByDay[r.dayNumber].add(r.questionId);
    }
  }

  const days = [1, 2, 3, 4].map((dayNum) => {
    const sess = sessionByDay[dayNum];
    return {
      dayNumber: dayNum,
      totalQuestions: QUESTIONS_PER_DAY[dayNum],
      capturedCount: uniqueQuestionsByDay[dayNum].size,
      sessionCompleted: sess.sessionCompleted,
      sessionCompletedAt: sess.sessionCompletedAt,
      sessionEndedReason: sess.sessionEndedReason,
    };
  });

  let currentDay = null;
  for (let d = 1; d <= 4; d += 1) {
    if (!sessionByDay[d].sessionCompleted) {
      currentDay = d;
      break;
    }
  }
  const journeyComplete = [1, 2, 3, 4].every((d) => sessionByDay[d].sessionCompleted);
  const sessionsCompletedCount = [1, 2, 3, 4].filter((d) => sessionByDay[d].sessionCompleted).length;
  const hasAnyOnboardingActivity = rows.length > 0 || calls.length > 0;

  let anySafety;
  let anyMemory;
  let anyMood;
  let anyDistress;
  let anyConfusion;
  for (const r of rows) {
    if (r.safety_flag) anySafety = true;
    if (r.memory_flag) anyMemory = true;
    if (r.mood_flag) anyMood = true;
    if (r.distress_flag) anyDistress = true;
    if (r.confusion_flag) anyConfusion = true;
  }

  const filteredRows =
    dayNumber != null && dayNumber >= 1 && dayNumber <= 4
      ? rows.filter((r) => r.dayNumber === dayNumber)
      : rows;

  return {
    journey: {
      days,
      currentDay: journeyComplete ? null : currentDay,
      journeyComplete,
      sessionsCompletedCount,
      hasAnyOnboardingActivity,
    },
    responses: filteredRows,
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
  getDashboardForClient,
};
