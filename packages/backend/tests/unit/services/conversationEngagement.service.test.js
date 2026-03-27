const {
  computeConversationEngagementMetrics,
  hasQuestionSignal,
  hasCallbackSignal,
  hasInvitationSignal,
  isLikelyClosingStatement,
} = require('../../../src/services/conversationEngagement.service');

describe('conversationEngagement.service', () => {
  describe('hasQuestionSignal', () => {
    it('detects question mark', () => {
      expect(hasQuestionSignal('How are you today?')).toBe(true);
    });

    it('detects invitation phrases without ?', () => {
      expect(hasQuestionSignal('Anything else on your mind today')).toBe(true);
    });
  });

  describe('hasCallbackSignal', () => {
    it('detects acknowledgment phrases', () => {
      expect(hasCallbackSignal('That sounds really tough.', 'My knee has been hurting.')).toBe(true);
    });

    it('detects overlap with previous user content', () => {
      expect(
        hasCallbackSignal('I am glad your daughter visited.', 'My daughter Sarah came by yesterday.')
      ).toBe(true);
    });

    it('does not treat stem overlap as callback (lonely vs loneliness)', () => {
      expect(
        hasCallbackSignal('Loneliness is difficult.', 'I have been feeling lonely since my friend moved.')
      ).toBe(false);
    });

    it('returns false without previous user content', () => {
      expect(hasCallbackSignal('Okay.', '')).toBe(false);
    });
  });

  describe('hasInvitationSignal', () => {
    it('includes questions', () => {
      expect(hasInvitationSignal('What would you like to talk about?')).toBe(true);
    });

    it('detects standalone invitation phrase', () => {
      expect(hasInvitationSignal("I'd love to hear more when you're ready.")).toBe(true);
    });
  });

  describe('isLikelyClosingStatement', () => {
    it('detects goodbye style lines', () => {
      expect(isLikelyClosingStatement('It was nice talking — take care!')).toBe(true);
    });

    it('returns false for mid-call content', () => {
      expect(isLikelyClosingStatement('How has your sleep been lately?')).toBe(false);
    });
  });

  describe('computeConversationEngagementMetrics', () => {
    it('returns null for empty messages', () => {
      expect(computeConversationEngagementMetrics([])).toBe(null);
    });

    it('flags last turn dead-end when flat statement after user content', () => {
      const metrics = computeConversationEngagementMetrics([
        { role: 'assistant', content: 'This is Bianca.' },
        { role: 'client', content: 'I have been worried about my garden since the frost.' },
        { role: 'assistant', content: 'Weather can be unpredictable.' },
      ]);
      expect(metrics.lastTurnDeadEnd).toBe(true);
      expect(metrics.lastTurnIsClosing).toBe(false);
      expect(metrics.deadEndTurnsAfterClient).toBe(1);
      expect(metrics.turnsAfterClient).toBe(1);
    });

    it('does not flag when last turn has a question', () => {
      const metrics = computeConversationEngagementMetrics([
        { role: 'client', content: 'I slept badly.' },
        { role: 'assistant', content: "I'm sorry to hear that. Was it pain or something else?"},
      ]);
      expect(metrics.lastTurnDeadEnd).toBe(false);
      expect(metrics.deadEndTurnsAfterClient).toBe(0);
    });

    it('does not flag closing statements as dead-end', () => {
      const metrics = computeConversationEngagementMetrics([
        { role: 'client', content: 'I need to go now.' },
        { role: 'assistant', content: 'It was great talking with you — take care and talk soon.' },
      ]);
      expect(metrics.lastTurnDeadEnd).toBe(false);
      expect(metrics.lastTurnIsClosing).toBe(true);
    });

    it('counts dead-end rate across multiple client-assistant pairs', () => {
      const metrics = computeConversationEngagementMetrics([
        { role: 'client', content: 'Hello.' },
        { role: 'assistant', content: 'Hi there — how are you feeling today?'},
        { role: 'client', content: 'Tired.' },
        { role: 'assistant', content: 'Rest is important.' },
      ]);
      expect(metrics.turnsAfterClient).toBe(2);
      expect(metrics.deadEndTurnsAfterClient).toBe(1);
      expect(metrics.deadEndRateAfterClient).toBe(0.5);
    });
  });
});
