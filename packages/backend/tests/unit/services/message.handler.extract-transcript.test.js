const MessageHandler = require('../../../src/services/ai/realtime/message.handler');

describe('MessageHandler.extractUserInputTranscript', () => {
  it('uses top-level transcript when present', () => {
    expect(
      MessageHandler.extractUserInputTranscript({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: '  Hello world  ',
      })
    ).toBe('Hello world');
  });

  it('falls back to nested item.input_audio_transcription.transcript', () => {
    expect(
      MessageHandler.extractUserInputTranscript({
        type: 'conversation.item.input_audio_transcription.completed',
        item: {
          input_audio_transcription: { transcript: 'Nested text' },
        },
      })
    ).toBe('Nested text');
  });

  it('returns empty string when missing', () => {
    expect(MessageHandler.extractUserInputTranscript({})).toBe('');
    expect(MessageHandler.extractUserInputTranscript(null)).toBe('');
  });
});
