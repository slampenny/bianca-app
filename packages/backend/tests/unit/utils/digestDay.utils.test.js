const {
  resolveOrgTimezone,
  localDateKeyForInstant,
  startOfOrgLocalDay,
  endOfOrgLocalDay,
  endExclusiveOfOrgLocalDay,
  resolveOrgLocalDigestDay,
  getPayloadDigestDayStartIso,
} = require('../../../src/utils/digestDay.utils');

describe('digestDay.utils', () => {
  describe('resolveOrgTimezone', () => {
    it('falls back to America/Los_Angeles when timezone is missing', () => {
      expect(resolveOrgTimezone(null)).toBe('America/Los_Angeles');
      expect(resolveOrgTimezone('')).toBe('America/Los_Angeles');
    });

    it('trims and preserves valid IANA zones', () => {
      expect(resolveOrgTimezone('  America/New_York  ')).toBe('America/New_York');
    });
  });

  describe('America/Los_Angeles', () => {
    const tz = 'America/Los_Angeles';

    it('startOfOrgLocalDay returns Pacific midnight as UTC instant', () => {
      const start = startOfOrgLocalDay(tz, '2026-06-01');
      expect(start.toISOString()).toBe('2026-06-01T07:00:00.000Z');
    });

    it('endOfOrgLocalDay is last ms of local day', () => {
      const end = endOfOrgLocalDay(tz, '2026-06-01');
      expect(end.toISOString()).toBe('2026-06-02T06:59:59.999Z');
    });

    it('spring-forward day (2026-03-08) has 23-hour local day', () => {
      const start = startOfOrgLocalDay(tz, '2026-03-08');
      const endExclusive = endExclusiveOfOrgLocalDay(tz, '2026-03-08');
      expect(endExclusive.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
    });

    it('fall-back day (2026-11-01) has 25-hour local day', () => {
      const start = startOfOrgLocalDay(tz, '2026-11-01');
      const endExclusive = endExclusiveOfOrgLocalDay(tz, '2026-11-01');
      expect(endExclusive.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    });

    it('localDateKeyForInstant maps UTC instant to org-local date', () => {
      // 2026-06-01 06:30 UTC = May 31 11:30pm PT
      expect(localDateKeyForInstant(tz, '2026-06-01T06:30:00.000Z')).toBe('2026-05-31');
      // 2026-06-01 07:30 UTC = June 1 12:30am PT
      expect(localDateKeyForInstant(tz, '2026-06-01T07:30:00.000Z')).toBe('2026-06-01');
    });
  });

  describe('America/New_York', () => {
    const tz = 'America/New_York';

    it('startOfOrgLocalDay uses Eastern offset in June (EDT)', () => {
      const start = startOfOrgLocalDay(tz, '2026-06-01');
      expect(start.toISOString()).toBe('2026-06-01T04:00:00.000Z');
    });

    it('spring-forward day (2026-03-08) is 23 hours long', () => {
      const start = startOfOrgLocalDay(tz, '2026-03-08');
      const endExclusive = endExclusiveOfOrgLocalDay(tz, '2026-03-08');
      expect(endExclusive.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
    });

    it('fall-back day (2026-11-01) is 25 hours long', () => {
      const start = startOfOrgLocalDay(tz, '2026-11-01');
      const endExclusive = endExclusiveOfOrgLocalDay(tz, '2026-11-01');
      expect(endExclusive.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    });
  });

  describe('Australia/Sydney', () => {
    const tz = 'Australia/Sydney';

    it('startOfOrgLocalDay uses AEDT in January', () => {
      const start = startOfOrgLocalDay(tz, '2026-01-15');
      expect(start.toISOString()).toBe('2026-01-14T13:00:00.000Z');
    });

    it('startOfOrgLocalDay uses AEST after DST ends in April', () => {
      const start = startOfOrgLocalDay(tz, '2026-04-15');
      expect(start.toISOString()).toBe('2026-04-14T14:00:00.000Z');
    });

    it('DST end (2026-04-05) yields 25-hour local day', () => {
      const start = startOfOrgLocalDay(tz, '2026-04-05');
      const endExclusive = endExclusiveOfOrgLocalDay(tz, '2026-04-05');
      expect(endExclusive.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    });
  });

  describe('Europe/London', () => {
    const tz = 'Europe/London';

    it('startOfOrgLocalDay uses GMT in January', () => {
      const start = startOfOrgLocalDay(tz, '2026-01-15');
      expect(start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    });

    it('startOfOrgLocalDay uses BST in June', () => {
      const start = startOfOrgLocalDay(tz, '2026-06-01');
      expect(start.toISOString()).toBe('2026-05-31T23:00:00.000Z');
    });

    it('spring-forward day (2026-03-29) is 23 hours long', () => {
      const start = startOfOrgLocalDay(tz, '2026-03-29');
      const endExclusive = endExclusiveOfOrgLocalDay(tz, '2026-03-29');
      expect(endExclusive.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
    });

    it('fall-back day (2026-10-25) is 25 hours long', () => {
      const start = startOfOrgLocalDay(tz, '2026-10-25');
      const endExclusive = endExclusiveOfOrgLocalDay(tz, '2026-10-25');
      expect(endExclusive.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    });
  });

  describe('resolveOrgLocalDigestDay', () => {
    it('accepts YYYY-MM-DD as org-local key', () => {
      const resolved = resolveOrgLocalDigestDay('America/Chicago', '2026-06-01');
      expect(resolved.localDateKey).toBe('2026-06-01');
      expect(resolved.timezone).toBe('America/Chicago');
      expect(resolved.digestDate.toISOString()).toBe('2026-06-01T05:00:00.000Z');
    });

    it('maps ISO instant to org-local day', () => {
      const resolved = resolveOrgLocalDigestDay('America/Los_Angeles', '2026-06-01T06:00:00.000Z');
      expect(resolved.localDateKey).toBe('2026-05-31');
    });

    it('throws on invalid input', () => {
      expect(() => resolveOrgLocalDigestDay('America/New_York', 'not-a-date')).toThrow('Invalid digestDate');
    });
  });

  describe('getPayloadDigestDayStartIso', () => {
    it('prefers digestDayStartIso over legacy digestDateUtc', () => {
      expect(
        getPayloadDigestDayStartIso({
          digestDayStartIso: '2026-06-01T07:00:00.000Z',
          digestDateUtc: '2026-06-01T00:00:00.000Z',
        })
      ).toBe('2026-06-01T07:00:00.000Z');
    });

    it('falls back to digestDateUtc for legacy payloads', () => {
      expect(getPayloadDigestDayStartIso({ digestDateUtc: '2026-06-01T00:00:00.000Z' })).toBe(
        '2026-06-01T00:00:00.000Z'
      );
    });

    it('returns null when neither field is present', () => {
      expect(getPayloadDigestDayStartIso({})).toBeNull();
      expect(getPayloadDigestDayStartIso(null)).toBeNull();
    });
  });
});
