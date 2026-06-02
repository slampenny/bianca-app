const Client = require('../models/client.model');
const config = require('../config/config');
const logger = require('../config/logger');
const {
  getVoiceTurnConfig,
  resolveInitialVadSilence,
  createCallTracking,
  buildProfilePersistenceUpdate,
} = require('../utils/voiceTurnProfile.util');

const VOICE_TURN_PROFILE_SELECT =
  'preferredLanguage voiceTurnProfile.vadSilenceDurationMs voiceTurnProfile.minSilenceDurationMs voiceTurnProfile.maxSilenceDurationMs voiceTurnProfile.totalCallsObserved voiceTurnProfile.totalTurnsObserved voiceTurnProfile.totalInterruptionsObserved voiceTurnProfile.consecutiveCleanTurns voiceTurnProfile.source voiceTurnProfile.lastCallStartedAt voiceTurnProfile.lastCallEndedAt voiceTurnProfile.lastUpdatedAt';

/**
 * Load initial VAD silence and create per-call tracking for a Bianca Realtime session.
 * @param {string|null} clientId
 * @returns {Promise<{ vadSilenceDurationMs: number, voiceTurnTracking: object|null, preferredLanguage: string|null, logContext: object }>}
 */
async function prepareCallVoiceTurn(clientId) {
  const vtConfig = getVoiceTurnConfig(config);

  if (!clientId) {
    const resolved = resolveInitialVadSilence(null, vtConfig);
    return {
      vadSilenceDurationMs: resolved.ms,
      voiceTurnTracking: null,
      preferredLanguage: null,
      logContext: { clientId: null, source: resolved.source, personalizationEnabled: vtConfig.enabled },
    };
  }

  let profile = null;
  let preferredLanguage = null;
  try {
    const client = await Client.findById(clientId).select(VOICE_TURN_PROFILE_SELECT).lean();
    profile = client?.voiceTurnProfile || null;
    preferredLanguage = client?.preferredLanguage || null;
  } catch (err) {
    logger.warn(`[VoiceTurn] Could not load profile for client ${clientId}: ${err.message}`);
  }

  const resolved = resolveInitialVadSilence(profile, vtConfig);
  const minMs = profile?.minSilenceDurationMs ?? vtConfig.minSilenceDurationMs;
  const maxMs = profile?.maxSilenceDurationMs ?? vtConfig.maxSilenceDurationMs;

  const voiceTurnTracking = createCallTracking({
    initialMs: resolved.ms,
    minMs,
    maxMs,
    profileSource: resolved.source,
    persistedMs: resolved.persistedMs,
    priorCallsObserved: profile?.totalCallsObserved ?? 0,
    callStartedAt: new Date(),
  });

  logger.info(
    `[VoiceTurn] call started with vadSilenceDurationMs=${resolved.ms} clientId=${clientId} source=${resolved.source} personalization=${vtConfig.enabled}`
  );

  return {
    vadSilenceDurationMs: resolved.ms,
    voiceTurnTracking,
    preferredLanguage,
    logContext: {
      clientId,
      source: resolved.source,
      personalizationEnabled: vtConfig.enabled,
    },
  };
}

/**
 * Persist voice turn profile after call ends.
 * @param {string} clientId
 * @param {object} voiceTurnTracking
 * @returns {Promise<void>}
 */
async function persistCallVoiceTurn(clientId, voiceTurnTracking) {
  if (!clientId || !voiceTurnTracking) return;

  const vtConfig = getVoiceTurnConfig(config);
  const callEndedAt = new Date();

  let existingProfile = null;
  try {
    const client = await Client.findById(clientId).select(VOICE_TURN_PROFILE_SELECT).lean();
    existingProfile = client?.voiceTurnProfile || null;
  } catch (err) {
    logger.warn(`[VoiceTurn] Could not load profile for persist (client ${clientId}): ${err.message}`);
    return;
  }

  const { update, skipReason, nextMs } = buildProfilePersistenceUpdate(
    voiceTurnTracking,
    vtConfig,
    existingProfile,
    callEndedAt
  );

  if (!update) {
    logger.info(
      `[VoiceTurn] skipped profile update clientId=${clientId} reason=${skipReason} turns=${voiceTurnTracking.turnsObserved} speechMs=${voiceTurnTracking.totalSpeechDurationMs}`
    );
    return;
  }

  try {
    await Client.findByIdAndUpdate(clientId, { $set: update });
    logger.info(
      `[VoiceTurn] persisted vadSilenceDurationMs=${nextMs} clientId=${clientId} interruptions=${voiceTurnTracking.interruptionCount} turns=${voiceTurnTracking.turnsObserved}`
    );
  } catch (err) {
    logger.error(`[VoiceTurn] Failed to persist profile for client ${clientId}: ${err.message}`);
  }
}

/**
 * Reset a client's voice turn profile to defaults (admin/helper).
 * @param {string} clientId
 * @returns {Promise<object|null>}
 */
async function resetClientVoiceTurnProfile(clientId) {
  const vtConfig = getVoiceTurnConfig(config);
  const now = new Date();
  const profile = {
    vadSilenceDurationMs: vtConfig.defaultSilenceDurationMs,
    minSilenceDurationMs: vtConfig.minSilenceDurationMs,
    maxSilenceDurationMs: vtConfig.maxSilenceDurationMs,
    totalCallsObserved: 0,
    totalTurnsObserved: 0,
    totalInterruptionsObserved: 0,
    consecutiveCleanTurns: 0,
    lastCallStartedAt: null,
    lastCallEndedAt: null,
    lastUpdatedAt: now,
    source: 'default',
  };

  const updated = await Client.findByIdAndUpdate(
    clientId,
    { $set: { voiceTurnProfile: profile } },
    { new: true }
  )
    .select('voiceTurnProfile')
    .lean();

  logger.info(`[VoiceTurn] reset profile clientId=${clientId}`);
  return updated?.voiceTurnProfile ?? null;
}

module.exports = {
  prepareCallVoiceTurn,
  persistCallVoiceTurn,
  resetClientVoiceTurnProfile,
  getVoiceTurnConfig,
};
