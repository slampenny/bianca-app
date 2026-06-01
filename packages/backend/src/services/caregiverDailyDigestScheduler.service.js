const httpStatus = require('http-status');
const config = require('../config/config');
const {
  Caregiver,
  CaregiverDailyDigest,
  CaregiverDailyDigestSchedulerRun,
  Org,
} = require('../models');
const { startOfOrgLocalDay, resolveOrgTimezone } = require('../utils/digestDay.utils');
const {
  resolveOrgDigestSendTime,
  isWithinOrgLocalSendWindow,
  orgLocalDateKeyForInstant,
} = require('../utils/digestScheduler.utils');
const { canReceiveDigestEmail } = require('../utils/digestEmailEligibility');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const {
  createOrUpdateDigest,
  deliverDigestEmail,
} = require('./caregiverDailyDigest.service');

const TERMINAL_STATUSES = new Set(['sent', 'skipped']);
const CLAIMABLE_STATUSES = ['pending', 'failed'];
const ENQUEUEABLE_STATUSES = new Set(['pending', 'failed']);

const findExistingSentDigestForLocalDay = async (caregiverId, localDateKey) =>
  CaregiverDailyDigest.findOne({
    caregiver: caregiverId,
    localDateKey,
    status: 'sent',
    legacyUtcDay: { $ne: true },
  }).sort({ version: -1 });

const loadOrgTimezone = async (orgId) => {
  const org = await Org.findById(orgId).select('timezone');
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }
  return resolveOrgTimezone(org.timezone);
};

const buildRequesterFromCaregiver = (caregiver) => ({
  id: caregiver._id,
  _id: caregiver._id,
  role: caregiver.role,
  org: caregiver.org,
});

/**
 * Create or return the scheduler ledger row for caregiver + org-local day.
 */
const createOrGetSchedulerRun = async ({ orgId, caregiverId, localDateKey, trigger }) => {
  const timezone = await loadOrgTimezone(orgId);
  const digestDate = startOfOrgLocalDay(timezone, localDateKey);

  try {
    const run = await CaregiverDailyDigestSchedulerRun.create({
      org: orgId,
      caregiver: caregiverId,
      localDateKey,
      timezone,
      digestDate,
      trigger,
      status: 'pending',
    });
    return run;
  } catch (err) {
    if (err.code !== 11000) {
      throw err;
    }
    const existing = await CaregiverDailyDigestSchedulerRun.findOne({
      caregiver: caregiverId,
      localDateKey,
    });
    if (!existing) {
      throw err;
    }
    return existing;
  }
};

/**
 * Atomically claim a run for processing. Returns null if already claimed or terminal.
 */
const claimSchedulerRun = async (runId) => {
  const run = await CaregiverDailyDigestSchedulerRun.findOneAndUpdate(
    {
      _id: runId,
      status: { $in: CLAIMABLE_STATUSES },
    },
    {
      $set: { status: 'processing', startedAt: new Date(), lastError: null },
      $inc: { attempts: 1 },
    },
    { new: true }
  );
  return run;
};

const markRunSkipped = async (run, { skipReason, digestId = null }) => {
  run.status = 'skipped';
  run.skipReason = skipReason;
  run.digestId = digestId || run.digestId;
  run.completedAt = new Date();
  await run.save();
  return run;
};

const markRunSent = async (run, { digestId, emailMessageId, digestPayloadHash }) => {
  run.status = 'sent';
  run.digestId = digestId;
  run.emailMessageId = emailMessageId || null;
  run.digestPayloadHash = digestPayloadHash || null;
  run.completedAt = new Date();
  run.skipReason = null;
  run.lastError = null;
  await run.save();
  return run;
};

const markRunFailed = async (run, error) => {
  run.status = 'failed';
  run.lastError = error?.message ? String(error.message) : String(error);
  run.completedAt = new Date();
  await run.save();
  return run;
};

const finalizeIdempotentFromExistingDigest = async (run, digest) =>
  markRunSent(run, {
    digestId: digest._id,
    emailMessageId: digest.emailMessageId,
    digestPayloadHash: digest.sentPayloadHash || digest.payloadHash,
  });

/**
 * Process one scheduler run by id (claims internally).
 */
