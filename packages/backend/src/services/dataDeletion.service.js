/**
 * Data Deletion Service
 * 
 * Handles automated and user-initiated data deletion based on jurisdiction-specific retention rules
 * 
 * PIPEDA: Auto-deletes data after retention period
 * HIPAA: Never auto-deletes (legal requirement - 7 year retention)
 */

const {
  getJurisdiction,
  getDataRetentionPeriod,
  shouldAutoDeleteData,
  allowsErasureRequest,
  getErasureDenialLegalBasis,
} = require('../utils/jurisdiction.utils');
const {
  Org,
  Client,
  Call,
  Conversation,
  Message,
  MedicalAnalysis,
  ConsentRecord,
  AuditLog,
  ErasureCompletionRecord,
  PrivacyRequest,
} = require('../models');
const { ClientMemory } = require('../models/clientMemory.model');
const clientMemoryService = require('./clientMemory.service');
const s3Service = require('./s3.service');
const logger = require('../config/logger');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');

/**
 * Get organization country from client or user
 * @param {ObjectId} clientId - Client ID
 * @param {ObjectId} userId - User ID (caregiver)
 * @returns {Promise<string>} - Country code
 */
async function getOrganizationCountry(clientId = null, userId = null) {
  let org = null;
  
  if (clientId) {
    const client = await Client.findById(clientId).populate('org');
    org = client?.org;
  } else if (userId) {
    const Caregiver = require('../models/caregiver.model');
    const caregiver = await Caregiver.findById(userId).populate('org');
    org = caregiver?.org;
  }
  
  return org?.country ?? null;
}

/**
 * Delete expired call recordings based on jurisdiction
 * @param {string} country - Organization country
 * @returns {Promise<number>} - Number of calls deleted
 */
async function deleteExpiredCallRecordings(country) {
  const jurisdiction = getJurisdiction(country);
  const retention = getDataRetentionPeriod(country, 'callRecordings');
  
  // HIPAA: Never auto-delete
  if (!retention.autoDelete) {
    logger.info(`[Data Deletion] Skipping call recording deletion for ${jurisdiction.jurisdiction} (retention required)`);
    return 0;
  }
  
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retention.years);
  
  // Get all orgs with this country
  const orgs = await Org.find({ country });
  const orgIds = orgs.map(o => o._id);
  
  // Get patients for these orgs
  const patients = await Client.find({ org: { $in: orgIds } });
  const clientIds = patients.map(p => p._id);
  
  if (clientIds.length === 0) {
    return 0;
  }
  
  // Find expired calls for these patients
  const expiredCalls = await Call.find({
    clientId: { $in: clientIds },
    startTime: { $lt: cutoffDate },
    // Only delete if no active billing references
    lineItemId: null
  });
  
  let deletedCount = 0;
  for (const call of expiredCalls) {
    try {
      // Delete associated conversation if exists
      if (call.conversationId) {
        const conversation = await Conversation.findById(call.conversationId);
        if (conversation) {
          await clientMemoryService.suppressFactsForConversation(conversation._id, 'retention_expired');
          // Delete associated messages
          await Message.deleteMany({ conversationId: conversation._id });
          await conversation.deleteOne();
        }
      }
      
      await call.deleteOne();
      deletedCount++;
    } catch (error) {
      logger.error(`[Data Deletion] Failed to delete call ${call._id}:`, error);
    }
  }
  
  logger.info(`[Data Deletion] Deleted ${deletedCount} expired call recordings (older than ${retention.years} years) for ${jurisdiction.jurisdiction}`);
  return deletedCount;
}

/**
 * Delete expired conversations based on jurisdiction
 * @param {string} country - Organization country
 * @returns {Promise<number>} - Number of conversations deleted
 */
