const {
  startOfUtcMonth,
  complianceLabelFromConsentRate,
} = require('../../../src/services/facilityReports.service');

describe('facilityReports summary helpers', () => {
  test('startOfUtcMonth returns first day UTC midnight', () => {
    const d = new Date('2026-03-15T14:30:00.000Z');
    const start = startOfUtcMonth(d);
    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(2);
    expect(start.getUTCDate()).toBe(1);
    expect(start.getUTCHours()).toBe(0);
  });

  test('compliance labels by consent rate', () => {
    expect(complianceLabelFromConsentRate(0.95)).toBe('Strong');
    expect(complianceLabelFromConsentRate(0.8)).toBe('Moderate');
    expect(complianceLabelFromConsentRate(0.5)).toBe('Needs attention');
  });
});
