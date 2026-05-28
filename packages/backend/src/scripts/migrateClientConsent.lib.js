/**
 * Core logic for migrating legacy client consent to GDPR per-purpose model.
 * Used by scripts/migrateClientConsent.js and unit tests.
 */

const { REQUIRED_CLIENT_CONSENT_PURPOSES } = require('../constants/clientConsent.constants');
const { getJurisdiction } = require('../utils/jurisdiction.utils');

const LEGACY_CONSENT_VERSION = 'legacy-1.0';
const MIGRATION_NOTES = 'Migrated from legacy consented boolean';

/**
 * True when the client already has per-purpose recording consent initialized.
 * @param {object} rawDoc - Raw MongoDB client document
 */
const hasRecordingPurposeExplicitlySet = (rawDoc) => {
  if (rawDoc.consentVersionByPurpose?.recording != null) {
    return true;
  }
  return (
    rawDoc.consentedPurposes != null &&
    Object.prototype.hasOwnProperty.call(rawDoc.consentedPurposes, 'recording')
  );
};

/**
 * @param {object} rawDoc
 * @returns {boolean}
 */
const shouldMigrateClient = (rawDoc) => {
  if (rawDoc.consentVersionByPurpose?.recording === LEGACY_CONSENT_VERSION) {
    return false;
  }
  if (hasRecordingPurposeExplicitlySet(rawDoc)) {
    return false;
  }
  return rawDoc.consented === true;
};

/**
 * @param {import('mongoose').Model} ConsentRecord
 * @param {import('mongoose').Types.ObjectId} clientId
 */
const hasMigrationConsentRecord = async (ConsentRecord, clientId) => {
  const existing = await ConsentRecord.findOne({
    clientId,
    recordType: 'grant',
    notes: MIGRATION_NOTES,
  }).lean();
  return Boolean(existing);
};

/**
 * @param {object} params
 * @param {import('mongoose').Model} params.Client
 * @param {import('mongoose').Model} params.Org
 * @param {import('mongoose').Model} params.ConsentRecord
 * @param {object} [params.logger]
 * @returns {Promise<{ processed: number; skipped: number; failed: number; failures: Array<{ clientId: string; error: string }> }>}
 */
const migrateClientConsent = async ({ Client, Org, ConsentRecord, logger = console }) => {
  const candidates = await Client.collection
    .find({
      $or: [{ consented: true }, { 'consentedPurposes.recording': { $exists: false } }],
    })
    .toArray();

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (const rawDoc of candidates) {
    const clientId = rawDoc._id;

    try {
      if (!shouldMigrateClient(rawDoc) || (await hasMigrationConsentRecord(ConsentRecord, clientId))) {
        skipped += 1;
        continue;
      }

      const org = rawDoc.org ? await Org.findById(rawDoc.org).lean() : null;
      const jurisdictionInfo = getJurisdiction(org?.country);
      const migratedAt = rawDoc.consentedAt ? new Date(rawDoc.consentedAt) : rawDoc.createdAt ? new Date(rawDoc.createdAt) : new Date();

      const consentedPurposes = REQUIRED_CLIENT_CONSENT_PURPOSES.reduce((acc, purpose) => {
        acc[purpose] = true;
        return acc;
      }, {});

      const consentedAtByPurpose = REQUIRED_CLIENT_CONSENT_PURPOSES.reduce((acc, purpose) => {
        acc[purpose] = migratedAt;
        return acc;
      }, {});

      const consentVersionByPurpose = REQUIRED_CLIENT_CONSENT_PURPOSES.reduce((acc, purpose) => {
        acc[purpose] = LEGACY_CONSENT_VERSION;
        return acc;
      }, {});

      await Client.updateOne(
        { _id: clientId },
        {
          $set: {
            consentedPurposes,
            consentedAtByPurpose,
            consentVersionByPurpose,
          },
        }
      );

      await ConsentRecord.create({
        userType: 'client',
        userId: clientId,
        userModel: 'Client',
        clientId,
        recordType: 'grant',
        jurisdiction: jurisdictionInfo.jurisdiction,
        legalBasis: 'consent',
        purposes: [...REQUIRED_CLIENT_CONSENT_PURPOSES],
        consentVersion: LEGACY_CONSENT_VERSION,
        consentType: 'collection',
        purpose: REQUIRED_CLIENT_CONSENT_PURPOSES.join(', '),
        granted: true,
        method: 'explicit',
        explicitConsent: {
          provided: true,
          providedAt: migratedAt,
          providedVia: 'migration',
          ipAddress: null,
          userAgent: null,
        },
        notes: MIGRATION_NOTES,
      });

      processed += 1;
      logger.info?.(`[migrateClientConsent] Migrated client ${clientId}`);
    } catch (error) {
      failed += 1;
      failures.push({
        clientId: clientId.toString(),
        error: error.message || String(error),
      });
      logger.error?.(`[migrateClientConsent] Failed for client ${clientId}:`, error);
    }
  }

  logger.info?.(
    `[migrateClientConsent] Complete — processed: ${processed}, skipped: ${skipped}, failed: ${failed}`
  );

  return { processed, skipped, failed, failures };
};

module.exports = {
  LEGACY_CONSENT_VERSION,
  MIGRATION_NOTES,
  hasRecordingPurposeExplicitlySet,
  shouldMigrateClient,
  hasMigrationConsentRecord,
  migrateClientConsent,
};
