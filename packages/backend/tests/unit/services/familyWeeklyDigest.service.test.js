const {
  startOfUtcWeekContaining,
  endOfUtcWeek,
} = require('../../../src/services/familyWeeklyDigest.service');

describe('familyWeeklyDigest.service week boundaries', () => {
  it('normalizes to Monday UTC for a Wednesday in March 2026', () => {
    const wed = new Date(Date.UTC(2026, 2, 25, 15, 0, 0));
    const mon = startOfUtcWeekContaining(wed.toISOString());
    expect(mon.getUTCDay()).toBe(1);
    expect(mon.getUTCDate()).toBe(23);
    expect(mon.getUTCMonth()).toBe(2);
  });

  it('week end is Sunday 23:59:59.999 UTC relative to that Monday', () => {
    const mon = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
    const end = endOfUtcWeek(mon);
    expect(end.getUTCDay()).toBe(0);
    expect(end.getUTCDate()).toBe(29);
  });
});
