const { Client, Org } = require('../models');
const { DEFAULT_ONBOARDING_PLAN } = require('../templates/defaultOnboardingPlan');

const MAX_ONBOARDING_DAYS = 14;

/** Supported Org.facilityType values. Presets are intentionally empty until product supplies content. */
const FACILITY_TYPES = ['assisted_living', 'skilled_nursing', 'home_care', 'other'];

/**
 * Facility-type preset plans. Empty until real templates are supplied — every type falls through to global default.
 * @type {Record<string, null>}
 */
const FACILITY_TYPE_PRESETS = {
  assisted_living: null,
  skilled_nursing: null,
  home_care: null,
  other: null,
};

/**
 * @typedef {{ id: string, prompt: string, compressionPriority?: boolean }} OnboardingQuestionPlan
 * @typedef {{ dayNumber: number, theme?: string, opening?: string, questions: OnboardingQuestionPlan[] }} OnboardingDayPlan
 * @typedef {{ useDefault: boolean, totalDays: number, days: OnboardingDayPlan[] }} ResolvedOnboardingPlan
 */

/**
 * @param {string|null|undefined} facilityType
 * @returns {ResolvedOnboardingPlan|null} preset plan or null if none / unset
 */
function getFacilityTypePreset(facilityType) {
  if (!facilityType || !FACILITY_TYPES.includes(facilityType)) {
    return null;
  }
  const preset = FACILITY_TYPE_PRESETS[facilityType];
  if (!preset) {
    return null;
  }
  return normalizePlan({ ...preset, useDefault: true });
}

/**
 * @param {object|null|undefined} orgVoiceOnboarding
 * @param {{ facilityType?: string|null }} [opts]
 * @returns {ResolvedOnboardingPlan}
 */
function resolvePlanFromOrgSettings(orgVoiceOnboarding, opts = {}) {
  // 1) Org custom plan wins
  if (orgVoiceOnboarding && orgVoiceOnboarding.useDefault === false) {
    const days = Array.isArray(orgVoiceOnboarding.days) ? orgVoiceOnboarding.days : [];
    return normalizePlan({
      useDefault: false,
      totalDays: days.length,
      days: days.map((day, index) => ({
        dayNumber: day.dayNumber != null ? day.dayNumber : index + 1,
        theme: day.theme || `Day ${index + 1}`,
        opening: day.opening || '',
        questions: (day.questions || []).map((q) => ({
          id: String(q.id || '').trim(),
          prompt: String(q.prompt || '').trim(),
          compressionPriority: q.compressionPriority === true,
        })),
      })),
    });
  }

  // 2) Facility-type preset if one exists (none shipped yet — inert)
  const facilityPreset = getFacilityTypePreset(opts.facilityType);
  if (facilityPreset) {
    return facilityPreset;
  }

  // 3) Global default (Day 0–4)
  return normalizePlan(DEFAULT_ONBOARDING_PLAN);
}

/**
 * @param {ResolvedOnboardingPlan|object} plan
 * @returns {ResolvedOnboardingPlan}
 */
function normalizePlan(plan) {
  const sortedDays = [...(plan.days || [])]
    .filter((d) => Array.isArray(d.questions) && d.questions.length > 0)
    .sort((a, b) => {
      const aNum = a.dayNumber != null ? Number(a.dayNumber) : Number.POSITIVE_INFINITY;
      const bNum = b.dayNumber != null ? Number(b.dayNumber) : Number.POSITIVE_INFINITY;
      return aNum - bNum;
    })
    .slice(0, MAX_ONBOARDING_DAYS)
    .map((day, index) => {
      // Preserve explicit day numbers (including Day 0). Only assign sequential 1..n when omitted.
      const dayNumber = day.dayNumber != null ? Number(day.dayNumber) : index + 1;
      return {
        dayNumber,
        theme: day.theme || `Day ${dayNumber}`,
        opening: day.opening || '',
        questions: day.questions
          .filter((q) => q.id && q.prompt)
          .map((q) => ({
            id: q.id,
            prompt: q.prompt,
            compressionPriority: q.compressionPriority === true,
          })),
      };
    })
    .filter((d) => d.questions.length > 0);

  return {
    useDefault: plan.useDefault !== false,
    totalDays: sortedDays.length,
    days: sortedDays,
  };
}

/**
 * @param {ResolvedOnboardingPlan} plan
 * @param {number} dayNumber
 * @returns {string[]}
 */
