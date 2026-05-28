/**
 * One-time backfill: extract facts from existing finalized conversations.
 * Run from packages/backend: node scripts/backfillClientMemory.js
 *
 * Processes conversations that have a non-empty history (summary) field,
 * oldest-first, with a delay between each to avoid rate limits.
 * Skips conversations that already have at least one ClientMemory row tied to that conversationId.
 * Respects aiAnalysis consent per client.
 */
const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Conversation, Client } = require('../src/models');
const { ClientMemory } = require('../src/models/clientMemory.model');
const { extractAndStoreFacts, hasAiAnalysisConsent } = require('../src/services/clientMemory.service');
const logger = require('../src/config/logger');

const DELAY_MS = 2000;
const BATCH_SIZE = 50;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  logger.info('[Backfill] Connected to MongoDB');

  const processedConvIds = await ClientMemory.distinct('conversationId', {
    conversationId: { $exists: true, $ne: null },
  });

  const conversations = await Conversation.find({
    history: {
      $exists: true,
      $nin: ['', null],
      $ne: 'Summary generation failed - manual review needed',
    },
    _id: { $nin: processedConvIds },
  })
    .select('_id clientId history createdAt')
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  logger.info(`[Backfill] Found ${conversations.length} conversations to process`);

  let skippedConsent = 0;
  let processed = 0;

  for (const conv of conversations) {
    try {
      const allowed = await hasAiAnalysisConsent(conv.clientId);
      if (!allowed) {
        logger.info(`[Backfill] Skipping conversation ${conv._id} — aiAnalysis consent not granted for client ${conv.clientId}`);
        skippedConsent += 1;
        continue;
      }

      logger.info(`[Backfill] Processing conversation ${conv._id} for client ${conv.clientId}`);
      await extractAndStoreFacts(conv.clientId.toString(), conv._id.toString(), conv.history, { skipConsentCheck: true });
      processed += 1;
      await sleep(DELAY_MS);
    } catch (err) {
      logger.error(`[Backfill] Failed for conversation ${conv._id}: ${err.message}`);
    }
  }

  logger.info(`[Backfill] Done — processed=${processed}, skippedConsent=${skippedConsent}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
