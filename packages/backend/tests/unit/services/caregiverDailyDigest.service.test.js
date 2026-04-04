const { startOfUtcDayContaining, endOfUtcDay } = require('../../../src/services/caregiverDailyDigest.service');

describe('caregiverDailyDigest.service UTC day boundaries', () => {
  it('startOfUtcDayContaining returns UTC midnight for a date string', () => {
    const d = startOfUtcDayContaining('2026-03-15T22:30:00.000Z');
    expect(d.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('endOfUtcDay is last ms of that calendar day', () => {
    const start = new Date(Date.UTC(2026, 2, 15, 0, 0, 0, 0));
    const end = endOfUtcDay(start);
    expect(end.toISOString()).toBe('2026-03-15T23:59:59.999Z');
  });
});
