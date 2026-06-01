/**
 * Data Deletion Service
 * 
 * Handles automated and user-initiated data deletion based on jurisdiction-specific retention rules
 * 
 * PIPEDA: Auto-deletes data after retention period
 * HIPAA: Never auto-deletes (legal requirement - 7 year retention)
 */

const { getJurisdiction, getDataRetentionPeriod, shouldAutoDeleteData } = require('../utils/jurisdiction.utils');
const { Org, Client, Call, Conversation, Message, MedicalAnalysis, ConsentRecord } = require('../models');
const digestCleanup = require('./caregiverDailyDigestCleanup.service');
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
  
  return org?.country || 'US'; // Default to US if not found
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
 * Redact or delete expired daily digests aligned with conversation retention.
 * @param {string} country - Organization country
 * @returns {Promise<Object>} - Redaction statistics
 */
async function deleteExpiredDigests(country) {
  const jurisdiction = getJurisdiction(country);
  const retention = getDataRetentionPeriod(country, 'conversations');

  if (!retention.autoDelete) {
    logger.info(`[Data Deletion] Skipping digest redaction for ${jurisdiction.jurisdiction} (retention required)`);
    return { redacted: 0, deleted: 0 };
  }

  const stats = await digestCleanup.deleteExpiredDigestsForCountry(country, retention.years);
  logger.info(
    `[Data Deletion] Digest cleanup for ${jurisdiction.jurisdiction}: redacted ${stats.redacted}, deleted ${stats.deleted} drafts (older than ${retention.years} years)`
  );
  return stats;
}

/**
 * Redact digests with orphaned references for a country.
 * @param {string} country - Organization country
 * @returns {Promise<Object>} - Cleanup statistics
 */
async function cleanupOrphanedDigestsForCountry(country) {
  return digestCleanup.cleanupOrphanedDigests(country);
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
    dailyDigests: { redacted: 0, deleted: 0 },
    orphanedDigests: { redacted: 0, deleted: 0, entriesStripped: 0 },
    total: 0
  };
  
  try {
    stats.calls = await deleteExpiredCallRecordings(country);
    stats.conversations = await deleteExpiredConversations(country);
    stats.medicalAnalysis = await deleteExpiredMedicalAnalysis(country);
    stats.consentRecords = await deleteExpiredConsentRecords(country);
    stats.dailyDigests = await deleteExpiredDigests(country);
    stats.orphanedDigests = await cleanupOrphanedDigestsForCountry(country);
    
    stats.total =
      stats.calls +
      stats.conversations +
      stats.medicalAnalysis +
      stats.consentRecords +
      stats.dailyDigests.redacted +
      stats.dailyDigests.deleted +
      stats.orphanedDigests.redacted +
      stats.orphanedDigests.deleted;
    
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
 * Handle user-initiated deletion request
 * @param {ObjectId} userId - User ID requesting deletion
 * @param {string} dataType - Type of data to delete ('all', 'calls', 'conversations', 'medicalAnalysis')
 * @returns {Promise<Object>} - Deletion result
 */
async function handleDeletionRequest(userId, dataType = 'all') {
  const Caregiver = require('../models/caregiver.model');
  const caregiver = await Caregiver.findById(userId).populate('org');
  
  if (!caregiver || !caregiver.org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User or organization not found');
  }
  
  const country = caregiver.org.country || 'US';
  const jurisdiction = getJurisdiction(country);
  
  // Check if deletion is allowed for this jurisdiction
  if (!shouldAutoDeleteData(country)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Data deletion is not permitted for ${jurisdiction.jurisdiction} jurisdiction due to legal retention requirements. Please contact privacy@biancawellness.com for assistance.`
    );
  }
  
  logger.info(`[Data Deletion] User ${userId} requested deletion of ${dataType} data`);
  
  const result = {
    userId,
    country,
    jurisdiction: jurisdiction.jurisdiction,
    dataType,
    deleted: {}
  };
  
  // Get client IDs associated with this caregiver
  const patients = await Client.find({ caregivers: userId });
  const clientIds = patients.map(p => p._id);
  
  if (dataType === 'all' || dataType === 'calls') {
    // Delete calls for user's patients
    const deletedCalls = await Call.deleteMany({
      clientId: { $in: clientIds }
    });
    result.deleted.calls = deletedCalls.deletedCount;
    
    // Delete associated conversations
    const conversations = await Conversation.find({
      clientId: { $in: clientIds }
    });
    const conversationIds = conversations.map(c => c._id);
    
    await Message.deleteMany({ conversationId: { $in: conversationIds } });
    await Conversation.deleteMany({ clientId: { $in: clientIds } });
  }
  
  if (dataType === 'all' || dataType === 'conversations') {
    const conversations = await Conversation.find({
      clientId: { $in: clientIds }
    });
    const conversationIds = conversations.map(c => c._id);
    
    await Message.deleteMany({ conversationId: { $in: conversationIds } });
    const deletedConversations = await Conversation.deleteMany({
      clientId: { $in: clientIds }
    });
    result.deleted.conversations = deletedConversations.deletedCount;
  }
  
  if (dataType === 'all' || dataType === 'medicalAnalysis') {
    const deletedAnalysis = await MedicalAnalysis.deleteMany({
      clientId: { $in: clientIds }
    });
    result.deleted.medicalAnalysis = deletedAnalysis.deletedCount;
  }

  if (dataType === 'all' || dataType === 'calls' || dataType === 'conversations') {
    result.deleted.dailyDigests = await digestCleanup.cleanupDigestsForClients(clientIds, 'erasure_request');
  }
  
  result.deleted.total = Object.values(result.deleted).reduce((sum, count) => {
    if (typeof count === 'number') {
      return sum + count;
    }
    if (count && typeof count === 'object') {
      return sum + (count.redacted || 0) + (count.deleted || 0);
    }
    return sum;
  }, 0);
  
  logger.info(`[Data Deletion] User deletion request completed:`, result);
  
  return result;
}

module.exports = {
  processDataDeletion,
  processDataDeletionForOrg,
  handleDeletionRequest,
  deleteExpiredCallRecordings,
  deleteExpiredConversations,
  deleteExpiredMedicalAnalysis,
  deleteExpiredConsentRecords,
  deleteExpiredDigests,
  cleanupOrphanedDigestsForCountry,
};
