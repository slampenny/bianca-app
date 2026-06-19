const {
  buildRequiredQuestionsInstructions,
  MEDICATION_BOUNDARY,
} = require('../../../src/templates/requiredCallQuestionsPrompts');

describe('requiredCallQuestionsPrompts', () => {
  it('includes medication boundary and question prompts', () => {
    const text = buildRequiredQuestionsInstructions(
      [{ id: 'med', prompt: 'Have you taken your medication today?' }],
      'Sunrise Care'
    );
    expect(text).toContain(MEDICATION_BOUNDARY);
    expect(text).toContain('med — Have you taken your medication today?');
    expect(text).toContain('Sunrise Care');
    expect(text).toContain('pleasantries');
  });

  it('uses care team fallback when facility name is empty', () => {
    const text = buildRequiredQuestionsInstructions([{ id: 'sleep', prompt: 'How did you sleep?' }], '');
    expect(text).toContain('your care team');
  });
});
