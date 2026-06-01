const {
  localWeekKeyForInstant,
  startOfOrgLocalWeek,
  endExclusiveOfOrgLocalWeek,
  endInclusiveOfOrgLocalWeek,
  resolveOrgLocalDigestWeek,
  startOfUtcWeekContaining,
  endOfUtcWeek,
} = require('../../../src/utils/digestWeek.utils');

describe('digestWeek.utils', () => {
  describe('resolveOrgLocalDigestWeek', () => {
    it('resolves current org-local ISO week when input is empty', () => {
      const { localWeekKey, timezone } = resolveOrgLocalDigestWeek('America/Toronto', null);
      expect(timezone).toBe('America/Toronto');
      expect(localWeekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const mon = startOfOrgLocalWeek(timezone, localWeekKey);
      expect(mon.getTime()).toBeLessThan(Date.now());
    });

    it('normalizes YYYY-MM-DD input to org-local Monday of that week', () => {
      const result = resolveOrgLocalDigestWeek('America/Toronto', '2026-03-25');
      expect(result.localWeekKey).toBe('2026-03-23');
      expect(result.timezone).toBe('America/Toronto');
    });

    it('maps ISO instant to org-local week', () => {
      const result = resolveOrgLocalDigestWeek('America/Toronto', '2026-03-23T06:00:00.000Z');
      expect(result.localWeekKey).toBe('2026-03-23');
    });
  });

  describe('America/Vancouver — Sunday evening vs UTC Monday', () => {
    const tz = 'America/Vancouver';

    it('Sunday 8pm local belongs to prior org-local week while UTC is already Monday', () => {
      // Sun Mar 22 2026 20:00 PDT = Mon Mar 23 03:00 UTC
      const instant = '2026-03-23T03:00:00.000Z';
      expect(localWeekKeyForInstant(tz, instant)).toBe('2026-03-16');
      expect(localWeekKeyForInstant('UTC', instant)).toBe('2026-03-23');
    });

    it('week boundaries span org-local Monday through Sunday', () => {
      const { weekStart, weekEndExclusive, weekEnd, localWeekKey } = resolveOrgLocalDigestWeek(
        tz,
        '2026-03-16'
      );
      expect(localWeekKey).toBe('2026-03-16');
      expect(weekStart.toISOString()).toBe('2026-03-16T07:00:00.000Z');
      expect(weekEndExclusive.toISOString()).toBe('2026-03-23T07:00:00.000Z');
      expect(weekEnd.toISOString()).toBe('2026-03-23T06:59:59.999Z');
      expect(instantInRange(weekStart, weekEndExclusive, '2026-03-23T03:00:00.000Z')).toBe(true);
      expect(instantInRange(weekStart, weekEndExclusive, '2026-03-23T07:00:00.000Z')).toBe(false);
    });
  });

  describe('America/Toronto — Monday early morning', () => {
    const tz = 'America/Toronto';

    it('Monday 2am Eastern is in the week starting that Monday', () => {
      const instant = '2026-03-23T06:00:00.000Z'; // Mon Mar 23 2am EDT
      expect(localWeekKeyForInstant(tz, instant)).toBe('2026-03-23');
      const start = startOfOrgLocalWeek(tz, '2026-03-23');
      expect(start.toISOString()).toBe('2026-03-23T04:00:00.000Z');
    });
  });

  describe('America/Los_Angeles — DST spring-forward week', () => {
    const tz = 'America/Los_Angeles';
    const localWeekKey = '2026-03-02';

    it('week containing Mar 8 spring-forward spans seven calendar days (167 wall-clock hours)', () => {
      const weekStart = startOfOrgLocalWeek(tz, localWeekKey);
      const weekEndExclusive = endExclusiveOfOrgLocalWeek(tz, localWeekKey);
      expect(weekEndExclusive.getTime() - weekStart.getTime()).toBe(167 * 60 * 60 * 1000);
    });

    it('call on spring-forward Sunday is included in the week', () => {
      const { weekStart, weekEndExclusive } = resolveOrgLocalDigestWeek(tz, localWeekKey);
      const springForwardSunday = '2026-03-08T20:00:00.000Z'; // Mar 8 noon-ish after spring forward
      expect(instantInRange(weekStart, weekEndExclusive, springForwardSunday)).toBe(true);
    });
  });

  describe('America/Los_Angeles — DST fall-back week', () => {
    const tz = 'America/Los_Angeles';
    const localWeekKey = '2026-10-26';

    it('week containing Nov 1 fall-back spans seven calendar days (169 wall-clock hours)', () => {
      const weekStart = startOfOrgLocalWeek(tz, localWeekKey);
      const weekEndExclusive = endExclusiveOfOrgLocalWeek(tz, localWeekKey);
      expect(weekEndExclusive.getTime() - weekStart.getTime()).toBe(169 * 60 * 60 * 1000);
    });

    it('call during fall-back Sunday is included', () => {
      const { weekStart, weekEndExclusive } = resolveOrgLocalDigestWeek(tz, localWeekKey);
      const fallBackInstant = '2026-11-01T08:30:00.000Z'; // Nov 1 morning PT
      expect(instantInRange(weekStart, weekEndExclusive, fallBackInstant)).toBe(true);
    });

    it('endInclusiveOfOrgLocalWeek is last ms of org-local Sunday', () => {
      const end = endInclusiveOfOrgLocalWeek(tz, localWeekKey);
      expect(end.toISOString()).toBe('2026-11-02T07:59:59.999Z');
    });
  });

  describe('legacy UTC helpers', () => {
    it('startOfUtcWeekContaining returns Monday UTC', () => {
      const mon = startOfUtcWeekContaining('2026-03-25T15:00:00.000Z');
      expect(mon.toISOString()).toBe('2026-03-23T00:00:00.000Z');
    });

    it('endOfUtcWeek is Sunday 23:59:59.999 UTC', () => {
      const mon = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
      const end = endOfUtcWeek(mon);
      expect(end.toISOString()).toBe('2026-03-29T23:59:59.999Z');
    });
  });
});

function instantInRange(start, endExclusive, iso) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < endExclusive.getTime();
}
