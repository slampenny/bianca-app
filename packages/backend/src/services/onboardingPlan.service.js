const { Client, Org } = require('../models');
const { DEFAULT_ONBOARDING_PLAN } = require('../templates/defaultOnboardingPlan');

const MAX_ONBOARDING_DAYS = 14;

/**
 * @typedef {{ id: string, prompt: string, compressionPriority?: boolean }} OnboardingQuestionPlan
 * @typedef {{ dayNumber: number, theme?: string, opening?: string, questions: OnboardingQuestionPlan[] }} OnboardingDayPlan
 * @typedef {{ useDefault: boolean, totalDays: number, days: OnboardingDayPlan[] }} ResolvedOnboardingPlan
 */

/**
 * @param {object|null|undefined} orgVoiceOnboarding
 * @returns {ResolvedOnboardingPlan}
 */
function resolvePlanFromOrgSettings(orgVoiceOnboarding) {
  if (!orgVoiceOnboarding || orgVoiceOnboarding.useDefault !== false) {
    return normalizePlan(DEFAULT_ONBOARDING_PLAN);
  }

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

/**
 * @param {ResolvedOnboardingPlan|object} plan
 * @returns {ResolvedOnboardingPlan}
 */
function normalizePlan(plan) {
  const sortedDays = [...(plan.days || [])]
    .filter((d) => Array.isArray(d.questions) && d.questions.length > 0)
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .slice(0, MAX_ONBOARDING_DAYS)
    .map((day, index) => ({
      dayNumber: index + 1,
      theme: day.theme || `Day ${index + 1}`,
      opening: day.opening || '',
      questions: day.questions
        .filter((q) => q.id && q.prompt)
        .map((q) => ({
          id: q.id,
          prompt: q.prompt,
          compressionPriority: q.compressionPriority === true,
        })),
    }))
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
  return dayNumber >= 1 && dayNumber <= plan.totalDays && plan.days.some((d) => d.dayNumber === dayNumber);
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
  return resolvePlanFromOrgSettings(orgDoc?.voiceOnboarding);
}

/**
 * @param {string|import('mongoose').Types.ObjectId|null|undefined} orgId
 * @returns {Promise<ResolvedOnboardingPlan>}
 */
async function getPlanForOrgId(orgId) {
  if (!orgId) {
    return normalizePlan(DEFAULT_ONBOARDING_PLAN);
  }
  const org = await Org.findById(orgId).select('voiceOnboarding').lean();
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
 * @param {{ useDefault?: boolean, days?: object[] }} voiceOnboarding
 * @throws {Error}
 */
function assertValidVoiceOnboardingConfig(voiceOnboarding) {
  if (!voiceOnboarding || voiceOnboarding.useDefault !== false) {
    return;
  }
  const plan = resolvePlanFromOrgSettings(voiceOnboarding);
  if (!isOnboardingEnabled(plan)) {
    return;
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
}

module.exports = {
  MAX_ONBOARDING_DAYS,
  DEFAULT_ONBOARDING_PLAN,
  resolvePlanFromOrgSettings,
  normalizePlan,
  getQuestionIdsForDay,
  isValidOnboardingDay,
  isOnboardingEnabled,
  getPlanFromOrg,
  getPlanForOrgId,
  getPlanForClientId,
  getDefaultPlanTemplate,
  assertValidVoiceOnboardingConfig,
};
