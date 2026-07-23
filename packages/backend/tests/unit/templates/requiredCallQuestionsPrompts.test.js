const {
  buildRequiredQuestionsInstructions,
  MEDICATION_BOUNDARY,
} = require('../../../src/templates/requiredCallQuestionsPrompts');

describe('requiredCallQuestionsPrompts', () => {
  it('includes medication boundary and question prompts without care-team sourcing', () => {
    const text = buildRequiredQuestionsInstructions(
      [{ id: 'med', prompt: 'Have you taken your medication today?' }],
      'Sunrise Care'
    );
    expect(text).toContain(MEDICATION_BOUNDARY);
    expect(text).toContain('med — Have you taken your medication today?');
    expect(text).toContain("I have a few questions I'd like to check in on with you");
    expect(text).toContain('REQUIRED CHECK-IN QUESTIONS');
    expect(text).not.toContain('care team');
    expect(text).not.toContain('Sunrise Care');
    expect(text).not.toMatch(/has asked me to check/i);
    expect(text).toContain('pleasantries');
  });

  it('does not fall back to care team when facility name is empty', () => {
    const text = buildRequiredQuestionsInstructions([{ id: 'sleep', prompt: 'How did you sleep?' }], '');
    expect(text).not.toContain('your care team');
    expect(text).toContain("I'd like to check in on with you");
  });
});
