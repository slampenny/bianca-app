const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../../../src/utils/openaiSdk', () => ({
  getOpenAIConstructor: jest.fn(),
}));

const { getOpenAIConstructor } = require('../../../src/utils/openaiSdk');
const {
  assertValidRequiredCallQuestionsConfig,
  normalizeOrgConfig,
  pickAnswersForDigest,
  formatAnswersPlain,
  buildPromptSection,
  getQuestionsForClient,
  extractAnswersFromTranscript,
  captureFromConversation,
} = require('../../../src/services/requiredCallQuestions.service');
const { Org, Client, Conversation, Message } = require('../../../src/models');

describe('requiredCallQuestions.service', () => {
  describe('assertValidRequiredCallQuestionsConfig', () => {
    it('accepts disabled config with no questions', () => {
      expect(() =>
        assertValidRequiredCallQuestionsConfig({ enabled: false, questions: [] })
      ).not.toThrow();
    });

    it('rejects enabled config without questions', () => {
      expect(() => assertValidRequiredCallQuestionsConfig({ enabled: true, questions: [] })).toThrow(
        /at least one question/
      );
    });

    it('rejects duplicate question ids', () => {
      expect(() =>
        assertValidRequiredCallQuestionsConfig({
          enabled: true,
          questions: [
            { id: 'med', prompt: 'Taken meds?' },
            { id: 'med', prompt: 'Again?' },
          ],
        })
      ).toThrow(/Duplicate/);
    });

    it('rejects invalid question id characters', () => {
      expect(() =>
        assertValidRequiredCallQuestionsConfig({
          enabled: true,
          questions: [{ id: 'bad id!', prompt: 'Valid prompt here' }],
        })
      ).toThrow(/unique id/);
    });
  });

  describe('normalizeOrgConfig', () => {
    it('disables when no questions', () => {
      const result = normalizeOrgConfig({ enabled: true, questions: [] });
      expect(result.enabled).toBe(false);
      expect(result.questions).toEqual([]);
    });

    it('filters empty prompts', () => {
      const result = normalizeOrgConfig({
        enabled: true,
        questions: [
          { id: 'med', prompt: 'Taken meds?' },
          { id: 'empty', prompt: '   ' },
        ],
      });
      expect(result.enabled).toBe(true);
      expect(result.questions).toHaveLength(1);
    });
  });

  describe('pickAnswersForDigest', () => {
    it('maps analyzedData to digest rows', () => {
      const rows = pickAnswersForDigest({
        requiredQuestions: {
          answers: [
            { questionId: 'med', prompt: 'Meds?', answer: 'Yes', asked: true },
            { questionId: 'sleep', prompt: 'Sleep?', answer: null, asked: true },
          ],
        },
      });
      expect(rows).toHaveLength(2);
      expect(rows[0].answer).toBe('Yes');
      expect(rows[1].answer).toBe('');
    });
  });

  describe('formatAnswersPlain', () => {
    it('formats question answer pairs', () => {
      const text = formatAnswersPlain([
        { question: 'Meds?', answer: 'Yes' },
        { question: 'Sleep?', answer: '' },
      ]);
      expect(text).toContain('Meds?: Yes');
      expect(text).toContain('Sleep?: (not answered)');
    });
  });

  describe('buildPromptSection', () => {
    it('returns empty string when no questions', () => {
      expect(buildPromptSection([], 'Facility')).toBe('');
    });

    it('returns instructions block for configured questions', () => {
      const section = buildPromptSection([{ id: 'med', prompt: 'Taken your meds?' }], 'Test Facility');
      expect(section).toContain('REQUIRED CHECK-IN QUESTIONS');
      expect(section).toContain('med — Taken your meds?');
      expect(section).toContain("I'd like to check in on with you");
      // Facility name arg is unused — must not attribute questions to staff/facility
      expect(section).not.toContain('Test Facility');
      expect(section).not.toMatch(/care team/i);
    });
  });
});

