/**
 * Pure helpers for per-resident voice turn (VAD silence) personalization.
 * No DB or I/O — safe for unit tests without mocks.
 */

const ABSOLUTE_MIN_MS = 200;
const ABSOLUTE_MAX_MS = 4000;

/**
 * @param {number} ms
 * @param {number} minMs
 * @param {number} maxMs
 * @returns {number}
 */
function clampSilenceMs(ms, minMs, maxMs) {
  const lo = Math.max(ABSOLUTE_MIN_MS, minMs ?? ABSOLUTE_MIN_MS);
  const hi = Math.min(ABSOLUTE_MAX_MS, maxMs ?? ABSOLUTE_MAX_MS);
  const n = Number(ms);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/**
 * @param {import('../config/config')} cfg - config module
 * @returns {object}
 */
function getVoiceTurnConfig(cfg) {
  const td = cfg?.audio?.turnDetection || {};
  const vt = td.voiceTurnPersonalization || {};
  const legacySilence = td.silenceDurationMs;

  const minMs = vt.minSilenceDurationMs ?? 225;
  const maxMs = vt.maxSilenceDurationMs ?? 2000;

  return {
    enabled: vt.enabled !== false,
    defaultSilenceDurationMs: clampSilenceMs(vt.defaultSilenceDurationMs ?? 300, minMs, maxMs),
    minSilenceDurationMs: clampSilenceMs(minMs, ABSOLUTE_MIN_MS, maxMs),
    maxSilenceDurationMs: clampSilenceMs(maxMs, minMs, ABSOLUTE_MAX_MS),
    interruptionBumpMs: vt.interruptionBumpMs ?? 250,
    successDecayMs: vt.successDecayMs ?? 50,
    successDecayMinTurns: vt.successDecayMinTurns ?? 6,
    successDecayMinCalls: vt.successDecayMinCalls ?? 1,
    profileAlpha: vt.profileAlpha ?? 0.35,
    legacySilenceDurationMs: legacySilence ?? 500,
    adaptiveSilenceEnabled: td.adaptiveSilence?.enabled !== false,
    adaptiveSilenceStepMs: td.adaptiveSilence?.stepMs ?? 200,
    adaptiveSilenceMaxMs: td.adaptiveSilence?.maxMs ?? 2000,
    minSpeechForPersistenceMs: vt.minSpeechForPersistenceMs ?? 1200,
  };
}

/**
 * Resolve initial VAD silence for a call from client profile + config.
 * @param {object|null} voiceTurnProfile - client.voiceTurnProfile
 * @param {object} vtConfig - from getVoiceTurnConfig
 * @returns {{ ms: number, source: string, persistedMs: number|null }}
 */
function resolveInitialVadSilence(voiceTurnProfile, vtConfig) {
  const { minSilenceDurationMs, maxSilenceDurationMs } = vtConfig;

  if (!vtConfig.enabled) {
    const ms = clampSilenceMs(vtConfig.legacySilenceDurationMs, minSilenceDurationMs, maxSilenceDurationMs);
    return { ms, source: 'legacy', persistedMs: null };
  }

  const profile = voiceTurnProfile || {};
  const source = profile.source || 'default';

  if (source === 'manual' && Number.isFinite(profile.vadSilenceDurationMs) && profile.vadSilenceDurationMs > 0) {
    const ms = clampSilenceMs(profile.vadSilenceDurationMs, minSilenceDurationMs, maxSilenceDurationMs);
    return { ms, source: 'manual', persistedMs: ms };
  }

  if (Number.isFinite(profile.vadSilenceDurationMs) && profile.vadSilenceDurationMs > 0) {
    const ms = clampSilenceMs(profile.vadSilenceDurationMs, minSilenceDurationMs, maxSilenceDurationMs);
    return { ms, source: profile.source === 'adaptive' ? 'adaptive' : 'adaptive', persistedMs: ms };
  }

  const ms = clampSilenceMs(vtConfig.defaultSilenceDurationMs, minSilenceDurationMs, maxSilenceDurationMs);
  return { ms, source: 'default', persistedMs: null };
}

/**
 * @param {object} params
 * @returns {object} call tracking state (mutated in place by record* helpers)
 */
function createCallTracking({
  initialMs,
  minMs,
  maxMs,
  profileSource,
  persistedMs,
  priorCallsObserved = 0,
  callStartedAt = new Date(),
}) {
  return {
    initialVadSilenceDurationMs: initialMs,
    currentVadSilenceDurationMs: initialMs,
    finalVadSilenceDurationMs: initialMs,
    minSilenceDurationMs: minMs,
    maxSilenceDurationMs: maxMs,
    interruptionCount: 0,
    turnsObserved: 0,
    cleanTurns: 0,
    bumpEvents: 0,
    currentTurnHadInterruption: false,
    totalSpeechDurationMs: 0,
    profileSource: profileSource || 'default',
    persistedVadSilenceDurationMs: persistedMs,
    priorCallsObserved,
    callStartedAt,
  };
}

/**
 * @param {object} tracking
 * @param {object} vtConfig
 * @returns {{ nextMs: number, changed: boolean }}
 */
function applyInterruptionBump(tracking, vtConfig) {
  const bumpMs = vtConfig.enabled
    ? vtConfig.interruptionBumpMs
    : vtConfig.adaptiveSilenceStepMs;

  tracking.interruptionCount += 1;
  tracking.bumpEvents += 1;
  tracking.currentTurnHadInterruption = true;
  tracking.cleanTurns = 0;

  const current = tracking.currentVadSilenceDurationMs;
  const next = clampSilenceMs(
    current + bumpMs,
    tracking.minSilenceDurationMs,
    tracking.maxSilenceDurationMs
  );
  tracking.currentVadSilenceDurationMs = next;
  tracking.finalVadSilenceDurationMs = next;
  return { nextMs: next, changed: next !== current };
}

/**
 * @param {object} tracking
 * @param {object} vtConfig
 * @returns {{ nextMs: number, changed: boolean }}
 */
function applyCleanTurn(tracking, vtConfig) {
  tracking.turnsObserved += 1;

  if (tracking.currentTurnHadInterruption) {
    tracking.currentTurnHadInterruption = false;
    return { nextMs: tracking.currentVadSilenceDurationMs, changed: false };
  }

  tracking.cleanTurns += 1;

  const canDecayInCall =
    vtConfig.enabled &&
    tracking.priorCallsObserved >= vtConfig.successDecayMinCalls &&
    tracking.cleanTurns >= vtConfig.successDecayMinTurns;

  if (!canDecayInCall) {
    return { nextMs: tracking.currentVadSilenceDurationMs, changed: false };
  }

  const current = tracking.currentVadSilenceDurationMs;
  const next = clampSilenceMs(
    current - vtConfig.successDecayMs,
    tracking.minSilenceDurationMs,
    tracking.maxSilenceDurationMs
  );
  tracking.currentVadSilenceDurationMs = next;
  tracking.finalVadSilenceDurationMs = next;
  tracking.cleanTurns = 0;
  return { nextMs: next, changed: next !== current };
}

/**
 * @param {object} tracking
 * @param {number} turnSpeechDurationMs
 */
function recordTurnSpeechDuration(tracking, turnSpeechDurationMs) {
  if (Number.isFinite(turnSpeechDurationMs) && turnSpeechDurationMs > 0) {
    tracking.totalSpeechDurationMs += turnSpeechDurationMs;
  }
}

/**
 * @param {object} tracking
 * @param {object} vtConfig
 * @returns {{ shouldPersist: boolean, reason?: string }}
 */
function shouldPersistProfile(tracking, vtConfig) {
  if (!vtConfig.enabled) {
    return { shouldPersist: false, reason: 'personalization_disabled' };
  }
  if (tracking.turnsObserved < 1 && tracking.totalSpeechDurationMs < vtConfig.minSpeechForPersistenceMs) {
    return { shouldPersist: false, reason: 'insufficient_speech' };
  }
  return { shouldPersist: true };
}

/**
 * @param {object} tracking
 * @param {object} vtConfig
 * @returns {number} proposed target before smoothing
 */
function computePersistenceTarget(tracking, vtConfig) {
  const { minSilenceDurationMs, maxSilenceDurationMs } = tracking;
  const initial = tracking.initialVadSilenceDurationMs;
  const final = tracking.finalVadSilenceDurationMs;

  let target;
  if (tracking.interruptionCount > 0) {
    target = final;
  } else if (tracking.turnsObserved >= vtConfig.successDecayMinTurns) {
    target = Math.max(minSilenceDurationMs, initial - vtConfig.successDecayMs);
  } else {
    target = initial;
  }

  return clampSilenceMs(target, minSilenceDurationMs, maxSilenceDurationMs);
}

/**
 * @param {number} target
 * @param {number|null} previousPersisted
 * @param {number} initial
 * @param {number} alpha
 * @returns {number}
 */
function applySmoothing(target, previousPersisted, initial, alpha) {
  const prev = Number.isFinite(previousPersisted) ? previousPersisted : initial;
  const a = Math.min(1, Math.max(0, alpha));
  return Math.round(a * target + (1 - a) * prev);
}

function buildProfilePersistenceUpdate(tracking, vtConfig, existingProfile, callEndedAt) {
  const persistCheck = shouldPersistProfile(tracking, vtConfig);
  if (!persistCheck.shouldPersist) {
    return { update: null, skipReason: persistCheck.reason };
  }

  const existing = existingProfile || {};
  const source = existing.source || 'default';
  const isManual = source === 'manual';

  const target = computePersistenceTarget(tracking, vtConfig);
  const previous = Number.isFinite(existing.vadSilenceDurationMs)
    ? existing.vadSilenceDurationMs
    : tracking.initialVadSilenceDurationMs;

  let nextMs = isManual
    ? previous
    : applySmoothing(target, previous, tracking.initialVadSilenceDurationMs, vtConfig.profileAlpha);

  nextMs = clampSilenceMs(nextMs, tracking.minSilenceDurationMs, tracking.maxSilenceDurationMs);

  const consecutiveCleanTurns =
    tracking.interruptionCount > 0
      ? 0
      : (existing.consecutiveCleanTurns || 0) + tracking.cleanTurns;

  const update = {
    'voiceTurnProfile.minSilenceDurationMs': tracking.minSilenceDurationMs,
    'voiceTurnProfile.maxSilenceDurationMs': tracking.maxSilenceDurationMs,
    'voiceTurnProfile.totalCallsObserved': (existing.totalCallsObserved || 0) + 1,
    'voiceTurnProfile.totalTurnsObserved': (existing.totalTurnsObserved || 0) + tracking.turnsObserved,
    'voiceTurnProfile.totalInterruptionsObserved':
      (existing.totalInterruptionsObserved || 0) + tracking.interruptionCount,
    'voiceTurnProfile.consecutiveCleanTurns': consecutiveCleanTurns,
    'voiceTurnProfile.lastCallStartedAt': tracking.callStartedAt,
    'voiceTurnProfile.lastCallEndedAt': callEndedAt,
    'voiceTurnProfile.lastUpdatedAt': callEndedAt,
  };

  if (!isManual) {
    update['voiceTurnProfile.vadSilenceDurationMs'] = nextMs;
    update['voiceTurnProfile.source'] = 'adaptive';
  } else {
    update['voiceTurnProfile.source'] = 'manual';
  }

  return { update, nextMs, skipReason: undefined };
}

/**
 * Startup log for deploy visibility (non-secret tuning values).
 * @param {object} logger
 * @param {object} cfg - config module
 */
function logVoiceTurnStartupConfig(logger, cfg) {
  if (!logger || typeof logger.info !== 'function') return;
  try {
    const td = cfg?.audio?.turnDetection || {};
    const mode = td.mode === 'server_vad' ? 'server_vad' : 'semantic_vad';
    logger.info(
      `[VoiceTurn] turn_detection mode=${mode} eagerness=${td.eagerness || 'low'} silenceDurationMs=${td.silenceDurationMs ?? 500}`
    );
    const vt = getVoiceTurnConfig(cfg);
    const legacy = vt.legacySilenceDurationMs;
    logger.info(
      `[VoiceTurn] personalization enabled=${vt.enabled} default=${vt.defaultSilenceDurationMs} min=${vt.minSilenceDurationMs} max=${vt.maxSilenceDurationMs} bump=${vt.interruptionBumpMs} decay=${vt.successDecayMs} alpha=${vt.profileAlpha} legacySilenceMs=${legacy}`
    );
  } catch (err) {
    logger.warn(`[VoiceTurn] startup config log skipped: ${err?.message || err}`);
  }
}

module.exports = {
  ABSOLUTE_MIN_MS,
  ABSOLUTE_MAX_MS,
  clampSilenceMs,
  getVoiceTurnConfig,
  resolveInitialVadSilence,
  createCallTracking,
  applyInterruptionBump,
  applyCleanTurn,
  recordTurnSpeechDuration,
  shouldPersistProfile,
  computePersistenceTarget,
  applySmoothing,
  buildProfilePersistenceUpdate,
  logVoiceTurnStartupConfig,
};