async function deleteExpiredConversations(country) {
  const jurisdiction = getJurisdiction(country);
  const retention = getDataRetentionPeriod(country, 'conversations');
  
  // HIPAA: Never auto-delete
  if (!retention.autoDelete) {
    logger.info(`[Data Deletion] Skipping conversation deletion for ${jurisdiction.jurisdiction} (retention required)`);
    return 0;
  }
  
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retention.years);
  
  // Get all orgs with this country
  const orgs = await Org.find({ country });
  const orgIds = orgs.map(o => o._id);
  
  // Get patients for these orgs
  const patients = await Client.find({ org: { $in: orgIds } });
  const clientIds = patients.map(p => p._id);
  
  if (clientIds.length === 0) {
    return 0;
  }
  
  // Find expired conversations for these patients
  const expiredConversations = await Conversation.find({
    clientId: { $in: clientIds },
    createdAt: { $lt: cutoffDate }
  });
  
  let deletedCount = 0;
  for (const conversation of expiredConversations) {
    try {
      await clientMemoryService.suppressFactsForConversation(conversation._id, 'retention_expired');

      // Delete associated messages
      await Message.deleteMany({ conversationId: conversation._id });
      
      // Update call to remove conversation reference
      await Call.updateOne(
        { conversationId: conversation._id },
        { $unset: { conversationId: 1 } }
      );
      
      await conversation.deleteOne();
      deletedCount++;
    } catch (error) {
      logger.error(`[Data Deletion] Failed to delete conversation ${conversation._id}:`, error);
    }
  }
  
  logger.info(`[Data Deletion] Deleted ${deletedCount} expired conversations (older than ${retention.years} years) for ${jurisdiction.jurisdiction}`);
  return deletedCount;
}

/**
 * Delete expired medical analysis based on jurisdiction
 * @param {string} country - Organization country
 * @returns {Promise<number>} - Number of analyses deleted
 */
async function deleteExpiredMedicalAnalysis(country) {
  const jurisdiction = getJurisdiction(country);
  const retention = getDataRetentionPeriod(country, 'medicalAnalysis');
  
  // HIPAA: Never auto-delete
  if (!retention.autoDelete) {
    logger.info(`[Data Deletion] Skipping medical analysis deletion for ${jurisdiction.jurisdiction} (retention required)`);
    return 0;
  }
  
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retention.years);
  
  // Get all orgs with this country
  const orgs = await Org.find({ country });
  const orgIds = orgs.map(o => o._id);
  
  // Get patients for these orgs
  const patients = await Client.find({ org: { $in: orgIds } });
  const clientIds = patients.map(p => p._id);
  
  if (clientIds.length === 0) {
    return 0;
  }
  
  // Find expired analyses for these patients
  const deletedCount = await MedicalAnalysis.deleteMany({
    clientId: { $in: clientIds },
    analysisDate: { $lt: cutoffDate }
  });
  
  logger.info(`[Data Deletion] Deleted ${deletedCount.deletedCount} expired medical analyses (older than ${retention.years} years) for ${jurisdiction.jurisdiction}`);
  return deletedCount.deletedCount;
}

/**
 * Suppress expired client memory facts based on jurisdiction
 * @param {string} country - Organization country
 * @returns {Promise<number>} - Number of facts suppressed
 */
async function deleteExpiredClientMemory(country) {
  const jurisdiction = getJurisdiction(country);
  const retention = getDataRetentionPeriod(country, 'clientMemory');

  if (!retention.autoDelete) {
    logger.info(`[Data Deletion] Skipping client memory suppression for ${jurisdiction.jurisdiction} (retention required)`);
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retention.years);

  const orgs = await Org.find({ country });
  const orgIds = orgs.map((o) => o._id);

  const patients = await Client.find({ org: { $in: orgIds } });
  const clientIds = patients.map((p) => p._id);

  if (clientIds.length === 0) {
    return 0;
  }

  const result = await ClientMemory.updateMany(
    {
      clientId: { $in: clientIds },
      extractedAt: { $lt: cutoffDate },
      deletedAt: null,
    },
    { $set: { deletedAt: new Date(), deletedReason: 'retention_expired' } }
  );

  logger.info(
    `[Data Deletion] Suppressed ${result.modifiedCount} expired client memory facts (older than ${retention.years} years) for ${jurisdiction.jurisdiction}`
  );
  return result.modifiedCount;
}

/**
 * Delete expired consent records based on jurisdiction
 * @param {string} country - Organization country
 * @returns {Promise<number>} - Number of consent records deleted
 */
async function deleteExpiredConsentRecords(country) {
  const jurisdiction = getJurisdiction(country);
  const retention = getDataRetentionPeriod(country, 'consentRecords');
  
  // HIPAA: Never auto-delete (legal requirement)
  if (!retention.autoDelete) {
    logger.info(`[Data Deletion] Skipping consent record deletion for ${jurisdiction.jurisdiction} (legal retention required)`);
    return 0;
  }
  
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retention.years);
  
  // Get all orgs with this country
  const orgs = await Org.find({ country });
  const orgIds = orgs.map(o => o._id);
  
  // Get caregivers for these orgs
  const Caregiver = require('../models/caregiver.model');
  const caregivers = await Caregiver.find({ org: { $in: orgIds } });
  const caregiverIds = caregivers.map(c => c._id);
  
  // Get patients for these orgs
  const patients = await Client.find({ org: { $in: orgIds } });
  const clientIds = patients.map(p => p._id);
  
  // Only delete withdrawn consent records that are expired
  // Keep active consent records regardless of age
  const deletedCount = await ConsentRecord.deleteMany({
    $or: [
      { userId: { $in: caregiverIds }, userModel: 'Caregiver' },
      { userId: { $in: clientIds }, userModel: 'Client' }
    ],
    withdrawn: true,
    withdrawnAt: { $lt: cutoffDate }
  });
  
  logger.info(`[Data Deletion] Deleted ${deletedCount.deletedCount} expired withdrawn consent records (older than ${retention.years} years) for ${jurisdiction.jurisdiction}`);
  return deletedCount.deletedCount;
}

