/**
 * Immutability guards for FamilyWeeklyDigest.
 *
 * Sent digests are immutable. Application writes must go through
 * familyWeeklyDigest.service helpers (updateDraftDigest, markDigestSent).
 *
 * Guards:
 * - Mongoose document save() when prior status is sent
 * - Query middleware: updateOne, updateMany, findOneAndUpdate, findByIdAndUpdate, replaceOne, findOneAndReplace
 * - Native collection mutators: updateOne, updateMany, replaceOne, bulkWrite (update/replace ops)
 *
 * Intentional bypass:
 * - familyWeeklyDigestCleanup.service (compliance redaction via native db.collection)
 * - migrate-mongo scripts using db.collection('familyweeklydigests') directly
 */

const IMMUTABLE_SENT_ERROR = 'Sent digest records are immutable';

const countSentMatches = async (model, filter) => {
  if (!filter || typeof filter !== 'object') {
    return 0;
  }
  return model.countDocuments({ ...filter, status: 'sent' });
};

const assertNoSentMatches = async (model, filter) => {
  const sentCount = await countSentMatches(model, filter);
  if (sentCount > 0) {
    throw new Error(IMMUTABLE_SENT_ERROR);
  }
};

const blockSentDigestUpdateQuery = async function blockSentDigestUpdateQuery() {
  await assertNoSentMatches(this.model, this.getFilter());
};

const guardSentDocumentSave = async function guardSentDocumentSave(next) {
  if (this.isNew) {
    return next();
  }
  const prior = await this.constructor.findById(this._id).select('status').lean();
  if (prior?.status !== 'sent') {
    return next();
  }
  const modified = this.modifiedPaths().filter((p) => p !== 'updatedAt' && !p.startsWith('updatedAt'));
  if (modified.length > 0) {
    return next(new Error(IMMUTABLE_SENT_ERROR));
  }
  return next();
};

const wrapCollectionMutators = (model) => {
  const { collection } = model;
  if (!collection || collection.__familyDigestImmutabilityWrapped) {
    return;
  }

  const wrap = (methodName) => {
    const original = collection[methodName]?.bind(collection);
    if (!original) {
      return;
    }
    collection[methodName] = async (filter, ...rest) => {
      await assertNoSentMatches(model, filter);
      return original(filter, ...rest);
    };
  };

  ['updateOne', 'updateMany', 'replaceOne'].forEach(wrap);

  if (typeof collection.bulkWrite === 'function') {
    const originalBulkWrite = collection.bulkWrite.bind(collection);
    collection.bulkWrite = async (operations, options) => {
      if (Array.isArray(operations)) {
        for (const op of operations) {
          const filter =
            op.updateOne?.filter ||
            op.updateMany?.filter ||
            op.replaceOne?.filter ||
            null;
          if (filter && (op.updateOne || op.updateMany || op.replaceOne)) {
            await assertNoSentMatches(model, filter);
          }
        }
      }
      return originalBulkWrite(operations, options);
    };
  }

  collection.__familyDigestImmutabilityWrapped = true;
};

const familyWeeklyDigestImmutabilityPlugin = (schema) => {
  schema.pre('save', guardSentDocumentSave);

  [
    'findOneAndUpdate',
    'findByIdAndUpdate',
    'updateOne',
    'updateMany',
    'replaceOne',
    'findOneAndReplace',
  ].forEach((hook) => {
    schema.pre(hook, blockSentDigestUpdateQuery);
  });

  schema.post('init', function attachCollectionGuardsOnInit() {
    wrapCollectionMutators(this.constructor);
  });

  schema.statics.installDigestImmutabilityCollectionGuards = function installDigestImmutabilityCollectionGuards() {
    wrapCollectionMutators(this);
  };
};

module.exports = {
  IMMUTABLE_SENT_ERROR,
  familyWeeklyDigestImmutabilityPlugin,
  assertNoSentMatches,
  wrapCollectionMutators,
};
