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

describe('MessageHandler.handleConversationItem', () => {
  it('does not call save for completed message items even when item.audio.transcript is set (avoids doubleSave with response.done / input_audio_transcription)', async () => {
    const save = jest.fn();
    const dbId = '507f1f77bcf86cd799439011';
    await MessageHandler.handleConversationItem(
      {
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: 'Hello',
        audio: { transcript: 'Hello duplicate' },
      },
      dbId,
      save
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('still invokes save for non-completed message items with audio when callback provided (legacy / partial path)', async () => {
    const save = jest.fn();
    const dbId = '507f1f77bcf86cd799439011';
    await MessageHandler.handleConversationItem(
      {
        type: 'message',
        status: 'incomplete',
        role: 'assistant',
        audio: { transcript: 'Partial' },
      },
      dbId,
      save
    );
    expect(save).toHaveBeenCalledTimes(1);
  });
});
