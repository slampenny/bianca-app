/**
 * Canonical order of onboarding topic ids per day (default plan).
 * Runtime code should prefer onboardingPlan.service.getQuestionIdsForDay(plan, day).
 */
const { DEFAULT_ONBOARDING_PLAN } = require('./defaultOnboardingPlan');

const ONBOARDING_QUESTION_ORDER = Object.fromEntries(
  DEFAULT_ONBOARDING_PLAN.days.map((day) => [day.dayNumber, day.questions.map((q) => q.id)])
);

/**
 * @param {number} day
 * @returns {string[]}
 */
function getQuestionIdsForDay(day) {
  return ONBOARDING_QUESTION_ORDER[day] ? [...ONBOARDING_QUESTION_ORDER[day]] : [];
}

module.exports = { ONBOARDING_QUESTION_ORDER, getQuestionIdsForDay };
