/**
 * Canonical default resident voice onboarding plan (4 days).
 * Used when org.voiceOnboarding.useDefault is true or unset.
 */
const DEFAULT_ONBOARDING_PLAN = {
  useDefault: true,
  totalDays: 4,
  days: [
    {
      dayNumber: 1,
      theme: 'Safety & Orientation',
      opening:
        "Hi {resident_name}, my name is Bianca — I'm an AI wellness assistant, and I'm calling from {facility_name} just to check in and say hello. How are you feeling being there so far?",
      questions: [
        { id: 'day1_emotional_orientation', prompt: 'How are you feeling being there so far?' },
        { id: 'day1_cognitive_orientation', prompt: 'Do you know where you are right now?' },
        { id: 'day1_fall_steadiness', prompt: "Do you feel steady on your feet when you're walking?" },
        { id: 'day1_fall_history', prompt: 'Have you had any falls recently, in the last few weeks?' },
        { id: 'day1_bathroom_mobility', prompt: 'Are you comfortable getting to the bathroom on your own?' },
        {
          id: 'day1_unmet_needs',
          prompt: "Is there anything you need help with right now that you're not getting?",
          compressionPriority: true,
        },
      ],
    },
    {
      dayNumber: 2,
      theme: 'Routine & Independence',
      opening:
        "Hi {resident_name}, it's Bianca again — the AI wellness assistant from {facility_name}. How are you doing today?",
      questions: [
        { id: 'day2_morning_routine', prompt: 'What does a typical morning look like for you?', compressionPriority: true },
        { id: 'day2_independence_preference', prompt: 'Do you prefer doing things yourself, or do you like having help?' },
        { id: 'day2_bathe_time', prompt: 'Do you usually shower or bathe in the morning or the evening?' },
        { id: 'day2_memory_meds', prompt: 'Do you ever find yourself forgetting things like meals or medications?', compressionPriority: true },
        { id: 'day2_dressing_adl', prompt: 'When it comes to getting dressed, do you manage that yourself or do you like some help?' },
      ],
    },
    {
      dayNumber: 3,
      theme: 'Emotional & Social',
      opening:
        "Hi {resident_name}, it's Bianca from {facility_name}. Lovely to chat with you again. How has your day been so far?",
      questions: [
        {
          id: 'day3_mood',
          prompt: "How has your mood been lately — overall, would you say you've been feeling okay?",
          compressionPriority: true,
        },
        { id: 'day3_coping_comforts', prompt: 'What kinds of things help you feel calm or happy?' },
        {
          id: 'day3_social_preference',
          prompt: 'Do you enjoy spending time with other people, or do you tend to prefer quiet time to yourself?',
          compressionPriority: true,
        },
        { id: 'day3_triggers', prompt: "Is there anything that tends to frustrate or upset you — things you'd want us to know about?" },
      ],
    },
    {
      dayNumber: 4,
      theme: 'Preferences & Personalization',
      opening:
        "Hi {resident_name}, it's Bianca from {facility_name}. This is our last check-in call for this week — I just wanted to learn a little more about you. Do you have a few minutes?",
      questions: [
        { id: 'day4_good_day', prompt: 'What makes a really good day for you?' },
        { id: 'day4_food_prefs', prompt: "Are there foods you love — or things you really can't stand?" },
        { id: 'day4_home_comfort', prompt: 'What helps you feel most at home and comfortable?' },
        { id: 'day4_hobbies', prompt: 'What do you enjoy doing with your time — any hobbies or things you like to do?' },
      ],
    },
  ],
};

module.exports = { DEFAULT_ONBOARDING_PLAN };