const processCaregiverDailyDigestRun = async (runId, options = {}) => {
  const run = await CaregiverDailyDigestSchedulerRun.findById(runId);
  if (!run) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Scheduler run not found');
  }
  return processOneCaregiverDigest({
    ...options,
    runId,
    orgId: run.org,
    caregiverId: run.caregiver,
    localDateKey: run.localDateKey,
    trigger: run.trigger,
  });
};

/**
 * Build/send one caregiver digest for an org-local day with ledger idempotency.
 */
const processOneCaregiverDigest = async ({
  orgId: orgIdInput,
  caregiverId: caregiverIdInput,
  localDateKey: localDateKeyInput,
  trigger = 'manual_test',
  dryRun = false,
  runId = null,
}) => {
  let orgId = orgIdInput;
  let caregiverId = caregiverIdInput;
  let localDateKey = localDateKeyInput;

  let run;
  if (runId) {
    run = await CaregiverDailyDigestSchedulerRun.findById(runId);
    if (!run) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Scheduler run not found');
    }
    orgId = orgId || run.org;
    caregiverId = caregiverId || run.caregiver;
    localDateKey = localDateKey || run.localDateKey;
  }

  const caregiver = await Caregiver.findById(caregiverId).populate('clients');
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  if (String(caregiver.org) !== String(orgId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Caregiver does not belong to org');
  }

  if (!run) {
    run = await createOrGetSchedulerRun({ orgId, caregiverId, localDateKey, trigger });
  }

  if (TERMINAL_STATUSES.has(run.status)) {
    return {
      run,
      outcome: run.status,
      idempotent: true,
      dryRun,
    };
  }

  if (run.status === 'processing') {
    return {
      run,
      outcome: 'processing',
      idempotent: true,
      dryRun,
    };
  }

  const existingSent = await findExistingSentDigestForLocalDay(caregiverId, localDateKey);
  if (existingSent) {
    const updated = await finalizeIdempotentFromExistingDigest(run, existingSent);
    return {
      run: updated,
      outcome: 'sent',
      idempotent: true,
      digest: existingSent,
      dryRun,
    };
  }

  const eligibility = canReceiveDigestEmail(caregiver.toObject ? caregiver.toObject() : caregiver, {
    requireNotificationEnabled: true,
  });
  if (!eligibility.ok) {
    const skipReason = eligibility.reasons.join('; ');
    if (dryRun) {
      return {
        run,
        outcome: 'skipped',
        skipReason,
        wouldSkip: true,
        dryRun: true,
      };
    }
    const updated = await markRunSkipped(run, { skipReason });
    return {
      run: updated,
      outcome: 'skipped',
      skipReason,
      dryRun: false,
    };
  }

  if (dryRun) {
    const requester = buildRequesterFromCaregiver(caregiver);
    const digest = await createOrUpdateDigest(requester, localDateKey, { sendEmail: false });
    return {
      run,
      outcome: 'would_send',
      digest,
      dryRun: true,
    };
  }

  const claimed = await claimSchedulerRun(run._id);
  if (!claimed) {
    const current = await CaregiverDailyDigestSchedulerRun.findById(run._id);
    return {
      run: current,
      outcome: current?.status || 'processing',
      idempotent: true,
      dryRun: false,
    };
  }
  run = claimed;

  try {
    const requester = buildRequesterFromCaregiver(caregiver);
    const draft = await createOrUpdateDigest(requester, localDateKey, { sendEmail: false });
    const sentDigest = await deliverDigestEmail(draft);

    const updated = await markRunSent(run, {
      digestId: sentDigest._id,
      emailMessageId: sentDigest.emailMessageId,
      digestPayloadHash: sentDigest.sentPayloadHash || sentDigest.payloadHash,
    });

    logger.info(
      `[CaregiverDailyDigestScheduler] Sent digest for caregiver ${caregiverId} localDateKey=${localDateKey}`
    );

    return {
      run: updated,
      outcome: 'sent',
      digest: sentDigest,
      dryRun: false,
    };
  } catch (err) {
    await markRunFailed(run, err);
    throw err;
  }
};

/**
 * Active caregivers in org that pass automated digest email eligibility.
 */
