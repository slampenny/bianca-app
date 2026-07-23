const mongoose = require('mongoose');
const { OnboardingResponse } = require('../models/onboardingResponse.model');
const { Call, Client } = require('../models');
const logger = require('../config/logger');
const onboardingPlanService = require('./onboardingPlan.service');

/**
 * Build journey + flags from onboarding responses and onboarding calls for a single client.
 * @param {object[]} allRowsForClient - OnboardingResponse lean docs
 * @param {object[]} onboardingCallsForClient - Call lean docs with onboardingDay set
 * @param {import('./onboardingPlan.service').ResolvedOnboardingPlan} plan
 */
const _buildJourneyAndFlags = (allRowsForClient, onboardingCallsForClient, plan) => {
  const validDayNumbers = new Set(plan.days.map((d) => d.dayNumber));
  const latestCallByDay = {};
  for (const c of onboardingCallsForClient) {
    const d = c.onboardingDay;
    if (d == null || !validDayNumbers.has(d)) continue;
    const t = new Date(c.startTime || c.createdAt || 0).getTime();
    if (!latestCallByDay[d] || t > latestCallByDay[d].t) {
      latestCallByDay[d] = { t, call: c };
    }
  }

  const sessionByDay = {};
  for (const dayPlan of plan.days) {
    const d = dayPlan.dayNumber;
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

  const uniqueQuestionsByDay = {};
  for (const dayPlan of plan.days) {
    uniqueQuestionsByDay[dayPlan.dayNumber] = new Set();
  }
  for (const r of allRowsForClient) {
    if (uniqueQuestionsByDay[r.dayNumber]) {
      uniqueQuestionsByDay[r.dayNumber].add(r.questionId);
    }
  }

  const days = plan.days.map((dayPlan) => {
    const dayNum = dayPlan.dayNumber;
    const sess = sessionByDay[dayNum];
    return {
      dayNumber: dayNum,
      theme: dayPlan.theme || null,
      totalQuestions: dayPlan.questions.length,
      capturedCount: uniqueQuestionsByDay[dayNum]?.size || 0,
      sessionCompleted: sess.sessionCompleted,
      sessionCompletedAt: sess.sessionCompletedAt,
      sessionEndedReason: sess.sessionEndedReason,
    };
  });

  let currentDay = null;
  for (const dayPlan of plan.days) {
    const d = dayPlan.dayNumber;
    if (!sessionByDay[d].sessionCompleted) {
      currentDay = d;
      break;
    }
  }
  const enabled = onboardingPlanService.isOnboardingEnabled(plan);
  const journeyComplete =
    !enabled || (plan.totalDays > 0 && plan.days.every((d) => sessionByDay[d.dayNumber].sessionCompleted));
  const sessionsCompletedCount = plan.days.filter((d) => sessionByDay[d.dayNumber].sessionCompleted).length;
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
      totalDays: plan.totalDays,
      enabled,
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

const listByClient = async (clientId, { dayNumber, plan } = {}) => {
  const q = { clientId };
  if (dayNumber != null && plan && onboardingPlanService.isValidOnboardingDay(plan, dayNumber)) {
    q.dayNumber = dayNumber;
  }
  return OnboardingResponse.find(q).sort({ dayNumber: 1, capturedAt: -1 }).lean();
};

const dashboardSummary = async (clientId, plan) => {
  const rows = await OnboardingResponse.find({ clientId }).lean();
  const byDay = {};
  for (const dayPlan of plan.days) {
    byDay[dayPlan.dayNumber] = [];
  }
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
  const plan = await onboardingPlanService.getPlanForClientId(cid);

  const dayNumbers = plan.days.map((d) => d.dayNumber);
  const [rows, calls] = await Promise.all([
    OnboardingResponse.find({ clientId: cid }).sort({ dayNumber: 1, capturedAt: -1 }).lean(),
    Call.find({ clientId: cid, onboardingDay: { $in: dayNumbers } })
      .select('onboardingDay onboardingCompletedAt onboardingEndedEarlyReason startTime createdAt')
      .sort({ startTime: -1 })
      .lean(),
  ]);

  const { journey, flags, questionCount } = _buildJourneyAndFlags(rows, calls, plan);

  const filteredRows =
    dayNumber != null && onboardingPlanService.isValidOnboardingDay(plan, dayNumber)
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

  const clients = await Client.find({ _id: { $in: oidList } })
    .select('_id org')
    .lean();
  const orgIds = [...new Set(clients.map((c) => (c.org ? c.org.toString() : null)).filter(Boolean))];
  const planByOrgId = {};
  await Promise.all(
    orgIds.map(async (orgId) => {
      planByOrgId[orgId] = await onboardingPlanService.getPlanForOrgId(orgId);
    })
  );
  const planByClientId = {};
  for (const c of clients) {
    const orgKey = c.org ? c.org.toString() : null;
    planByClientId[c._id.toString()] = orgKey ? planByOrgId[orgKey] : onboardingPlanService.getDefaultPlanTemplate();
  }

  for (const oid of oidList) {
    const k = oid.toString();
    const plan = planByClientId[k] || onboardingPlanService.getDefaultPlanTemplate();
    rollups[k] = {
      totalDays: plan.totalDays,
      enabled: onboardingPlanService.isOnboardingEnabled(plan),
      sessionsCompletedCount: 0,
      journeyComplete: !onboardingPlanService.isOnboardingEnabled(plan),
      currentDay: onboardingPlanService.isOnboardingEnabled(plan) ? plan.days[0]?.dayNumber ?? 0 : null,
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

  const allDayNumbers = [
    ...new Set(Object.values(planByOrgId).flatMap((p) => p.days.map((d) => d.dayNumber))),
  ];

  const [rows, calls] = await Promise.all([
    OnboardingResponse.find({ clientId: { $in: oidList } })
      .select(
        'clientId dayNumber questionId safety_flag memory_flag mood_flag distress_flag confusion_flag capturedAt'
      )
      .sort({ dayNumber: 1, capturedAt: -1 })
      .lean(),
    Call.find({
      clientId: { $in: oidList },
      onboardingDay: {
        $in: allDayNumbers.length
          ? allDayNumbers
          : onboardingPlanService.getDefaultPlanTemplate().days.map((d) => d.dayNumber),
      },
    })
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
    const plan = planByClientId[k] || onboardingPlanService.getDefaultPlanTemplate();
    const built = _buildJourneyAndFlags(rowsByClient[k], callsByClient[k], plan);
    rollups[k] = {
      totalDays: built.journey.totalDays,
      enabled: built.journey.enabled,
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