describe('requiredCallQuestions.service (database)', () => {
  let mongoServer;
  let org;
  let client;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await Client.deleteMany({});
    await Org.deleteMany({});

    org = await Org.create({
      name: 'Acme Care',
      email: 'acme@test.com',
      country: 'US',
      requiredCallQuestions: {
        enabled: true,
        questions: [{ id: 'med', prompt: 'Have you taken your medication today?' }],
      },
    });
    client = await Client.create({
      name: 'Resident',
      email: 'resident@test.com',
      phone: '+16045624263',
      org: org._id,
    });
  });

  it('getQuestionsForClient returns org config and facility name', async () => {
    const result = await getQuestionsForClient(client._id);
    expect(result.enabled).toBe(true);
    expect(result.questions).toEqual([
      { id: 'med', prompt: 'Have you taken your medication today?' },
    ]);
    expect(result.facilityName).toBe('Acme Care');
  });

  it('getQuestionsForClient returns disabled when org has no required questions', async () => {
    await Org.findByIdAndUpdate(org._id, {
      requiredCallQuestions: { enabled: false, questions: [] },
    });
    const result = await getQuestionsForClient(client._id);
    expect(result.enabled).toBe(false);
    expect(result.questions).toEqual([]);
  });

  describe('extractAnswersFromTranscript', () => {
    beforeEach(() => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '[{"questionId":"med","answer":"Yes, I took them this morning","asked":true}]',
            },
          },
        ],
      });
      getOpenAIConstructor.mockReturnValue(
        jest.fn().mockImplementation(() => ({
          chat: { completions: { create: mockCreate } },
        }))
      );
    });

    it('parses LLM JSON into answer rows', async () => {
      const answers = await extractAnswersFromTranscript(
        'Bianca: Have you taken your medication?\nResident: Yes, this morning.',
        [{ id: 'med', prompt: 'Have you taken your medication today?' }]
      );
      expect(answers).toHaveLength(1);
      expect(answers[0].questionId).toBe('med');
      expect(answers[0].answer).toContain('morning');
      expect(answers[0].asked).toBe(true);
    });

    it('returns unanswered rows when transcript is empty', async () => {
      getOpenAIConstructor.mockClear();
      const answers = await extractAnswersFromTranscript('No conversation content recorded.', [
        { id: 'med', prompt: 'Meds?' },
      ]);
      expect(answers[0].answer).toBeNull();
      expect(answers[0].asked).toBe(false);
      expect(getOpenAIConstructor).not.toHaveBeenCalled();
    });
  });

  describe('captureFromConversation', () => {
    it('persists extracted answers on the conversation', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '[{"questionId":"med","answer":"Yes","asked":true}]',
            },
          },
        ],
      });
      getOpenAIConstructor.mockReturnValue(
        jest.fn().mockImplementation(() => ({
          chat: { completions: { create: mockCreate } },
        }))
      );

      const conversation = await Conversation.create({
        clientId: client._id,
        callId: new mongoose.Types.ObjectId(),
        summary: 'Brief check-in',
      });
      await Message.create({
        conversationId: conversation._id,
        role: 'assistant',
        content: 'Have you taken your medication today?',
      });
      await Message.create({
        conversationId: conversation._id,
        role: 'client',
        content: 'Yes, I did.',
      });

      const result = await captureFromConversation({
        conversationId: conversation._id.toString(),
        clientId: client._id,
      });

      expect(result.skipped).toBe(false);
      expect(result.recorded).toBe(1);

      const reloaded = await Conversation.findById(conversation._id).lean();
      expect(reloaded.analyzedData.requiredQuestions.answers[0].answer).toBe('Yes');
      expect(reloaded.analyzedData.requiredQuestions.capturedAt).toBeTruthy();
    });

    it('skips when org has required questions disabled', async () => {
      await Org.findByIdAndUpdate(org._id, {
        requiredCallQuestions: { enabled: false, questions: [] },
      });
      const conversation = await Conversation.create({
        clientId: client._id,
        callId: new mongoose.Types.ObjectId(),
      });

      const result = await captureFromConversation({
        conversationId: conversation._id.toString(),
        clientId: client._id,
      });
      expect(result.skipped).toBe(true);
      expect(result.recorded).toBe(0);
    });
  });
});
