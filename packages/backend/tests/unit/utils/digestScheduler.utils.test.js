const {
  isWithinOrgLocalSendWindow,
  orgLocalDateKeyForInstant,
} = require('../../../src/utils/digestScheduler.utils');

describe('digestScheduler.utils send window', () => {
  const tz = 'America/Los_Angeles';
  const sendTime = '18:00';
  const windowMinutes = 15;

  it('is outside window before send time', () => {
    const before = new Date('2026-06-01T17:00:00.000Z'); // 10:00 Pacific
    expect(isWithinOrgLocalSendWindow({ orgTimezone: tz, sendTime, now: before, windowMinutes })).toBe(false);
  });

  it('is inside window at send time', () => {
    const inside = new Date('2026-06-02T01:05:00.000Z'); // 18:05 Pacific
    expect(isWithinOrgLocalSendWindow({ orgTimezone: tz, sendTime, now: inside, windowMinutes })).toBe(true);
  });

  it('is outside window after send time', () => {
    const after = new Date('2026-06-02T02:00:00.000Z'); // 19:00 Pacific
    expect(isWithinOrgLocalSendWindow({ orgTimezone: tz, sendTime, now: after, windowMinutes })).toBe(false);
  });

  it('maps DST spring-forward local date key', () => {
    const dstInstant = new Date('2026-03-09T01:05:00.000Z');
    expect(orgLocalDateKeyForInstant(tz, dstInstant)).toBe('2026-03-08');
  });
});
