// src/scripts/runDailyDigestScheduler.js
const mongoose = require('mongoose');
const config = require('../config/config');
const logger = require('../config/logger');
const { processOrgDailyDigests } = require('../services/caregiverDailyDigestScheduler.service');

const VALID_TRIGGERS = new Set(['manual_test', 'manual_backfill', 'scheduled']);

const parseArgs = (argv) => {
  const args = { dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dryRun') {
      args.dryRun = true;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
};

const summarizeResult = (result) => {
  const { run, outcome, skipReason, idempotent, dryRun: isDryRun } = result;
  const base = {
    runId: run?.id || String(run?._id),
    caregiverId: String(run?.caregiver),
    localDateKey: run?.localDateKey,
    status: run?.status,
    outcome,
    idempotent: Boolean(idempotent),
    dryRun: Boolean(isDryRun),
  };
  if (skipReason) {
    base.skipReason = skipReason;
  }
  if (run?.digestId) {
    base.digestId = String(run.digestId);
  }
  if (run?.emailMessageId) {
    base.emailMessageId = run.emailMessageId;
  }
  return base;
};

(async () => {
  try {
    const args = parseArgs(process.argv);

    if (!args.orgId) {
      throw new Error('--orgId is required');
    }
    if (!args.localDateKey) {
      throw new Error('--localDateKey is required (YYYY-MM-DD)');
    }

    const trigger = args.trigger || 'manual_test';
    if (!VALID_TRIGGERS.has(trigger)) {
      throw new Error(`--trigger must be one of: ${[...VALID_TRIGGERS].join(', ')}`);
    }

    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');

    console.log('Running Daily Wellness Digest scheduler (manual entry point)...');
    console.log(
      JSON.stringify(
        {
          orgId: args.orgId,
          caregiverId: args.caregiverId || null,
          localDateKey: args.localDateKey,
          trigger,
          dryRun: Boolean(args.dryRun),
        },
        null,
        2
      )
    );

    const results = await processOrgDailyDigests({
      orgId: args.orgId,
      caregiverId: args.caregiverId || null,
      localDateKey: args.localDateKey,
      trigger,
      dryRun: Boolean(args.dryRun),
    });

    console.log(`Processed ${results.length} caregiver(s):`);
    results.forEach((result, index) => {
      console.log(`  [${index + 1}]`, JSON.stringify(summarizeResult(result)));
    });

    process.exit(0);
  } catch (error) {
    console.error('Error running Daily Wellness Digest scheduler:', error);
    process.exit(1);
  }
})();