function getQuestionIdsForDay(plan, dayNumber) {
  const day = plan.days.find((d) => d.dayNumber === dayNumber);
  if (!day) return [];
  return day.questions.map((q) => q.id);
}

/**
 * @param {ResolvedOnboardingPlan} plan
 * @param {number} dayNumber
 * @returns {boolean}
 */
function isValidOnboardingDay(plan, dayNumber) {
  if (dayNumber == null || !Number.isFinite(Number(dayNumber))) return false;
  const n = Number(dayNumber);
  return plan.days.some((d) => d.dayNumber === n);
}

/**
 * Whether this org runs resident voice onboarding at all.
 * Disabled when useDefault is false and the custom plan has no days.
 * @param {ResolvedOnboardingPlan} plan
 * @returns {boolean}
 */
function isOnboardingEnabled(plan) {
  return plan.totalDays > 0;
}

/**
 * @param {object|null|undefined} orgDoc
 * @returns {ResolvedOnboardingPlan}
 */
function getPlanFromOrg(orgDoc) {
  return resolvePlanFromOrgSettings(orgDoc?.voiceOnboarding, { facilityType: orgDoc?.facilityType });
}

/**
 * @param {string|import('mongoose').Types.ObjectId|null|undefined} orgId
 * @returns {Promise<ResolvedOnboardingPlan>}
 */
async function getPlanForOrgId(orgId) {
  if (!orgId) {
    return normalizePlan(DEFAULT_ONBOARDING_PLAN);
  }
  const org = await Org.findById(orgId).select('voiceOnboarding facilityType').lean();
  return getPlanFromOrg(org);
}

/**
 * @param {string|import('mongoose').Types.ObjectId|null|undefined} clientId
 * @returns {Promise<ResolvedOnboardingPlan>}
 */
async function getPlanForClientId(clientId) {
  if (!clientId) {
    return normalizePlan(DEFAULT_ONBOARDING_PLAN);
  }
  const client = await Client.findById(clientId).select('org').lean();
  if (!client?.org) {
    return normalizePlan(DEFAULT_ONBOARDING_PLAN);
  }
  return getPlanForOrgId(client.org);
}

/**
 * Export default plan for admin UI (without org-specific overrides).
 * @returns {ResolvedOnboardingPlan}
 */
function getDefaultPlanTemplate() {
  return normalizePlan({ ...DEFAULT_ONBOARDING_PLAN, useDefault: true });
}

/**
 * Validate custom org plan before save.
 * Privacy lint: default mode is warn (caller may surface warnings). Set
 * VOICE_ONBOARDING_PRIVACY_LINT_MODE=block to reject conflicting phrases.
 * @param {{ useDefault?: boolean, days?: object[] }} voiceOnboarding
 * @returns {{ warnings: { path: string, phrase: string, id: string }[] }}
 * @throws {Error}
 */
function assertValidVoiceOnboardingConfig(voiceOnboarding) {
  const { lintVoiceOnboardingPrivacy, getPrivacyLintMode } = require('./voiceOnboardingPrivacyLint.service');
  const warnings = lintVoiceOnboardingPrivacy(voiceOnboarding);

  if (!voiceOnboarding || voiceOnboarding.useDefault !== false) {
    return { warnings };
  }
  const plan = resolvePlanFromOrgSettings(voiceOnboarding);
  if (!isOnboardingEnabled(plan)) {
    return { warnings };
  }
  const ids = new Set();
  for (const day of plan.days) {
    for (const q of day.questions) {
      if (ids.has(q.id)) {
        throw new Error(`Duplicate question id "${q.id}" in voice onboarding plan`);
      }
      ids.add(q.id);
    }
  }

  if (warnings.length > 0 && getPrivacyLintMode() === 'block') {
    const detail = warnings.map((w) => `${w.path}: "${w.phrase}"`).join('; ');
    throw new Error(`Voice onboarding text conflicts with privacy rules (${detail})`);
  }

  return { warnings };
}

module.exports = {
  MAX_ONBOARDING_DAYS,
  FACILITY_TYPES,
  FACILITY_TYPE_PRESETS,
  DEFAULT_ONBOARDING_PLAN,
  resolvePlanFromOrgSettings,
  normalizePlan,
  getQuestionIdsForDay,
  isValidOnboardingDay,
  isOnboardingEnabled,
  getFacilityTypePreset,
  getPlanFromOrg,
  getPlanForOrgId,
  getPlanForClientId,
  getDefaultPlanTemplate,
  assertValidVoiceOnboardingConfig,
};