/**
 * Process data deletion for a specific organization
 * @param {string} country - Organization country code
 * @returns {Promise<Object>} - Deletion statistics
 */
async function processDataDeletionForOrg(country) {
  const jurisdiction = getJurisdiction(country);
  
  // Only process deletion for jurisdictions that allow auto-deletion
  if (!shouldAutoDeleteData(country)) {
    logger.info(`[Data Deletion] Skipping auto-deletion for ${jurisdiction.jurisdiction} (retention required)`);
    return {
      country,
      jurisdiction: jurisdiction.jurisdiction,
      skipped: true,
      reason: 'Retention required by law'
    };
  }
  
  logger.info(`[Data Deletion] Processing data deletion for ${jurisdiction.jurisdiction} (${country})`);
  
  const stats = {
    country,
    jurisdiction: jurisdiction.jurisdiction,
    calls: 0,
    conversations: 0,
    medicalAnalysis: 0,
    consentRecords: 0,
    clientMemory: 0,
    total: 0
  };
  
  try {
    stats.calls = await deleteExpiredCallRecordings(country);
    stats.conversations = await deleteExpiredConversations(country);
    stats.medicalAnalysis = await deleteExpiredMedicalAnalysis(country);
    stats.consentRecords = await deleteExpiredConsentRecords(country);
    stats.clientMemory = await deleteExpiredClientMemory(country);
    
    stats.total = stats.calls + stats.conversations + stats.medicalAnalysis + stats.consentRecords + stats.clientMemory;
    
    logger.info(`[Data Deletion] Completed deletion for ${jurisdiction.jurisdiction}:`, stats);
  } catch (error) {
    logger.error(`[Data Deletion] Error processing deletion for ${country}:`, error);
    throw error;
  }
  
  return stats;
}

/**
 * Process data deletion for all organizations
 * Runs daily job to delete expired data based on jurisdiction
 * @returns {Promise<Object>} - Overall deletion statistics
 */
async function processDataDeletion() {
  logger.info('[Data Deletion] Starting scheduled data deletion job');
  
  // Get all unique countries from organizations
  const orgs = await Org.find({ country: { $exists: true, $ne: null } }).distinct('country');
  const countries = [...new Set(orgs)]; // Remove duplicates
  
  // If no orgs with countries, use default
  if (countries.length === 0) {
    countries.push('US');
  }
  
  const overallStats = {
    processed: 0,
    skipped: 0,
    totalDeleted: 0,
    byCountry: {}
  };
  
  for (const country of countries) {
    try {
      const stats = await processDataDeletionForOrg(country);
      
      if (stats.skipped) {
        overallStats.skipped++;
      } else {
        overallStats.processed++;
        overallStats.totalDeleted += stats.total;
      }
      
      overallStats.byCountry[country] = stats;
    } catch (error) {
      logger.error(`[Data Deletion] Failed to process deletion for ${country}:`, error);
    }
  }
  
  logger.info('[Data Deletion] Completed scheduled data deletion job:', overallStats);
  return overallStats;
}

/**
 * Resolve client IDs subject to erasure/deletion for a user.
 */
async function resolveSubjectClientIds(userId, userModel = 'Caregiver') {
  if (userModel === 'Client') {
    return [userId];
  }
  const patients = await Client.find({ caregivers: userId });
  return patients.map((p) => p._id);
}

/**
 * Delete S3 debug audio objects referenced on conversations.
 */
async function deleteS3AudioForConversations(conversations) {
  let deleted = 0;
  for (const conversation of conversations) {
    const urls = conversation.debugAudioUrls || [];
    for (const audio of urls) {
      if (!audio.key) continue;
      try {
        await s3Service.deleteFile(audio.key);
        deleted += 1;
      } catch (error) {
        logger.warn(`[Data Deletion] Failed to delete S3 object ${audio.key}: ${error.message}`);
      }
    }
  }
  return deleted;
}

