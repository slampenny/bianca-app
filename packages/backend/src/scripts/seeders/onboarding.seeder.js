/**
 * Seeds dedicated clients with OnboardingResponse + Call rows at different journey stages
 * for local / demo testing of GET /clients/:id/onboarding and the caregiver UI.
 * Aligns with onboardingPrompts.js question_id slugs and onboarding.service getDashboardForClient.
 */
const { Client, Call, OnboardingResponse } = require('../../models');

const DAY1_TOPICS = [
  ['day1_emotional_orientation', 'Doing pretty well, thanks.'],
  ['day1_cognitive_orientation', 'Yes, I know I am at the community.'],
  ['day1_fall_steadiness', 'I feel steady most of the time.'],
  ['day1_fall_history', 'No falls lately.'],
  ['day1_bathroom_mobility', 'I manage fine with the grab bar.'],
  ['day1_unmet_needs', 'Nothing urgent right now.'],
];

const DAY2_TOPICS = [
  ['day2_morning_routine', 'Coffee, news, then a short walk.'],
  ['day2_independence_preference', 'I like to do what I can myself.'],
  ['day2_bathe_time', 'Usually mornings.'],
  ['day2_memory_meds', 'Sometimes I forget the evening pill.'],
  ['day2_dressing_adl', 'I can dress myself; socks are tricky.'],
];

const DAY3_TOPICS = [
  ['day3_mood', 'A little low this week but okay today.'],
  ['day3_coping_comforts', 'Music and talking with my sister.'],
  ['day3_social_preference', 'I like people but need quiet afternoons.'],
  ['day3_triggers', 'Loud announcements in the hall bother me.'],
];

const DAY4_TOPICS = [
  ['day4_good_day', 'Sunny weather and a good lunch.'],
  ['day4_food_prefs', 'Love soup; not a fan of spicy food.'],
  ['day4_home_comfort', 'Photos of my family by the bed.'],
  ['day4_hobbies', 'Crossword puzzles and old movies.'],
];