const findEligibleCaregiversForOrg = async (orgId) => {
  const caregivers = await Caregiver.find({
    org: orgId,
    active: true,
    isEmailVerified: true,
    'notificationPreferences.dailyDigestEmail': true,
  }).lean();
  return caregivers.filter((cg) => canReceiveDigestEmail(cg, { requireNotificationEnabled: true }).ok);
};

/**
 * Reset scheduler runs stuck in processing longer than staleMinutes.
 * @returns {Promise<number>} number of runs recovered
 */
const recoverStaleProcessingRuns = async ({
  orgId = null,
  localDateKey = null,
  now = new Date(),
  staleMinutes = config.dailyDigestScheduler.staleProcessingMinutes,
} = {}) => {
  const cutoff = new Date(now.getTime() - staleMinutes * 60 * 1000);
  const filter = {
    status: 'processing',
    startedAt: { $lt: cutoff },
  };
  if (orgId) {
    filter.org = orgId;
  }
  if (localDateKey) {
    filter.localDateKey = localDateKey;
  }

  const result = await CaregiverDailyDigestSchedulerRun.updateMany(filter, {
    $set: {
      status: 'failed',
      lastError: 'Stale processing recovered by coordinator',
      completedAt: now,
    },
  });

  if (result.modifiedCount > 0) {
    logger.warn(
      `[CaregiverDailyDigestScheduler] Recovered ${result.modifiedCount} stale processing run(s)`
    );
  }
  return result.modifiedCount;
};

const shouldEnqueueRun = (run) => ENQUEUEABLE_STATUSES.has(run.status);

/**
 * Agenda child job entry point — processes one ledger run and records agendaJobId.
 */
const processCaregiverDailyDigestJob = async ({ runId, agendaJobId = null }) => {
  if (agendaJobId) {
    await CaregiverDailyDigestSchedulerRun.updateOne(
      { _id: runId, $or: [{ agendaJobId: null }, { agendaJobId: { $exists: false } }] },
      { $set: { agendaJobId: String(agendaJobId) } }
    );
  }
  return processCaregiverDailyDigestRun(runId);
};

/**
 * Coordinator tick: find orgs in send window, create ledger rows, enqueue caregiver jobs.
 */
