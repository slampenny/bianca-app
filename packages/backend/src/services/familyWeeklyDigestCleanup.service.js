/**
 * FamilyWeeklyDigest PHI retention cleanup.
 *
 * Sent digests are normally immutable; compliance redaction uses the native
 * MongoDB collection to bypass immutability guards (see immutability plugin).
 */

const mongoose = require('mongoose');
const { Org, Client, FamilyWeeklyDigest } = require('../models');
const { hashPayload } = require('../utils/digestPayloadHash');
const logger = require('../config/logger');

const PHI_REDACTED_REASONS = [
  'client_deleted',
  'caregiver_deleted',
  'org_deleted',
  'retention_expired',
  'erasure_request',
  'orphaned',
];

const COLLECTION_NAME = 'familyweeklydigests';

const getNativeCollection = () => mongoose.connection.db.collection(COLLECTION_NAME);

const buildRedactedPayload = (originalPayload = {}) => ({
  version: originalPayload.version ?? 1,
  title: '[Redacted]',
  subtitleParts: {
    recipientLine: '[Redacted]',
    residentLine: '[Redacted]',
  },
  facilityName: '[Redacted]',
  generatedAt: originalPayload.generatedAt ?? null,
  weekStart: originalPayload.weekStart ?? null,
  weekEnd: originalPayload.weekEnd ?? null,
  narrative: [],
  atAGlance: {
    weekRangeLabel: originalPayload.atAGlance?.weekRangeLabel ?? '',
    callsPlaced: 0,
    answeredCount: 0,
    typicalMinutesWhenConnected: null,
  },
  callRows: [],
  exclusions: [],
  eligibility: { ok: false, reasons: [], warnings: [] },
  phiRedacted: true,
});

const REDACTED_RECIPIENT = {
  name: '',
  relationship: '',
  email: '',
};

const isAlreadyRedacted = (digest) => Boolean(digest.phiRedactedAt || digest.payload?.phiRedacted);

const normalizeClientId = (clientId) => String(clientId);

/**
 * Compliance redaction update (native collection bypasses sent-digest immutability guards).
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
  await applyDigestRedaction(digest._id, reason, redactedPayload, {
    recipient: REDACTED_RECIPIENT,
    emailRecipient: null,
    emailSubject: null,
    ...extraFields,
  });
  return 1;
};

/**
 * Redact or delete all digests for one client.
 */
const cleanupDigestsForClient = async (clientId, reason = 'client_deleted') => {
  const clientObjectId =
    typeof clientId === 'string' && mongoose.Types.ObjectId.isValid(clientId)
      ? new mongoose.Types.ObjectId(clientId)
      : clientId;

  const digests = await FamilyWeeklyDigest.find({
    client: clientObjectId,
    phiRedactedAt: null,
  }).lean();

  let redacted = 0;
  let deleted = 0;

  for (const digest of digests) {
    if (isAlreadyRedacted(digest)) {
      continue;
    }

    if (digest.status === 'draft') {
      await FamilyWeeklyDigest.deleteOne({ _id: digest._id });
      deleted += 1;
      continue;
    }

    await redactDigest(digest, reason);
    redacted += 1;
  }

  logger.info(
    `[Family Digest Cleanup] Client ${normalizeClientId(clientId)}: redacted ${redacted}, deleted ${deleted} drafts (${reason})`
  );
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
 * Delete in-progress drafts authored by a departing caregiver.
 * Sent family digests remain — they are client-scoped audit records of external disclosure.
 */
const cleanupDigestsForCaregiver = async (caregiverId, reason = 'caregiver_deleted') => {
  const caregiverObjectId =
    typeof caregiverId === 'string' && mongoose.Types.ObjectId.isValid(caregiverId)
      ? new mongoose.Types.ObjectId(caregiverId)
      : caregiverId;

  const drafts = await FamilyWeeklyDigest.find({
    createdBy: caregiverObjectId,
    status: 'draft',
    phiRedactedAt: null,
  }).lean();

  let deleted = 0;
  for (const digest of drafts) {
    await FamilyWeeklyDigest.deleteOne({ _id: digest._id });
    deleted += 1;
  }

  logger.info(
    `[Family Digest Cleanup] Caregiver ${caregiverId}: deleted ${deleted} drafts (${reason}); sent records preserved`
  );
  return { redacted: 0, deleted };
};

/**
 * Redact all digests for an organization (drafts deleted, sent records anonymized).
 */
const cleanupDigestsForOrg = async (orgId, reason = 'org_deleted') => {
  const orgObjectId =
    typeof orgId === 'string' && mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;

  const digests = await FamilyWeeklyDigest.find({
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
      await FamilyWeeklyDigest.deleteOne({ _id: digest._id });
      deleted += 1;
      continue;
    }

    await redactDigest(digest, reason);
    redacted += 1;
  }

  logger.info(`[Family Digest Cleanup] Org ${orgId}: redacted ${redacted}, deleted ${deleted} drafts (${reason})`);
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

  const expiredDigests = await FamilyWeeklyDigest.find({
    org: { $in: orgIds },
    weekStart: { $lt: cutoffDate },
    phiRedactedAt: null,
  }).lean();

  let redacted = 0;
  let deleted = 0;

  for (const digest of expiredDigests) {
    if (digest.status === 'draft') {
      await FamilyWeeklyDigest.deleteOne({ _id: digest._id });
      deleted += 1;
      continue;
    }

    await redactDigest(digest, 'retention_expired');
    redacted += 1;
  }

  logger.info(
    `[Family Digest Cleanup] Expired digests for ${country} (>${retentionYears}y): redacted ${redacted}, deleted ${deleted} drafts`
  );
  return { redacted, deleted };
};

/**
 * Redact digests whose org/client was soft-deleted or hard-deleted.
 */
const cleanupOrphanedDigests = async (country = null) => {
  const filter = { phiRedactedAt: null };
  if (country) {
    const orgs = await Org.find({ country });
    const orgIds = orgs.map((o) => o._id);
    if (orgIds.length === 0) {
      return { redacted: 0, deleted: 0 };
    }
    filter.org = { $in: orgIds };
  }

  const digests = await FamilyWeeklyDigest.find(filter).lean();
  let redacted = 0;
  let deleted = 0;

  for (const digest of digests) {
    if (isAlreadyRedacted(digest)) {
      continue;
    }

    const org = Org.findOneWithDeleted
      ? await Org.findOneWithDeleted({ _id: digest.org })
      : await Org.findOne({ _id: digest.org });
    const client = Client.findOneWithDeleted
      ? await Client.findOneWithDeleted({ _id: digest.client })
      : await Client.findOne({ _id: digest.client });

    const orgMissing = !org || org.deleted;
    const clientMissing = !client || client.deleted;

    if (!orgMissing && !clientMissing) {
      continue;
    }

    if (digest.status === 'draft') {
      await FamilyWeeklyDigest.deleteOne({ _id: digest._id });
      deleted += 1;
      continue;
    }

    await redactDigest(digest, 'orphaned');
    redacted += 1;
  }

  logger.info(
    `[Family Digest Cleanup] Orphaned digests${country ? ` (${country})` : ''}: redacted ${redacted}, deleted ${deleted} drafts`
  );
  return { redacted, deleted };
};

module.exports = {
  PHI_REDACTED_REASONS,
  buildRedactedPayload,
  cleanupDigestsForClient,
  cleanupDigestsForClients,
  cleanupDigestsForCaregiver,
  cleanupDigestsForOrg,
  deleteExpiredDigestsForCountry,
  cleanupOrphanedDigests,
};
