/**
 * Migration: CaregiverDailyDigest versioning + immutable sent records
 *
 * - Backfill version=1, builtAt, payloadHash (and sentPayloadHash for sent rows)
 * - Replace unique index { caregiver, digestDate } with { caregiver, digestDate, version }
 *
 * NOTE: Uses db.collection('caregiverdailydigests').updateOne directly — intentional
 * bypass of Mongoose immutability hooks for one-time backfill only.
 *
 * Run: yarn migrate:up (from packages/backend)
 * Rollback: yarn migrate:down
 */

const { hashPayload } = require('../src/utils/digestPayloadHash');

const INDEX_SPECS = {
  versionedUnique: { key: { caregiver: 1, digestDate: 1, version: 1 }, options: { unique: true } },
  status: { key: { caregiver: 1, digestDate: 1, status: 1 }, options: {} },
  previousDigest: { key: { previousDigest: 1 }, options: {} },
  legacyUnique: { key: { caregiver: 1, digestDate: 1 }, options: { unique: true } },
};

const indexKeysMatch = (idx, expectedKey, { requireUnique = false, rejectVersion = false } = {}) => {
  if (!idx?.key) return false;
  if (requireUnique && !idx.unique) return false;
  const keys = Object.keys(expectedKey);
  if (Object.keys(idx.key).length !== keys.length) return false;
  for (const k of keys) {
    if (idx.key[k] !== expectedKey[k]) return false;
  }
  if (rejectVersion && idx.key.version != null) return false;
  return true;
};

const dropIndexIfExists = async (coll, matcher) => {
  const indexes = await coll.indexes();
  const found = indexes.find(matcher);
  if (!found) {
    return false;
  }
  try {
    await coll.dropIndex(found.name);
    console.log(`[Migration] caregiverdailydigests: dropped index ${found.name}`);
    return true;
  } catch (err) {
    console.warn(`[Migration] caregiverdailydigests: could not drop index ${found.name}: ${err.message}`);
    return false;
  }
};

const ensureIndex = async (coll, key, options = {}) => {
  const name = await coll.createIndex(key, options);
  console.log(`[Migration] caregiverdailydigests: ensured index ${name}`);
  return name;
};

const backfillPayloadHashes = async (coll) => {
  const cursor = coll.find({ payload: { $exists: true, $ne: null } });
  let updated = 0;
  // eslint-disable-next-line no-restricted-syntax
  for await (const doc of cursor) {
    if (!doc.payload || typeof doc.payload !== 'object') {
      continue;
    }
    const payloadHash = hashPayload(doc.payload);
    const $set = { payloadHash };
    if (doc.status === 'sent' && !doc.sentPayloadHash) {
      $set.sentPayloadHash = payloadHash;
    }
    if (doc.payloadHash === payloadHash && (doc.status !== 'sent' || doc.sentPayloadHash)) {
      continue;
    }
    await coll.updateOne({ _id: doc._id }, { $set });
    updated += 1;
  }
  if (updated > 0) {
    console.log(`[Migration] caregiverdailydigests: backfilled payloadHash on ${updated} document(s)`);
  }
};

module.exports = {
  async up(db) {
    const coll = db.collection('caregiverdailydigests');
    const now = new Date();

    const backfill = await coll.updateMany(
      { version: { $exists: false } },
      [
        {
          $set: {
            version: 1,
            builtAt: { $ifNull: ['$builtAt', { $ifNull: ['$createdAt', now] }] },
          },
        },
      ]
    );
    if (backfill.modifiedCount > 0) {
      console.log(
        `[Migration] caregiverdailydigests: backfilled version/builtAt on ${backfill.modifiedCount} document(s)`
      );
    }

    await backfillPayloadHashes(coll);

    await dropIndexIfExists(coll, (idx) =>
      indexKeysMatch(idx, INDEX_SPECS.legacyUnique.key, { requireUnique: true, rejectVersion: true })
    );

    await ensureIndex(coll, INDEX_SPECS.versionedUnique.key, INDEX_SPECS.versionedUnique.options);
    await ensureIndex(coll, INDEX_SPECS.status.key, INDEX_SPECS.status.options);
    await ensureIndex(coll, INDEX_SPECS.previousDigest.key, INDEX_SPECS.previousDigest.options);
  },

  async down(db) {
    const coll = db.collection('caregiverdailydigests');

    await dropIndexIfExists(coll, (idx) =>
      indexKeysMatch(idx, INDEX_SPECS.versionedUnique.key, { requireUnique: true })
    );
    await dropIndexIfExists(coll, (idx) => indexKeysMatch(idx, INDEX_SPECS.status.key));
    await dropIndexIfExists(coll, (idx) => indexKeysMatch(idx, INDEX_SPECS.previousDigest.key));

    const hasLegacy = (await coll.indexes()).some((idx) =>
      indexKeysMatch(idx, INDEX_SPECS.legacyUnique.key, { requireUnique: true, rejectVersion: true })
    );
    if (!hasLegacy) {
      await ensureIndex(coll, INDEX_SPECS.legacyUnique.key, INDEX_SPECS.legacyUnique.options);
    }

    console.log('[Migration] caregiverdailydigests: rollback complete (version fields retained on documents)');
  },
};
