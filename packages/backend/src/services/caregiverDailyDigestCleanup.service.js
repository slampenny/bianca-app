/**
 * CaregiverDailyDigest PHI retention cleanup.
 *
 * Sent digests are normally immutable; compliance redaction uses the native
 * MongoDB collection to bypass immutability guards (see immutability plugin).
 */

const mongoose = require('mongoose');
const { Org, Client, Caregiver, CaregiverDailyDigest } = require('../models');
const { hashPayload } = require('../utils/digestPayloadHash');
const { getDataRetentionPeriod } = require('../utils/jurisdiction.utils');
const logger = require('../config/logger');

const PHI_REDACTED_REASONS = [
  'client_deleted',
  'caregiver_deleted',
  'org_deleted',
  'retention_expired',
  'erasure_request',
  'orphaned',
];

const COLLECTION_NAME = 'caregiverdailydigests';

const getNativeCollection = () => mongoose.connection.db.collection(COLLECTION_NAME);

const buildRedactedPayload = (originalPayload = {}) => {
  const redacted = {
    version: originalPayload.version ?? 1,
    title: '[Redacted]',
    subtitle: '[Redacted]',
    dateLabel: originalPayload.dateLabel ?? '',
    labels: {},
    entries: [],
    generatedAt: originalPayload.generatedAt ?? null,
    phiRedacted: true,
  };
  if (originalPayload.digestDayStartIso != null) {
    redacted.digestDayStartIso = originalPayload.digestDayStartIso;
  } else if (originalPayload.digestDateUtc != null) {
    redacted.digestDateUtc = originalPayload.digestDateUtc;
  }
  return redacted;
};

const stripClientFromPayload = (payload, clientIdStr) => {
  const entries = (payload?.entries || []).filter((e) => e.clientId !== clientIdStr);
  if (entries.length === 0) {
    return buildRedactedPayload(payload);
  }
  return { ...payload, entries };
};

/**
 * Compliance-only update that bypasses sent-digest immutability guards.
 * sentPayloadHash is intentionally not modified — it records what was emailed at send time.
 */
const applyDigestRedaction = async (digestId, reason, payload, extraFields = {}) => {
  const update = {
    payload,
    payloadHash: hashPayload(payload),
    updatedAt: new Date(),
    ...extraFields,
  };

  if (payload?.phiRedacted === true) {
    update.phiRedactedAt = new Date();
    update.phiRedactedReason = reason;
  }

  await getNativeCollection().updateOne({ _id: new mongoose.Types.ObjectId(String(digestId)) }, { $set: update });
};

const redactDigest = async (digest, reason, extraFields = {}) => {
  const redactedPayload = buildRedactedPayload(digest.payload);
  await applyDigestRedaction(digest._id, reason, redactedPayload, extraFields);
  return 1;
};

const isAlreadyRedacted = (digest) => Boolean(digest.phiRedactedAt || digest.payload?.phiRedacted);

const normalizeClientId = (clientId) => String(clientId);

/**
 * Remove one client's PHI from all digests referencing them.
 */
const cleanupDigestsForClient = async (clientId, reason = 'client_deleted') => {
  const clientIdStr = normalizeClientId(clientId);
  const digests = await CaregiverDailyDigest.find({
    phiRedactedAt: null,
    'payload.entries.clientId': clientIdStr,
  }).lean();

  let redacted = 0;
  let deleted = 0;

  for (const digest of digests) {
    if (isAlreadyRedacted(digest)) {
      continue;
    }

    const newPayload = stripClientFromPayload(digest.payload, clientIdStr);
    const fullyRedacted = newPayload.phiRedacted === true;

    if (digest.status === 'draft') {
      if (fullyRedacted) {
        await CaregiverDailyDigest.deleteOne({ _id: digest._id });
        deleted += 1;
      } else {
        await CaregiverDailyDigest.updateOne(
          { _id: digest._id },
          { $set: { payload: newPayload, payloadHash: hashPayload(newPayload) } }
        );
        redacted += 1;
      }
      continue;
    }

    await applyDigestRedaction(digest._id, reason, newPayload);
    redacted += 1;
  }

  logger.info(`[Digest Cleanup] Client ${clientIdStr}: redacted ${redacted}, deleted ${deleted} drafts (${reason})`);
  return { redacted, deleted };
};

const cleanupDigestsForClients = async (clientIds, reason = 'erasure_request') => {
  const totals = { redacted: 0, deleted: 0 };
  for (const clientId of clientIds) {
    const result = await cleanupDigestsForClient(clientId, reason);
    totals.redacted += result.redacted;
    totals.deleted += result.deleted;
  }
  return totals;
};

/**
 * Redact all digests owned by a caregiver (drafts deleted, sent records anonymized).
 */
const cleanupDigestsForCaregiver = async (caregiverId, reason = 'caregiver_deleted') => {
  const caregiverObjectId =
    typeof caregiverId === 'string' && mongoose.Types.ObjectId.isValid(caregiverId)
      ? new mongoose.Types.ObjectId(caregiverId)
      : caregiverId;

  const digests = await CaregiverDailyDigest.find({
    caregiver: caregiverObjectId,
    phiRedactedAt: null,
  }).lean();

  let redacted = 0;
  let deleted = 0;

  for (const digest of digests) {
    if (isAlreadyRedacted(digest)) {
      continue;
    }

    if (digest.status === 'draft') {
      await CaregiverDailyDigest.deleteOne({ _id: digest._id });
      deleted += 1;
      continue;
    }

    await redactDigest(digest, reason, {
      emailRecipient: null,
      emailSubject: null,
    });
    redacted += 1;
  }

  logger.info(`[Digest Cleanup] Caregiver ${caregiverId}: redacted ${redacted}, deleted ${deleted} drafts (${reason})`);
  return { redacted, deleted };
};