/**
 * Anonymize consent records while retaining legal proof of consent.
 */
async function anonymizeConsentRecords(userIds, userModel) {
  const result = await ConsentRecord.updateMany(
    { userId: { $in: userIds }, userModel },
    {
      $set: {
        purpose: '[ANONYMIZED]',
        'explicitConsent.consentText': '[REDACTED]',
        'explicitConsent.ipAddress': '[REDACTED]',
        'explicitConsent.userAgent': '[REDACTED]',
      },
    }
  );
  return result.modifiedCount;
}

/**
 * Suppress PHI references in audit logs for a data subject (retain event structure).
 * Uses native collection update to bypass immutability hooks.
 */
async function suppressAuditLogsForSubject(subjectIds) {
  const idStrings = subjectIds.map((id) => id.toString());
  const result = await AuditLog.collection.updateMany(
    {
      $or: [
        { resource: 'client', resourceId: { $in: idStrings } },
        { userId: { $in: subjectIds } },
      ],
    },
    {
      $set: {
        'metadata.phiSuppressed': 'true',
        resourceId: '[ERASED]',
      },
    }
  );
  return result.modifiedCount;
}

/**
 * Cascade erasure for a set of client IDs.
 */
async function cascadeErasureForClients(clientIds, country) {
  const scope = {
    clientRecord: 0,
    conversations: 0,
    messages: 0,
    clientMemory: 0,
    s3AudioObjects: 0,
    consentRecordsAnonymized: 0,
    auditLogsSuppressed: 0,
    calls: 0,
    medicalAnalysis: 0,
  };

  const conversations = await Conversation.find({ clientId: { $in: clientIds } });
  scope.s3AudioObjects = await deleteS3AudioForConversations(conversations);

  const conversationIds = conversations.map((c) => c._id);
  const msgResult = await Message.deleteMany({ conversationId: { $in: conversationIds } });
  scope.messages = msgResult.deletedCount;

  const convResult = await Conversation.deleteMany({ clientId: { $in: clientIds } });
  scope.conversations = convResult.deletedCount;

  const callResult = await Call.deleteMany({ clientId: { $in: clientIds } });
  scope.calls = callResult.deletedCount;

  const analysisResult = await MedicalAnalysis.deleteMany({ clientId: { $in: clientIds } });
  scope.medicalAnalysis = analysisResult.deletedCount;

  let memoryDeleted = 0;
  for (const clientId of clientIds) {
    memoryDeleted += await clientMemoryService.hardDeleteFactsForClient(clientId);
  }
  scope.clientMemory = memoryDeleted;

  scope.consentRecordsAnonymized = await anonymizeConsentRecords(clientIds, 'Client');
  scope.auditLogsSuppressed = await suppressAuditLogsForSubject(clientIds);

  for (const clientId of clientIds) {
    const client = await Client.findById(clientId);
    if (client) {
      await client.delete();
      scope.clientRecord += 1;
    }
  }

  return scope;
}

/**
 * Process a formal erasure privacy request (GDPR Art. 17 / PIPEDA).
 * @param {ObjectId} requestId
 * @param {ObjectId} processedBy
 * @returns {Promise<Object>}
 */
async function processErasureRequest(requestId, processedBy) {
  const request = await PrivacyRequest.findById(requestId);
  if (!request) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Privacy request not found');
  }
  if (request.requestType !== 'erasure') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This is not an erasure request');
  }

  const Caregiver = require('../models/caregiver.model');
  let country = 'US';
  let jurisdictionKey = request.jurisdiction || 'HIPAA';

  if (request.requestorModel === 'Caregiver') {
    const caregiver = await Caregiver.findById(request.requestorId).populate('org');
    country = caregiver?.org?.country ?? null;
    jurisdictionKey = getJurisdiction(country).jurisdiction;
  } else {
    const client = await Client.findById(request.requestorId).populate('org');
    country = client?.org?.country ?? null;
    jurisdictionKey = getJurisdiction(country).jurisdiction;
  }

  if (!allowsErasureRequest(jurisdictionKey)) {
    request.status = 'denied';
    request.denialDate = new Date();
    request.denialReason = getErasureDenialLegalBasis(jurisdictionKey);
    request.updatedBy = processedBy;
    await request.save();

    return {
      requestId,
      jurisdiction: jurisdictionKey,
      erasurePerformed: false,
      legalBasis: request.denialReason,
    };
  }

  const clientIds = await resolveSubjectClientIds(request.requestorId, request.requestorModel);
  const scope = await cascadeErasureForClients(clientIds, country);

  const completionRecord = await ErasureCompletionRecord.create({
    requestId,
    completedAt: new Date(),
    jurisdiction: jurisdictionKey,
    subjectId: request.requestorId,
    subjectModel: request.requestorModel,
    scope,
    processedBy,
  });

  request.status = 'completed';
  request.responseDate = new Date();
  request.updatedBy = processedBy;
  request.informationProvided = [{
    dataType: 'erasure_completion',
    dataId: completionRecord._id,
    format: 'record',
    providedAt: new Date(),
  }];
  await request.save();

  logger.info(`[Data Deletion] Erasure request ${requestId} completed`, scope);

  return {
    requestId,
    jurisdiction: jurisdictionKey,
    erasurePerformed: true,
    scope,
    completionRecordId: completionRecord._id,
  };
}

