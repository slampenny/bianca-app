const {
  lintVoiceOnboardingPrivacy,
  getPrivacyLintMode,
  getPrivacyLintModeForRole,
} = require('../../../src/services/voiceOnboardingPrivacyLint.service');
const { buildCustomOnboardingInstructions } = require('../../../src/templates/onboardingPrompts');
const {
  resolvePlanFromOrgSettings,
  getFacilityTypePreset,
  FACILITY_TYPES,
} = require('../../../src/services/onboardingPlan.service');

describe('voiceOnboardingPrivacyLint', () => {
  it('flags conflicting opening / question phrases', () => {
    const warnings = lintVoiceOnboardingPrivacy({
      useDefault: false,
      days: [
        {
          dayNumber: 1,
          opening: 'Hi — we will tell your family how you are doing.',
          questions: [{ id: 'q1', prompt: 'Anything your care team will know about?' }],
        },
      ],
    });
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(warnings.some((w) => w.id === 'tell_family')).toBe(true);
    expect(warnings.some((w) => w.id === 'care_team_will_know')).toBe(true);
  });

  it('skips lint when using default plan', () => {
    expect(lintVoiceOnboardingPrivacy({ useDefault: true, days: [] })).toEqual([]);
  });

  it('defaults lint mode to warn', () => {
    delete process.env.VOICE_ONBOARDING_PRIVACY_LINT_MODE;
    expect(getPrivacyLintMode()).toBe('warn');
  });

  it('blocks orgAdmin regardless of env warn default', () => {
    delete process.env.VOICE_ONBOARDING_PRIVACY_LINT_MODE;
    expect(getPrivacyLintModeForRole('orgAdmin')).toBe('block');
  });

  it('warns for superAdmin by default', () => {
    delete process.env.VOICE_ONBOARDING_PRIVACY_LINT_MODE;
    expect(getPrivacyLintModeForRole('superAdmin')).toBe('warn');
  });
});

describe('buildCustomOnboardingInstructions privacy restatement', () => {
  it('includes exclusivity and caregiver negative lines', () => {
    const text = buildCustomOnboardingInstructions(
      {
        dayNumber: 1,
        theme: 'Custom',
        opening: 'Hi there',
        questions: [{ id: 'q1', prompt: 'How are you?' }],
      },
      1,
      { residentName: 'Pat', facilityName: 'Home', lastDayNumber: 1 }
    );
    expect(text).toMatch(/PRIVACY \(restate/i);
    expect(text).toMatch(/just between the two of you/i);
    expect(text).toMatch(/Never reference a caregiver/i);
  });
});

describe('facility-type plan resolution (inert presets)', () => {
  it('lists supported facility types', () => {
    expect(FACILITY_TYPES).toEqual(['assisted_living', 'skilled_nursing', 'home_care', 'other']);
  });

  it('returns null preset for every facility type until content exists', () => {
    for (const t of FACILITY_TYPES) {
      expect(getFacilityTypePreset(t)).toBeNull();
    }
  });

  it('resolves to global default when facility type set but no preset', () => {
    const plan = resolvePlanFromOrgSettings({ useDefault: true }, { facilityType: 'assisted_living' });
    expect(plan.totalDays).toBe(5);
    expect(plan.days.map((d) => d.dayNumber)).toEqual([0, 1, 2, 3, 4]);
    expect(plan.days[0].questions[0].id).toBe('day0_name_pref');
  });

  it('prefers org custom over facility type', () => {
    const plan = resolvePlanFromOrgSettings(
      {
        useDefault: false,
        days: [{ dayNumber: 0, questions: [{ id: 'custom_only', prompt: 'Hello?' }] }],
      },
      { facilityType: 'skilled_nursing' }
    );
    expect(plan.useDefault).toBe(false);
    expect(plan.totalDays).toBe(1);
    expect(plan.days[0].questions[0].id).toBe('custom_only');
  });
});