/**
 * Redact all digests for an organization.
 */
const cleanupDigestsForOrg = async (orgId, reason = 'org_deleted') => {
  const orgObjectId =
    typeof orgId === 'string' && mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;

  const digests = await CaregiverDailyDigest.find({
    org: orgObjectId,
    phiRedactedAt: null,
  }).lean();

  let redacted = 0;
  let deleted = 0;

  for (const digest of digests) {
    if (isAlreadyRedacted(digest)) {
      continue;
    }

    if (digest.status === 'draft') {
      await CaregiverDailyDigest.deleteOne({ _id: digest._id });
      deleted += 1;
      continue;
    }

    await redactDigest(digest, reason, {
      emailRecipient: null,
      emailSubject: null,
    });
    redacted += 1;
  }

  logger.info(`[Digest Cleanup] Org ${orgId}: redacted ${redacted}, deleted ${deleted} drafts (${reason})`);
  return { redacted, deleted };
};

/**
 * Delete draft / redact sent digests past the conversation retention window.
 */
const deleteExpiredDigestsForCountry = async (country, retentionYears) => {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

  const orgs = await Org.find({ country });
  const orgIds = orgs.map((o) => o._id);
  if (orgIds.length === 0) {
    return { redacted: 0, deleted: 0 };
  }

  const expiredDigests = await CaregiverDailyDigest.find({
    org: { $in: orgIds },
    digestDate: { $lt: cutoffDate },
    phiRedactedAt: null,
  }).lean();

  let redacted = 0;
  let deleted = 0;

  for (const digest of expiredDigests) {
    if (digest.status === 'draft') {
      await CaregiverDailyDigest.deleteOne({ _id: digest._id });
      deleted += 1;
      continue;
    }

    await redactDigest(digest, 'retention_expired', {
      emailRecipient: null,
      emailSubject: null,
    });
    redacted += 1;
  }

  logger.info(
    `[Digest Cleanup] Expired digests for ${country} (>${retentionYears}y): redacted ${redacted}, deleted ${deleted} drafts`
  );
  return { redacted, deleted };
};

/**
 * Redact digests whose org/caregiver was soft-deleted or whose entries reference missing clients.
 */
const cleanupOrphanedDigests = async (country = null) => {
  const filter = { phiRedactedAt: null };
  if (country) {
    const orgs = await Org.find({ country });
    const orgIds = orgs.map((o) => o._id);
    if (orgIds.length === 0) {
      return { redacted: 0, deleted: 0, entriesStripped: 0 };
    }
    filter.org = { $in: orgIds };
  }

  const digests = await CaregiverDailyDigest.find(filter).lean();
  let redacted = 0;
  let deleted = 0;
  let entriesStripped = 0;

  for (const digest of digests) {
    if (isAlreadyRedacted(digest)) {
      continue;
    }

    const org = Org.findOneWithDeleted
      ? await Org.findOneWithDeleted({ _id: digest.org })
      : await Org.findOne({ _id: digest.org });
    const caregiver = Caregiver.findOneWithDeleted
      ? await Caregiver.findOneWithDeleted({ _id: digest.caregiver })
      : await Caregiver.findOne({ _id: digest.caregiver });

    if (!org || org.deleted || !caregiver || caregiver.deleted) {
      if (digest.status === 'draft') {
        await CaregiverDailyDigest.deleteOne({ _id: digest._id });
        deleted += 1;
      } else {
        await redactDigest(digest, 'orphaned', { emailRecipient: null, emailSubject: null });
        redacted += 1;
      }
      continue;
    }

    const entryClientIds = (digest.payload?.entries || []).map((e) => e.clientId).filter(Boolean);
    if (entryClientIds.length === 0) {
      continue;
    }

    const existingClients = Client.findWithDeleted
      ? await Client.findWithDeleted({ _id: { $in: entryClientIds } }).select('_id deleted').lean()
      : await Client.find({ _id: { $in: entryClientIds } }).select('_id deleted').lean();
    const existingById = new Map(existingClients.map((c) => [String(c._id), c]));

    let payload = digest.payload;
    let changed = false;
    for (const clientIdStr of entryClientIds) {
      const client = existingById.get(clientIdStr);
      if (!client || client.deleted) {
        payload = stripClientFromPayload(payload, clientIdStr);
        changed = true;
        entriesStripped += 1;
      }
    }

    if (!changed) {
      continue;
    }

    const fullyRedacted = payload.phiRedacted === true;
    if (digest.status === 'draft') {
      if (fullyRedacted) {
        await CaregiverDailyDigest.deleteOne({ _id: digest._id });
        deleted += 1;
      } else {
        await CaregiverDailyDigest.updateOne(
          { _id: digest._id },
          { $set: { payload, payloadHash: hashPayload(payload) } }
        );
        redacted += 1;
      }
      continue;
    }

    await applyDigestRedaction(digest._id, 'orphaned', payload);
    redacted += 1;
  }

  logger.info(
    `[Digest Cleanup] Orphaned digests${country ? ` (${country})` : ''}: redacted ${redacted}, deleted ${deleted} drafts, stripped ${entriesStripped} entries`
  );
  return { redacted, deleted, entriesStripped };
};

module.exports = {
  PHI_REDACTED_REASONS,
  buildRedactedPayload,
  stripClientFromPayload,
  cleanupDigestsForClient,
  cleanupDigestsForClients,
  cleanupDigestsForCaregiver,
  cleanupDigestsForOrg,
  deleteExpiredDigestsForCountry,
  cleanupOrphanedDigests,
};
