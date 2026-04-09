/**
 * Canonical order of onboarding topic ids per day (must match onboardingPrompts.js).
 * Used to map resident answer turns from conversation transcripts to OnboardingResponse rows.
 */
const ONBOARDING_QUESTION_ORDER = {
  1: [
    'day1_emotional_orientation',
    'day1_cognitive_orientation',
    'day1_fall_steadiness',
    'day1_fall_history',
    'day1_bathroom_mobility',
    'day1_unmet_needs',
  ],
  2: [
    'day2_morning_routine',
    'day2_independence_preference',
    'day2_bathe_time',
    'day2_memory_meds',
    'day2_dressing_adl',
  ],
  3: ['day3_mood', 'day3_coping_comforts', 'day3_social_preference', 'day3_triggers'],
  4: ['day4_good_day', 'day4_food_prefs', 'day4_home_comfort', 'day4_hobbies'],
};

/**
 * @param {number} day
 * @returns {string[]}
 */
function getQuestionIdsForDay(day) {
  if (day >= 1 && day <= 4) {
    return [...ONBOARDING_QUESTION_ORDER[day]];
  }
  return [];
}

module.exports = { ONBOARDING_QUESTION_ORDER, getQuestionIdsForDay };
