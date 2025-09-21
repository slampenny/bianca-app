// Centralized OpenAI mock
module.exports = {
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"sentiment": "positive", "confidence": 0.8}' } }]
        })
      }
    }
  }))
};
