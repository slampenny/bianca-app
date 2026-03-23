/**
 * One-time backfill: extract facts from existing finalized conversations.
 * Run from packages/backend: node scripts/backfillClientMemory.js
 *
 * Processes conversations that have a non-empty history (summary) field,
 * oldest-first, with a delay between each to avoid rate limits.
 * Skips conversations that already have at least one ClientMemory row tied to that conversationId.
 */
const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Conversation } = require('../src/models');
const { ClientMemory } = require('../src/models/clientMemory.model');
const { extractAndStoreFacts } = require('../src/services/clientMemory.service');
const logger = require('../src/config/logger');

const DELAY_MS = 2000; // 2s between calls to stay within OpenAI rate limits
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

  for (const conv of conversations) {
    try {
      logger.info(`[Backfill] Processing conversation ${conv._id} for client ${conv.clientId}`);
      await extractAndStoreFacts(conv.clientId.toString(), conv._id.toString(), conv.history);
      await sleep(DELAY_MS);
    } catch (err) {
      logger.error(`[Backfill] Failed for conversation ${conv._id}: ${err.message}`);
    }
  }

  logger.info('[Backfill] Done');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