function daysAgoDate(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function createOnboardingCall(clientId, onboardingDay, { caregiverId, completed, endedReason = 'completed', daysAgo = 1 }) {
  const start = daysAgoDate(daysAgo + onboardingDay);
  const end = new Date(start.getTime() + 8 * 60 * 1000);
  const sid = `SEED_ONB_${String(clientId)}_d${onboardingDay}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return Call.create({
    callSid: sid,
    clientId,
    caregiverId,
    status: 'completed',
    callStatus: 'ended',
    duration: 480,
    startTime: start,
    endTime: end,
    callStartTime: start,
    callEndTime: end,
    onboardingDay,
    onboardingCompletedAt: completed ? new Date(end.getTime() - 60 * 1000) : null,
    onboardingEndedEarlyReason: completed ? endedReason : null,
  });
}

async function insertCaptures(clientId, dayNumber, topicPairs, extraByQuestionId = {}) {
  const capturedAt = daysAgoDate(2);
  for (const [questionId, responseValue] of topicPairs) {
    const extra = extraByQuestionId[questionId] || {};
    await OnboardingResponse.create({
      clientId,
      dayNumber,
      questionId,
      responseType: 'text',
      responseValue,
      capturedAt,
      safety_flag: !!extra.safety_flag,
      memory_flag: !!extra.memory_flag,
      mood_flag: !!extra.mood_flag,
      distress_flag: !!extra.distress_flag,
      confusion_flag: !!extra.confusion_flag,
    });
  }
}

const PREFERRED_NAMES = ['Ruth', 'Pat', 'Sam', 'Lee', 'May'];

const SCENARIOS = [
  {
    name: 'Onboarding (not started)',
    email: 'onboarding.none@example.org',
    phone: '1234567911',
    notes: 'Seed: no onboarding captures or onboarding calls — journey shows not started.',
    seed: async () => {
      /* client only — no onboarding calls */
    },
  },
  {
    name: 'Onboarding (day 1 in progress)',
    email: 'onboarding.day1wip@example.org',
    phone: '1234567912',
    notes: 'Seed: partial day-1 captures; latest day-1 onboarding call not completed.',
    seed: async (client, caregiverId) => {
      await insertCaptures(client._id, 1, DAY1_TOPICS.slice(0, 3));
      await createOnboardingCall(client._id, 1, { caregiverId, completed: false, daysAgo: 1 });
    },
  },
  {
    name: 'Onboarding (day 2 in progress)',
    email: 'onboarding.day2wip@example.org',
    phone: '1234567913',
    notes: 'Seed: day 1 session completed with captures; partial day 2 captures.',
    seed: async (client, caregiverId) => {
      await insertCaptures(client._id, 1, DAY1_TOPICS);
      await createOnboardingCall(client._id, 1, { caregiverId, completed: true, daysAgo: 5 });
      await insertCaptures(client._id, 2, DAY2_TOPICS.slice(0, 2));
    },
  },
  {
    name: 'Onboarding (day 4 in progress)',
    email: 'onboarding.day4wip@example.org',
    phone: '1234567914',
    notes: 'Seed: days 1–3 completed; day 4 partial captures only.',
    seed: async (client, caregiverId) => {
      await insertCaptures(client._id, 1, DAY1_TOPICS);
      await createOnboardingCall(client._id, 1, { caregiverId, completed: true, daysAgo: 14 });
      await insertCaptures(client._id, 2, DAY2_TOPICS);
      await createOnboardingCall(client._id, 2, { caregiverId, completed: true, daysAgo: 11 });
      await insertCaptures(client._id, 3, DAY3_TOPICS, {
        day3_mood: { mood_flag: true },
      });
      await createOnboardingCall(client._id, 3, { caregiverId, completed: true, daysAgo: 8 });
      await insertCaptures(client._id, 4, DAY4_TOPICS.slice(0, 2));
    },
  },
  {
    name: 'Onboarding (complete)',
    email: 'onboarding.complete@example.org',
    phone: '1234567915',
    notes: 'Seed: all four onboarding calls completed with captures.',
    seed: async (client, caregiverId) => {
      await insertCaptures(client._id, 1, DAY1_TOPICS);
      await createOnboardingCall(client._id, 1, { caregiverId, completed: true, daysAgo: 21 });
      await insertCaptures(client._id, 2, DAY2_TOPICS);
      await createOnboardingCall(client._id, 2, { caregiverId, completed: true, daysAgo: 18 });
      await insertCaptures(client._id, 3, DAY3_TOPICS);
      await createOnboardingCall(client._id, 3, { caregiverId, completed: true, daysAgo: 15 });
      await insertCaptures(client._id, 4, DAY4_TOPICS);
      await createOnboardingCall(client._id, 4, { caregiverId, completed: true, daysAgo: 12 });
    },
  },
];

/**
 * @param {import('mongoose').Document} caregiver - caregiver with org and clients array
 * @returns {Promise<import('mongoose').Document[]>}
 */
async function seedOnboardingScenarioClients(caregiver) {
  console.log('Seeding onboarding scenario clients (captures + calls)...');
  const created = [];

  for (let i = 0; i < SCENARIOS.length; i += 1) {
    const scenario = SCENARIOS[i];
    const client = new Client({
      name: scenario.name,
      email: scenario.email,
      phone: scenario.phone,
      preferredName: PREFERRED_NAMES[i] || 'Friend',
      preferredLanguage: 'en',
      age: 78,
      notes: scenario.notes,
      caregivers: [caregiver._id],
      org: caregiver.org,
      schedules: [],
      isEmailVerified: true,
    });
    await client.save();
    caregiver.clients.push(client._id);
    await scenario.seed(client, caregiver._id);
    created.push(client);
  }

  await caregiver.save();
  console.log(`Seeded ${created.length} onboarding scenario clients`);
  return created;
}

module.exports = {
  seedOnboardingScenarioClients,
};