/**
 * Handle user-initiated deletion request
 * @param {ObjectId} userId - User ID requesting deletion
 * @param {string} dataType - Type of data to delete ('all', 'calls', 'conversations', 'medicalAnalysis')
 * @param {string} [userModel='Caregiver']
 * @returns {Promise<Object>} - Deletion result
 */
async function handleDeletionRequest(userId, dataType = 'all', userModel = 'Caregiver') {
  const Caregiver = require('../models/caregiver.model');
  let country = 'US';
  let jurisdictionKey = 'HIPAA';

  if (userModel === 'Caregiver') {
    const caregiver = await Caregiver.findById(userId).populate('org');
    if (!caregiver || !caregiver.org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User or organization not found');
    }
    country = caregiver.org.country ?? null;
    jurisdictionKey = getJurisdiction(country).jurisdiction;
  } else {
    const client = await Client.findById(userId).populate('org');
    if (!client || !client.org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User or organization not found');
    }
    country = client.org.country ?? null;
    jurisdictionKey = getJurisdiction(country).jurisdiction;
  }

  if (!allowsErasureRequest(jurisdictionKey)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      getErasureDenialLegalBasis(jurisdictionKey)
    );
  }

  logger.info(`[Data Deletion] User ${userId} (${userModel}) requested deletion of ${dataType} data`);

  const result = {
    userId,
    userModel,
    country,
    jurisdiction: jurisdictionKey,
    dataType,
    deleted: {},
  };

  const clientIds = await resolveSubjectClientIds(userId, userModel);

  if (dataType === 'all') {
    const scope = await cascadeErasureForClients(clientIds, country);
    result.deleted = scope;
    result.deleted.total = Object.values(scope).reduce(
      (sum, count) => sum + (typeof count === 'number' ? count : 0),
      0
    );
    logger.info('[Data Deletion] User deletion request completed:', result);
    return result;
  }

  if (dataType === 'calls') {
    const deletedCalls = await Call.deleteMany({ clientId: { $in: clientIds } });
    result.deleted.calls = deletedCalls.deletedCount;
  }

  if (dataType === 'conversations') {
    const conversations = await Conversation.find({ clientId: { $in: clientIds } });
    const conversationIds = conversations.map((c) => c._id);
    result.deleted.s3AudioObjects = await deleteS3AudioForConversations(conversations);
    const msgResult = await Message.deleteMany({ conversationId: { $in: conversationIds } });
    result.deleted.messages = msgResult.deletedCount;
    const deletedConversations = await Conversation.deleteMany({ clientId: { $in: clientIds } });
    result.deleted.conversations = deletedConversations.deletedCount;
  }

  if (dataType === 'medicalAnalysis') {
    const deletedAnalysis = await MedicalAnalysis.deleteMany({ clientId: { $in: clientIds } });
    result.deleted.medicalAnalysis = deletedAnalysis.deletedCount;
  }

  if (dataType === 'clientMemory') {
    let clientMemoryDeleted = 0;
    for (const clientId of clientIds) {
      clientMemoryDeleted += await clientMemoryService.hardDeleteFactsForClient(clientId);
    }
    result.deleted.clientMemory = clientMemoryDeleted;
  }

  result.deleted.total = Object.values(result.deleted).reduce(
    (sum, count) => sum + (typeof count === 'number' ? count : 0),
    0
  );

  logger.info('[Data Deletion] User deletion request completed:', result);
  return result;
}

module.exports = {
  processDataDeletion,
  processDataDeletionForOrg,
  handleDeletionRequest,
  processErasureRequest,
  deleteExpiredCallRecordings,
  deleteExpiredConversations,
  deleteExpiredMedicalAnalysis,
  deleteExpiredConsentRecords,
  deleteExpiredClientMemory,
  cascadeErasureForClients,
};
