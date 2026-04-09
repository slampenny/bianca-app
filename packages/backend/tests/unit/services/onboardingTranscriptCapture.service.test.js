const {
  extractClientAnswerBlocks,
} = require('../../../src/services/onboardingTranscriptCapture.service');

describe('onboardingTranscriptCapture.service', () => {
  describe('extractClientAnswerBlocks', () => {
    it('flushes each client run when the next assistant message appears', () => {
      const messages = [
        { role: 'assistant', content: 'Hi, how are you?' },
        { role: 'client', content: 'Doing well thanks.' },
        { role: 'assistant', content: 'Glad to hear. Where are you today?' },
        { role: 'client', content: 'At home.' },
      ];
      expect(extractClientAnswerBlocks(messages)).toEqual(['Doing well thanks.', 'At home.']);
    });

    it('merges consecutive client fragments before assistant', () => {
      const messages = [
        { role: 'assistant', content: 'Question one?' },
        { role: 'client', content: 'First part' },
        { role: 'client', content: 'second part' },
        { role: 'assistant', content: 'Thanks.' },
      ];
      expect(extractClientAnswerBlocks(messages)).toEqual(['First part second part']);
    });

    it('captures trailing client message without following assistant', () => {
      const messages = [
        { role: 'assistant', content: 'Bye?' },
        { role: 'client', content: 'Goodbye' },
      ];
      expect(extractClientAnswerBlocks(messages)).toEqual(['Goodbye']);
    });

    it('skips [Speaking...] and empty client lines', () => {
      const messages = [
        { role: 'assistant', content: 'Hi' },
        { role: 'client', content: '[Speaking...]' },
        { role: 'client', content: '   ' },
        { role: 'client', content: 'Real answer' },
        { role: 'assistant', content: 'Ok' },
      ];
      expect(extractClientAnswerBlocks(messages)).toEqual(['Real answer']);
    });

    it('ignores debug-user', () => {
      const messages = [
        { role: 'assistant', content: 'Hi' },
        { role: 'debug-user', content: 'should ignore' },
        { role: 'client', content: 'From resident' },
        { role: 'assistant', content: 'Next' },
      ];
      expect(extractClientAnswerBlocks(messages)).toEqual(['From resident']);
    });
  });
});
