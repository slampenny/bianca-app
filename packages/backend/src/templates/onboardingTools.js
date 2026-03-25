/**
 * OpenAI Realtime GA session tools for resident onboarding (data capture only).
 * @see docs — Resident Onboarding PRD
 */
function getOnboardingRealtimeTools() {
  return [
    {
      type: 'function',
      name: 'capture_onboarding_response',
      description:
        'After the resident gives a meaningful answer to one of today\'s onboarding topics, record it here. ' +
        'Call silently — never read parameters aloud. Use stable question_id slugs from the session instructions.',
      parameters: {
        type: 'object',
        properties: {
          question_id: {
            type: 'string',
            description:
              'Stable id, e.g. day1_emotional_orientation, day1_cognitive_orientation, day1_fall_steadiness, day1_fall_history, day1_bathroom_mobility, day1_unmet_needs, day2_morning_routine, day2_independence_preference, day2_bathe_time, day2_memory_meds, day2_dressing_adl, day3_mood, day3_coping_comforts, day3_social_preference, day3_triggers, day4_good_day, day4_food_prefs, day4_home_comfort, day4_hobbies',
          },
          response_type: {
            type: 'string',
            enum: ['text', 'boolean', 'enum'],
            description: 'How to interpret response_value',
          },
          response_value: {
            description: 'Normalized or verbatim answer (string, boolean, or short enum)',
          },
          verbatim_transcript: {
            type: 'string',
            description: 'Exact wording when useful for care review',
          },
          safety_flag: { type: 'boolean', description: 'Immediate safety concern (falls, urgent unmet need)' },
          memory_flag: { type: 'boolean', description: 'Memory / forgetting concern' },
          mood_flag: { type: 'boolean', description: 'Persistent low mood / hopelessness' },
          distress_flag: { type: 'boolean', description: 'Resident expressed significant distress' },
          confusion_flag: { type: 'boolean', description: 'Significant disorientation' },
          notes: { type: 'string', description: 'Short internal note for care team' },
        },
        required: ['question_id', 'response_type', 'response_value'],
      },
    },
    {
      type: 'function',
      name: 'complete_onboarding_session',
      description:
        'Call when the session ends normally or early (fatigue, distress, time, declined). Updates call metadata.',
      parameters: {
        type: 'object',
        properties: {
          ended_early_reason: {
            type: 'string',
            enum: ['none', 'fatigue', 'distress', 'confusion', 'resident_declined', 'time_limit', 'completed'],
            description: 'none or completed = normal wrap',
          },
          summary_notes: { type: 'string', description: 'Optional short summary for staff' },
        },
        required: ['ended_early_reason'],
      },
    },
  ];
}

module.exports = { getOnboardingRealtimeTools };
