const mongoose = require('mongoose');
const { OnboardingResponse } = require('../models/onboardingResponse.model');
const { Call } = require('../models');
const logger = require('../config/logger');
const { getQuestionIdsForDay } = require('../templates/onboardingQuestionOrder');

/** Expected capture topics per day (same order as onboardingQuestionOrder.js / transcript capture). */
const QUESTIONS_PER_DAY = {
  1: getQuestionIdsForDay(1).length,
  2: getQuestionIdsForDay(2).length,
  3: getQuestionIdsForDay(3).length,
  4: getQuestionIdsForDay(4).length,
};

/**
 * Build journey + flags from onboarding responses and onboarding calls for a single client.
 * @param {object[]} allRowsForClient - OnboardingResponse lean docs
 * @param {object[]} onboardingCallsForClient - Call lean docs with onboardingDay 1–4
 */
const _buildJourneyAndFlags = (allRowsForClient, onboardingCallsForClient) => {
  const latestCallByDay = {};
  for (const c of onboardingCallsForClient) {
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
  for (const r of allRowsForClient) {
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
  const hasAnyOnboardingActivity = allRowsForClient.length > 0 || onboardingCallsForClient.length > 0;

  let anySafety;
  let anyMemory;
  let anyMood;
  let anyDistress;
  let anyConfusion;
  for (const r of allRowsForClient) {
    if (r.safety_flag) anySafety = true;
    if (r.memory_flag) anyMemory = true;
    if (r.mood_flag) anyMood = true;
    if (r.distress_flag) anyDistress = true;
    if (r.confusion_flag) anyConfusion = true;
  }

  return {
    journey: {
      days,
      currentDay: journeyComplete ? null : currentDay,
      journeyComplete,
      sessionsCompletedCount,
      hasAnyOnboardingActivity,
    },
    flags: {
      safety: !!anySafety,
      memory: !!anyMemory,
      mood: !!anyMood,
      distress: !!anyDistress,
      confusion: !!anyConfusion,
    },
    questionCount: allRowsForClient.length,
  };
};

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

  const { journey, flags, questionCount } = _buildJourneyAndFlags(rows, calls);

  const filteredRows =
    dayNumber != null && dayNumber >= 1 && dayNumber <= 4
      ? rows.filter((r) => r.dayNumber === dayNumber)
      : rows;

  return {
    journey,
    responses: filteredRows,
    flags,
    questionCount,
  };
};

/**
 * Batch journey summaries for directory / dashboard (same access scope as caller's client list).
 * @param {mongoose.Types.ObjectId[]} clientIds
 * @returns {Record<string, object>} keyed by client id string
 */
const getJourneyRollupsForClientIds = async (clientIds) => {
  const rollups = {};
  if (!clientIds || clientIds.length === 0) {
    return rollups;
  }
  const oidList = clientIds.map((id) =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id))
  );
  for (const oid of oidList) {
    rollups[oid.toString()] = {
      sessionsCompletedCount: 0,
      journeyComplete: false,
      currentDay: 1,
      hasAnyOnboardingActivity: false,
      flags: {
        safety: false,
        memory: false,
        mood: false,
        distress: false,
        confusion: false,
      },
      questionCount: 0,
    };
  }

  const [rows, calls] = await Promise.all([
    OnboardingResponse.find({ clientId: { $in: oidList } })
      .select(
        'clientId dayNumber questionId safety_flag memory_flag mood_flag distress_flag confusion_flag capturedAt'
      )
      .sort({ dayNumber: 1, capturedAt: -1 })
      .lean(),
    Call.find({ clientId: { $in: oidList }, onboardingDay: { $gte: 1, $lte: 4 } })
      .select('clientId onboardingDay onboardingCompletedAt onboardingEndedEarlyReason startTime createdAt')
      .lean(),
  ]);

  const rowsByClient = {};
  const callsByClient = {};
  for (const oid of oidList) {
    const k = oid.toString();
    rowsByClient[k] = [];
    callsByClient[k] = [];
  }
  for (const r of rows) {
    const k = r.clientId ? r.clientId.toString() : '';
    if (rowsByClient[k]) rowsByClient[k].push(r);
  }
  for (const c of calls) {
    const k = c.clientId ? c.clientId.toString() : '';
    if (callsByClient[k]) callsByClient[k].push(c);
  }

  for (const oid of oidList) {
    const k = oid.toString();
    const built = _buildJourneyAndFlags(rowsByClient[k], callsByClient[k]);
    rollups[k] = {
      sessionsCompletedCount: built.journey.sessionsCompletedCount,
      journeyComplete: built.journey.journeyComplete,
      currentDay: built.journey.currentDay,
      hasAnyOnboardingActivity: built.journey.hasAnyOnboardingActivity,
      flags: built.flags,
      questionCount: built.questionCount,
    };
  }

  return rollups;
};

module.exports = {
  recordCapture,
  completeSession,
  listByClient,
  dashboardSummary,
  getDashboardForClient,
  getJourneyRollupsForClientIds,
};
