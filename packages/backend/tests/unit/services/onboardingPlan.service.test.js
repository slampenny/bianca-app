const {
  resolvePlanFromOrgSettings,
  getQuestionIdsForDay,
  isValidOnboardingDay,
  assertValidVoiceOnboardingConfig,
  getDefaultPlanTemplate,
} = require('../../../src/services/onboardingPlan.service');

describe('onboardingPlan.service', () => {
  it('returns default 5-day plan (Day 0–4) when useDefault is true', () => {
    const plan = resolvePlanFromOrgSettings({ useDefault: true });
    expect(plan.useDefault).toBe(true);
    expect(plan.totalDays).toBe(5);
    expect(plan.days.map((d) => d.dayNumber)).toEqual([0, 1, 2, 3, 4]);
    expect(plan.days[0].questions).toHaveLength(4);
    expect(plan.days[0].questions.map((q) => q.id)).toEqual([
      'day0_name_pref',
      'day0_interests',
      'day0_daily_life',
      'day0_language_comfort',
    ]);
    expect(plan.days[1].questions).toHaveLength(6);
    expect(isValidOnboardingDay(plan, 0)).toBe(true);
    expect(getQuestionIdsForDay(plan, 0)).toHaveLength(4);
  });

  it('preserves explicit custom day numbers (including gaps)', () => {
    const plan = resolvePlanFromOrgSettings({
      useDefault: false,
      days: [
        {
          dayNumber: 2,
          theme: 'Routine only',
          questions: [{ id: 'custom_q1', prompt: 'Morning routine?' }],
        },
        {
          dayNumber: 5,
          theme: 'Extra day',
          questions: [
            { id: 'custom_q2', prompt: 'Food prefs?' },
            { id: 'custom_q3', prompt: 'Hobbies?' },
          ],
        },
      ],
    });
    expect(plan.useDefault).toBe(false);
    expect(plan.totalDays).toBe(2);
    expect(plan.days[0].dayNumber).toBe(2);
    expect(plan.days[1].dayNumber).toBe(5);
    expect(getQuestionIdsForDay(plan, 2)).toEqual(['custom_q1']);
    expect(isValidOnboardingDay(plan, 5)).toBe(true);
    expect(isValidOnboardingDay(plan, 3)).toBe(false);
  });

  it('allows empty custom plan to disable onboarding', () => {
    const plan = resolvePlanFromOrgSettings({ useDefault: false, days: [] });
    expect(plan.useDefault).toBe(false);
    expect(plan.totalDays).toBe(0);
    expect(() => assertValidVoiceOnboardingConfig({ useDefault: false, days: [] })).not.toThrow();
  });

  it('rejects duplicate question ids in custom plan', () => {
    expect(() =>
      assertValidVoiceOnboardingConfig({
        useDefault: false,
        days: [
          {
            questions: [
              { id: 'dup', prompt: 'One' },
              { id: 'dup', prompt: 'Two' },
            ],
          },
        ],
      })
    ).toThrow(/Duplicate question id/);
  });

  it('exports default template for admin', () => {
    const template = getDefaultPlanTemplate();
    expect(template.totalDays).toBe(5);
    expect(template.days.every((d) => d.questions.length > 0)).toBe(true);
  });
});
