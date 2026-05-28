/**
 * Backfill reversed-memory fields and archive unsafe legacy ClientMemory rows.
 *
 * Usage (from packages/backend):
 *   node scripts/migrateClientMemoryReversed.js
 *   node scripts/migrateClientMemoryReversed.js --dry-run
 */
const mongoose = require('mongoose');
const config = require('../src/config/config');
const { ClientMemory } = require('../src/models/clientMemory.model');
const logger = require('../src/config/logger');
const {
  buildNormalizedKey,
  mapConfidenceToScore,
  inferSensitivity,
  getDefaultDecayPolicy,
  computeExpiresAt,
  isUnsafeFactText,
  hydrateFact,
} = require('../src/utils/clientMemory.scoring');

const dryRun = process.argv.includes('--dry-run');

const stats = {
  scanned: 0,
  updated: 0,
  duplicatesFound: 0,
  duplicatesMerged: 0,
  unsafeArchived: 0,
};

const pickCanonicalDuplicate = (rows) => {
  return rows.sort((a, b) => {
    const countDiff = (b.reinforcementCount || 1) - (a.reinforcementCount || 1);
    if (countDiff !== 0) return countDiff;
    return new Date(b.lastObservedAt || b.extractedAt || 0) - new Date(a.lastObservedAt || a.extractedAt || 0);
  })[0];
};

const mergeDuplicateGroup = async (rows) => {
  if (rows.length <= 1) return;

  stats.duplicatesFound += rows.length - 1;
  const canonical = pickCanonicalDuplicate(rows);
  const others = rows.filter((r) => r._id.toString() !== canonical._id.toString());

  const mergedSourceIds = [...(canonical.sourceIds || [])];
  let mergedCount = canonical.reinforcementCount || 1;
  for (const row of others) {
    mergedCount += row.reinforcementCount || 1;
    for (const sid of row.sourceIds || []) {
      const sidStr = sid.toString();
      if (!mergedSourceIds.some((id) => id.toString() === sidStr)) {
        mergedSourceIds.push(sid);
      }
    }
  }

  if (!dryRun) {
    await ClientMemory.updateOne(
      { _id: canonical._id },
      {
        $set: {
          reinforcementCount: mergedCount,
          sourceIds: mergedSourceIds,
          status: canonical.status === 'archived' ? 'archived' : canonical.status || 'active',
        },
      }
    );
    await ClientMemory.updateMany(
      { _id: { $in: others.map((r) => r._id) } },
      { $set: { status: 'archived' } }
    );
  }

  stats.duplicatesMerged += others.length;
};

const backfillRow = async (row) => {
  const hydrated = hydrateFact(row);
  const updates = {};
  let needsUpdate = false;

  if (!row.normalizedKey) {
    updates.normalizedKey = buildNormalizedKey(row.category, row.fact);
    needsUpdate = true;
  }
  if (row.confidenceScore == null) {
    updates.confidenceScore = mapConfidenceToScore(row.confidence);
    needsUpdate = true;
  }
  if (!row.firstObservedAt) {
    updates.firstObservedAt = row.extractedAt || row.createdAt || new Date();
    needsUpdate = true;
  }
  if (!row.lastObservedAt) {
    updates.lastObservedAt = row.extractedAt || row.createdAt || new Date();
    needsUpdate = true;
  }
  if (!row.decayPolicy) {
    updates.decayPolicy = getDefaultDecayPolicy(row.category, hydrated.sensitivity);
    needsUpdate = true;
  }
  if (!row.expiresAt) {
    const base = updates.lastObservedAt || row.lastObservedAt || row.extractedAt || new Date();
    updates.expiresAt = computeExpiresAt(new Date(base), updates.decayPolicy || hydrated.decayPolicy);
    needsUpdate = true;
  }
  if (!row.sensitivity) {
    updates.sensitivity = inferSensitivity(row.category, row.priority);
    needsUpdate = true;
  }

  if (isUnsafeFactText(row.fact) && row.status !== 'archived') {
    updates.status = 'archived';
    needsUpdate = true;
    stats.unsafeArchived += 1;
  }

  if (needsUpdate && !dryRun) {
    await ClientMemory.updateOne({ _id: row._id }, { $set: updates });
  }
  if (needsUpdate) {
    stats.updated += 1;
  }
};

const run = async () => {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  logger.info(`[MigrateClientMemory] Connected (dryRun=${dryRun})`);

  const rows = await ClientMemory.find({ deletedAt: null }).lean();
  stats.scanned = rows.length;

  for (const row of rows) {
    await backfillRow(row);
  }

  const byKey = new Map();
  for (const row of rows) {
    if (row.deletedAt || row.status === 'archived') continue;
    const key = row.normalizedKey || buildNormalizedKey(row.category, row.fact);
    const groupKey = `${row.clientId}:${key}`;
    if (!byKey.has(groupKey)) byKey.set(groupKey, []);
    byKey.get(groupKey).push(row);
  }

  for (const group of byKey.values()) {
    if (group.length > 1) {
      await mergeDuplicateGroup(group);
    }
  }

  logger.info('[MigrateClientMemory] Summary:', stats);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('[MigrateClientMemory] Fatal error:', err);
  process.exit(1);
});
