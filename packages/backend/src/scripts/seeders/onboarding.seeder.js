/**
 * Seeds OnboardingResponse + Call rows for the three primary test clients under fake@example.org
 * (fixture clients + Margaret) so the caregiver UI can exercise different journey stages locally.
 * Aligns with onboardingPrompts.js question_id slugs and onboarding.service getDashboardForClient.
 */
const { Call, OnboardingResponse } = require('../../models');

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

/** Partial day-1 answers; latest day-1 onboarding call not completed → currentDay 1 */
async function seedDay1InProgress(clientId, caregiverId) {
  await insertCaptures(clientId, 1, DAY1_TOPICS.slice(0, 3));
  await createOnboardingCall(clientId, 1, { caregiverId, completed: false, daysAgo: 1 });
}

/** All four days completed with full captures */
async function seedJourneyComplete(clientId, caregiverId) {
  await insertCaptures(clientId, 1, DAY1_TOPICS);
  await createOnboardingCall(clientId, 1, { caregiverId, completed: true, daysAgo: 21 });
  await insertCaptures(clientId, 2, DAY2_TOPICS);
  await createOnboardingCall(clientId, 2, { caregiverId, completed: true, daysAgo: 18 });
  await insertCaptures(clientId, 3, DAY3_TOPICS, {
    day3_mood: { mood_flag: true },
  });
  await createOnboardingCall(clientId, 3, { caregiverId, completed: true, daysAgo: 15 });
  await insertCaptures(clientId, 4, DAY4_TOPICS);
  await createOnboardingCall(clientId, 4, { caregiverId, completed: true, daysAgo: 12 });
}

/**
 * Journey complete in dashboard APIs (four completed onboarding calls), no captured answers.
 * Use for bulk seeding so most residents look "done" like real long-term clients.
 */
async function seedJourneyCompleteCallsOnly(clientId, caregiverId) {
  const base = 40;
  for (let day = 1; day <= 4; day += 1) {
    await createOnboardingCall(clientId, day, { caregiverId, completed: true, daysAgo: base - (day - 1) * 5 });
  }
}

/**
 * @param {import('mongoose').Document[]} clients
 * @param {import('mongoose').Types.ObjectId} caregiverId
 */
async function seedBulkOnboardingComplete(clients, caregiverId) {
  if (!clients?.length) return;
  console.log(`Seeding completed onboarding (calls only) for ${clients.length} additional client(s)...`);
  for (const c of clients) {
    await seedJourneyCompleteCallsOnly(c._id, caregiverId);
  }
}

/**
 * Agnes Alphabet: day 1 in progress (answers + incomplete session) — sole in-flight example for UI.
 * Barnaby Button: journey complete (calls only), like a typical long-term resident.
 * Margaret Thompson: full journey with captures (incl. mood flag on day 3) for testing historic answers.
 *
 * @param {import('mongoose').Document} client1
 * @param {import('mongoose').Document} client2
 * @param {import('mongoose').Document} client3
 * @param {import('mongoose').Types.ObjectId} caregiverId
 */
async function seedPrimaryTestClientsOnboarding(client1, client2, client3, caregiverId) {
  console.log('Seeding onboarding on primary test clients (one in progress, two complete)...');
  await seedDay1InProgress(client1._id, caregiverId);
  await seedJourneyCompleteCallsOnly(client2._id, caregiverId);
  await seedJourneyComplete(client3._id, caregiverId);
  console.log('Onboarding seed: Agnes (day 1 WIP), Barnaby (complete, calls only), Margaret (complete + answers)');
}

module.exports = {
  seedPrimaryTestClientsOnboarding,
  seedJourneyCompleteCallsOnly,
  seedBulkOnboardingComplete,
};
