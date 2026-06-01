jest.mock('../../../src/config/config', () => ({
  mongoose: { url: 'mongodb://localhost:27017/test' },
  billing: { enableUsageReporting: false, usageReportingTime: '00:00' },
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
const mockNow = jest.fn();
const mockCancel = jest.fn().mockResolvedValue(0);

jest.mock('agenda', () =>
  jest.fn().mockImplementation(() => ({
    define: mockDefine,
    on: jest.fn(),
    once: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    every: mockEvery,
    now: mockNow,
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

describe('agenda daily digest registration', () => {
  beforeEach(() => {
    jest.resetModules();
    mockDefine.mockClear();
    mockEvery.mockClear();
    mockCancel.mockClear();
    mockCancel.mockResolvedValue(0);
  });

  it('does not register daily digest jobs when scheduler is disabled', () => {
    jest.doMock('../../../src/config/config', () => ({
      mongoose: { url: 'mongodb://localhost:27017/test' },
      billing: { enableUsageReporting: false, usageReportingTime: '00:00' },
      dailyDigestScheduler: {
        enabled: false,
        coordinatorIntervalMinutes: 15,
        defaultSendTime: '18:00',
        staleProcessingMinutes: 30,
        childJobConcurrency: 5,
        lockLifetimeMs: 600000,
      },
    }));
    const { registerDailyDigestAgendaJobs } = require('../../../src/config/agenda');
    const fakeAgenda = { define: mockDefine, every: mockEvery, now: mockNow };
    registerDailyDigestAgendaJobs(fakeAgenda);
    const names = mockDefine.mock.calls.map((call) => call[0]);
    expect(names).not.toContain('processDailyDigestCoordinator');
    expect(names).not.toContain('processCaregiverDailyDigest');
  });

  it('registers coordinator and child jobs when scheduler is enabled', () => {
    jest.doMock('../../../src/config/config', () => ({
      mongoose: { url: 'mongodb://localhost:27017/test' },
      billing: { enableUsageReporting: false, usageReportingTime: '00:00' },
      dailyDigestScheduler: {
        enabled: true,
        coordinatorIntervalMinutes: 15,
        defaultSendTime: '18:00',
        staleProcessingMinutes: 30,
        childJobConcurrency: 5,
        lockLifetimeMs: 600000,
      },
    }));
    jest.resetModules();
    const { registerDailyDigestAgendaJobs } = require('../../../src/config/agenda');
    const fakeAgenda = { define: mockDefine, every: mockEvery, now: mockNow };
    registerDailyDigestAgendaJobs(fakeAgenda);
    const names = mockDefine.mock.calls.map((call) => call[0]);
    expect(names).toContain('processDailyDigestCoordinator');
    expect(names).toContain('processCaregiverDailyDigest');
    const childOpts = mockDefine.mock.calls.find((call) => call[0] === 'processCaregiverDailyDigest')[1];
    expect(childOpts.concurrency).toBe(5);
    expect(childOpts.lockLifetime).toBe(600000);
  });

  it('scheduleDailyDigestCoordinator cancels existing jobs before every when enabled', async () => {
    jest.doMock('../../../src/config/config', () => ({
      mongoose: { url: 'mongodb://localhost:27017/test' },
      billing: { enableUsageReporting: false, usageReportingTime: '00:00' },
      dailyDigestScheduler: {
        enabled: true,
        coordinatorIntervalMinutes: 15,
        defaultSendTime: '18:00',
        staleProcessingMinutes: 30,
        childJobConcurrency: 5,
        lockLifetimeMs: 600000,
      },
    }));
    jest.resetModules();
    const { scheduleDailyDigestCoordinator } = require('../../../src/config/agenda');
    const fakeAgenda = { define: mockDefine, every: mockEvery, now: mockNow, cancel: mockCancel };
    mockCancel.mockResolvedValueOnce(2);
    await scheduleDailyDigestCoordinator(fakeAgenda);
    expect(mockCancel).toHaveBeenCalledWith({ name: 'processDailyDigestCoordinator' });
    expect(mockEvery).toHaveBeenCalledWith('15 minutes', 'processDailyDigestCoordinator');
  });

  it('scheduleDailyDigestCoordinator is a no-op when scheduler disabled', async () => {
    jest.doMock('../../../src/config/config', () => ({
      mongoose: { url: 'mongodb://localhost:27017/test' },
      billing: { enableUsageReporting: false, usageReportingTime: '00:00' },
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
    const { scheduleDailyDigestCoordinator } = require('../../../src/config/agenda');
    const fakeAgenda = { define: mockDefine, every: mockEvery, now: mockNow, cancel: mockCancel };
    await scheduleDailyDigestCoordinator(fakeAgenda);
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockEvery).not.toHaveBeenCalled();
  });
});