const runDailyDigestCoordinatorTick = async ({
  now = new Date(),
  dryRun = false,
  enqueueCaregiverJob = null,
} = {}) => {
  const schedulerConfig = config.dailyDigestScheduler;
  const summary = {
    enabled: schedulerConfig.enabled,
    dryRun,
    orgsChecked: 0,
    orgsInWindow: 0,
    staleRecovered: 0,
    runsCreated: 0,
    runsEnqueued: 0,
    runsSkippedTerminal: 0,
    caregiversSkippedIneligible: 0,
    details: [],
  };

  if (!schedulerConfig.enabled) {
    return summary;
  }

  const orgs = await Org.find({ 'dailyDigestSettings.enabled': true })
    .select('_id timezone dailyDigestSettings')
    .lean();

  summary.orgsChecked = orgs.length;
  const windowMinutes = schedulerConfig.coordinatorIntervalMinutes;

  // eslint-disable-next-line no-restricted-syntax
  for (const org of orgs) {
    const orgId = org._id;
    const timezone = resolveOrgTimezone(org.timezone);
    const sendTime = resolveOrgDigestSendTime(org.dailyDigestSettings?.sendTime, schedulerConfig.defaultSendTime);
    const inWindow = isWithinOrgLocalSendWindow({
      orgTimezone: timezone,
      sendTime,
      now,
      windowMinutes,
    });

    if (!inWindow) {
      continue;
    }

    summary.orgsInWindow += 1;
    const localDateKey = orgLocalDateKeyForInstant(timezone, now);

    if (!dryRun) {
      // eslint-disable-next-line no-await-in-loop
      summary.staleRecovered += await recoverStaleProcessingRuns({ orgId, localDateKey, now });
    }

    const eligibleCaregivers = await findEligibleCaregiversForOrg(orgId);
    const orgDetail = {
      orgId: String(orgId),
      localDateKey,
      sendTime,
      timezone,
      eligibleCaregiverCount: eligibleCaregivers.length,
      runs: [],
    };

    // eslint-disable-next-line no-restricted-syntax
    for (const cg of eligibleCaregivers) {
      const caregiverId = cg._id;
      let run;
      if (dryRun) {
        run = await CaregiverDailyDigestSchedulerRun.findOne({ caregiver: caregiverId, localDateKey });
        if (!run) {
          summary.runsCreated += 1;
          orgDetail.runs.push({
            caregiverId: String(caregiverId),
            action: 'would_create_run',
          });
          continue;
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        const priorRun = await CaregiverDailyDigestSchedulerRun.findOne({
          caregiver: caregiverId,
          localDateKey,
        }).select('_id');
        run = await createOrGetSchedulerRun({
          orgId,
          caregiverId,
          localDateKey,
          trigger: 'scheduled',
        });
        if (!priorRun) {
          summary.runsCreated += 1;
        }
      }

      if (!run) {
        continue;
      }

      if (TERMINAL_STATUSES.has(run.status)) {
        summary.runsSkippedTerminal += 1;
        orgDetail.runs.push({
          caregiverId: String(caregiverId),
          runId: String(run._id),
          status: run.status,
          action: 'skip_terminal',
        });
        continue;
      }

      if (run.status === 'processing') {
        orgDetail.runs.push({
          caregiverId: String(caregiverId),
          runId: String(run._id),
          status: run.status,
          action: 'skip_processing',
        });
        continue;
      }

      if (dryRun) {
        orgDetail.runs.push({
          caregiverId: String(caregiverId),
          runId: String(run._id),
          status: run.status,
          action: 'would_enqueue',
        });
        summary.runsEnqueued += 1;
        continue;
      }

      if (!shouldEnqueueRun(run)) {
        continue;
      }

      if (typeof enqueueCaregiverJob === 'function') {
        // eslint-disable-next-line no-await-in-loop
        await enqueueCaregiverJob(String(run._id));
        summary.runsEnqueued += 1;
        orgDetail.runs.push({
          caregiverId: String(caregiverId),
          runId: String(run._id),
          status: run.status,
          action: 'enqueued',
        });
      } else {
        // eslint-disable-next-line no-await-in-loop
        await processCaregiverDailyDigestJob({ runId: run._id });
        summary.runsEnqueued += 1;
        orgDetail.runs.push({
          caregiverId: String(caregiverId),
          runId: String(run._id),
          action: 'processed_inline',
        });
      }
    }

    const allCaregivers = await Caregiver.find({ org: orgId, active: true }).select('_id notificationPreferences isEmailVerified').lean();
    const eligibleIds = new Set(eligibleCaregivers.map((c) => String(c._id)));
    summary.caregiversSkippedIneligible += allCaregivers.filter((c) => !eligibleIds.has(String(c._id))).length;

    summary.details.push(orgDetail);
  }

  logger.info('[CaregiverDailyDigestScheduler] Coordinator tick complete', {
    orgsInWindow: summary.orgsInWindow,
    runsEnqueued: summary.runsEnqueued,
    dryRun,
  });

  return summary;
};

/**
 * Process one caregiver or all eligible caregivers in an org for a local day.
 */
const processOrgDailyDigests = async ({ orgId, caregiverId, localDateKey, trigger, dryRun }) => {
  if (caregiverId) {
    const result = await processOneCaregiverDigest({
      orgId,
      caregiverId,
      localDateKey,
      trigger,
      dryRun,
    });
    return [result];
  }

  const eligible = await findEligibleCaregiversForOrg(orgId);
  const results = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const cg of eligible) {
    // Sequential to avoid duplicate claim races on shared resources
    // eslint-disable-next-line no-await-in-loop
    const result = await processOneCaregiverDigest({
      orgId,
      caregiverId: cg._id,
      localDateKey,
      trigger,
      dryRun,
    });
    results.push(result);
  }
  return results;
};

module.exports = {
  createOrGetSchedulerRun,
  claimSchedulerRun,
  processCaregiverDailyDigestRun,
  processCaregiverDailyDigestJob,
  processOneCaregiverDigest,
  findEligibleCaregiversForOrg,
  processOrgDailyDigests,
  findExistingSentDigestForLocalDay,
  recoverStaleProcessingRuns,
  runDailyDigestCoordinatorTick,
};
