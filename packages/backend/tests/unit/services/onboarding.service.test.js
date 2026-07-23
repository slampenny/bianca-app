const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Client, Call, OnboardingResponse } = require('../../../src/models');
const onboardingService = require('../../../src/services/onboarding.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { clientOne, insertClientsWithOrg } = require('../../fixtures/client.fixture');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('onboarding.service getDashboardForClient', () => {
  afterEach(async () => {
    await OnboardingResponse.deleteMany();
    await Call.deleteMany();
    await Client.deleteMany();
    await Org.deleteMany();
  });

  it('returns empty journey when client has no onboarding data', async () => {
    const [org] = await insertOrgs([orgOne]);
    const [client] = await insertClientsWithOrg([clientOne], org._id);

    const payload = await onboardingService.getDashboardForClient(client.id);

    expect(payload.questionCount).toBe(0);
    expect(payload.responses).toHaveLength(0);
    expect(payload.journey.journeyComplete).toBe(false);
    expect(payload.journey.currentDay).toBe(0);
    expect(payload.journey.hasAnyOnboardingActivity).toBe(false);
    expect(payload.journey.days.map((d) => d.dayNumber)).toEqual([0, 1, 2, 3, 4]);
    expect(payload.journey.totalDays).toBe(5);
  });

  it('returns journeyComplete when org onboarding is disabled', async () => {
    const [org] = await insertOrgs([{ ...orgOne, voiceOnboarding: { useDefault: false, days: [] } }]);
    const [client] = await insertClientsWithOrg([clientOne], org._id);

    const payload = await onboardingService.getDashboardForClient(client.id);

    expect(payload.journey.enabled).toBe(false);
    expect(payload.journey.totalDays).toBe(0);
    expect(payload.journey.journeyComplete).toBe(true);
    expect(payload.journey.currentDay).toBeNull();
    expect(payload.journey.days).toHaveLength(0);
  });

  it('aggregates flags and per-day captured counts', async () => {
    const [org] = await insertOrgs([orgOne]);
    const [client] = await insertClientsWithOrg([clientOne], org._id);

    await OnboardingResponse.create({
      clientId: client._id,
      dayNumber: 1,
      questionId: 'day1_fall_history',
      responseType: 'text',
      responseValue: 'no',
      mood_flag: true,
    });

    const payload = await onboardingService.getDashboardForClient(client.id);

    expect(payload.questionCount).toBe(1);
    expect(payload.flags.mood).toBe(true);
    expect(payload.journey.days[0].dayNumber).toBe(0);
    expect(payload.journey.days[0].capturedCount).toBe(0);
    expect(payload.journey.days[1].dayNumber).toBe(1);
    expect(payload.journey.days[1].capturedCount).toBe(1);
    expect(payload.journey.days[2].capturedCount).toBe(0);
  });

  it('filters responses by dayNumber', async () => {
    const [org] = await insertOrgs([orgOne]);
    const [client] = await insertClientsWithOrg([clientOne], org._id);

    await OnboardingResponse.create({
      clientId: client._id,
      dayNumber: 1,
      questionId: 'q1',
      responseType: 'text',
      responseValue: 'a',
    });
    await OnboardingResponse.create({
      clientId: client._id,
      dayNumber: 2,
      questionId: 'q2',
      responseType: 'text',
      responseValue: 'b',
    });

    const payload = await onboardingService.getDashboardForClient(client.id, { dayNumber: 2 });

    expect(payload.responses).toHaveLength(1);
    expect(payload.responses[0].questionId).toBe('q2');
    expect(payload.questionCount).toBe(2);
  });
});
