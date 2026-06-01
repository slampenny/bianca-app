jest.mock('../../../src/config/config', () => ({
  mongoose: { url: 'mongodb://localhost:27017/test' },
  billing: { enableUsageReporting: false, usageReportingTime: '03:30' },
  dailyDigestScheduler: {
    enabled: false,
    coordinatorIntervalMinutes: 15,
    defaultSendTime: '18:00',
    staleProcessingMinutes: 30,
    childJobConcurrency: 5,
    lockLifetimeMs: 600000,
  },
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockDefine = jest.fn();
const mockEvery = jest.fn();
const mockCancel = jest.fn().mockResolvedValue(0);

jest.mock('agenda', () =>
  jest.fn().mockImplementation(() => ({
    define: mockDefine,
    on: jest.fn(),
    once: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    every: mockEvery,
    now: jest.fn(),
    cancel: mockCancel,
    schedule: jest.fn(),
    jobs: jest.fn(),
  }))
);

jest.mock('../../../src/services', () => ({
  clientService: {},
  alertService: { createAlert: jest.fn() },
  paymentService: {},
}));

describe('registerRecurringAgendaJobs', () => {
  beforeEach(() => {
    jest.resetModules();
    mockDefine.mockClear();
    mockEvery.mockClear();
    mockCancel.mockClear();
    mockCancel.mockResolvedValue(0);
  });

  it('registers core recurring jobs via cancel-before-every', async () => {
    const { registerRecurringAgendaJobs, MAIN_RECURRING_AGENDA_JOBS } = require('../../../src/config/agenda');
    const fakeAgenda = { every: mockEvery, cancel: mockCancel };

    await registerRecurringAgendaJobs(fakeAgenda);

    const scheduledNames = mockEvery.mock.calls.map((call) => call[1]);
    expect(scheduledNames).toContain('runSchedules');
    expect(scheduledNames).toContain('processDataDeletion');
    expect(scheduledNames).toContain('checkClientsWithoutSchedules');
    expect(scheduledNames).not.toContain('processUsageReporting');
    expect(scheduledNames).not.toContain('processDailyDigestCoordinator');

    for (const name of ['runSchedules', 'processDataDeletion', 'checkClientsWithoutSchedules']) {
      expect(mockCancel).toHaveBeenCalledWith({ name });
    }
  });

  it('calling registerRecurringAgendaJobs twice cancels before each every', async () => {
    const { registerRecurringAgendaJobs } = require('../../../src/config/agenda');
    const fakeAgenda = { every: mockEvery, cancel: mockCancel };

    await registerRecurringAgendaJobs(fakeAgenda);
    await registerRecurringAgendaJobs(fakeAgenda);

    expect(mockCancel).toHaveBeenCalledTimes(6);
    expect(mockEvery).toHaveBeenCalledTimes(6);
  });

  it('includes processUsageReporting when billing reporting is enabled', async () => {
    jest.doMock('../../../src/config/config', () => ({
      mongoose: { url: 'mongodb://localhost:27017/test' },
      billing: { enableUsageReporting: true, usageReportingTime: '03:30' },
      dailyDigestScheduler: {
        enabled: false,
        coordinatorIntervalMinutes: 15,
        defaultSendTime: '18:00',
        staleProcessingMinutes: 30,
        childJobConcurrency: 5,
        lockLifetimeMs: 600000,
      },
    }));
    jest.resetModules();
    const { registerRecurringAgendaJobs } = require('../../../src/config/agenda');
    const fakeAgenda = { every: mockEvery, cancel: mockCancel };

    await registerRecurringAgendaJobs(fakeAgenda);

    const scheduledNames = mockEvery.mock.calls.map((call) => call[1]);
    expect(scheduledNames).toContain('processUsageReporting');
    expect(mockEvery).toHaveBeenCalledWith('30 03 * * *', 'processUsageReporting');
  });

  it('exports MAIN_RECURRING_AGENDA_JOBS listing all main recurring job names', () => {
    const { MAIN_RECURRING_AGENDA_JOBS } = require('../../../src/config/agenda');
    expect(MAIN_RECURRING_AGENDA_JOBS).toEqual([
      'runSchedules',
      'processUsageReporting',
      'processDataDeletion',
      'checkClientsWithoutSchedules',
      'processDailyDigestCoordinator',
    ]);
  });

  it('does not call cancel for unrelated one-off job names', async () => {
    const { registerRecurringAgendaJobs } = require('../../../src/config/agenda');
    const fakeAgenda = { every: mockEvery, cancel: mockCancel };

    await registerRecurringAgendaJobs(fakeAgenda);

    expect(mockCancel).not.toHaveBeenCalledWith({ name: 'retryMissedCall' });
    expect(mockCancel).not.toHaveBeenCalledWith({ name: 'processCaregiverDailyDigest' });
  });
});
