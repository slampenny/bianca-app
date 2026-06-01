const { scheduleRecurringJob } = require('../../../src/utils/agenda.utils');

describe('agenda.utils scheduleRecurringJob', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  let mockAgenda;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgenda = {
      cancel: jest.fn().mockResolvedValue(0),
      every: jest.fn().mockReturnValue({ attrs: { name: 'test-job' } }),
    };
  });

  it('cancels existing jobs by name before calling every', async () => {
    mockAgenda.cancel.mockResolvedValue(2);
    await scheduleRecurringJob({
      agenda: mockAgenda,
      jobName: 'runSchedules',
      interval: '15 minutes',
      logger: mockLogger,
    });
    expect(mockAgenda.cancel).toHaveBeenCalledWith({ name: 'runSchedules' });
    expect(mockAgenda.every).toHaveBeenCalledWith('15 minutes', 'runSchedules');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Cancelled 2 existing runSchedules')
    );
  });

  it('is safe to call twice — cancels before each every', async () => {
    mockAgenda.cancel.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await scheduleRecurringJob({
      agenda: mockAgenda,
      jobName: 'processDataDeletion',
      interval: '0 2 * * *',
      logger: mockLogger,
    });
    await scheduleRecurringJob({
      agenda: mockAgenda,
      jobName: 'processDataDeletion',
      interval: '0 2 * * *',
      logger: mockLogger,
    });
    expect(mockAgenda.cancel).toHaveBeenCalledTimes(2);
    expect(mockAgenda.every).toHaveBeenCalledTimes(2);
  });

  it('passes data to agenda.every when provided', async () => {
    const data = { type: 'monthly', description: 'test' };
    await scheduleRecurringJob({
      agenda: mockAgenda,
      jobName: 'monthly-medical-analysis',
      interval: '0 9 1 * *',
      data,
      logger: mockLogger,
    });
    expect(mockAgenda.every).toHaveBeenCalledWith('0 9 1 * *', 'monthly-medical-analysis', data);
  });

  it('does not cancel unrelated job names', async () => {
    await scheduleRecurringJob({
      agenda: mockAgenda,
      jobName: 'runSchedules',
      interval: '15 minutes',
      logger: mockLogger,
    });
    expect(mockAgenda.cancel).toHaveBeenCalledWith({ name: 'runSchedules' });
    expect(mockAgenda.cancel).not.toHaveBeenCalledWith({ name: 'retryMissedCall' });
  });

  it('throws when required params are missing', async () => {
    await expect(scheduleRecurringJob({ agenda: mockAgenda, jobName: 'x' })).rejects.toThrow(
      'scheduleRecurringJob requires agenda, jobName, and interval'
    );
  });
});
