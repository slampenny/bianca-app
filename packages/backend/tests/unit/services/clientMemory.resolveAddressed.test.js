const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const mockCreate = jest.fn();

jest.mock('../../../src/utils/openaiSdk', () => ({
  getOpenAIConstructor: jest.fn(() =>
    jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }))
  ),
}));

const { ClientMemory } = require('../../../src/models/clientMemory.model');
const clientMemoryService = require('../../../src/services/clientMemory.service');
const {
  buildNormalizedKey,
  getDefaultDecayPolicy,
} = require('../../../src/utils/clientMemory.scoring');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('resolveAddressedFacts follow-up lifecycle', () => {
  const clientId = new mongoose.Types.ObjectId();
  const priorConversationId = new mongoose.Types.ObjectId();
  const conversationId = new mongoose.Types.ObjectId();
  const recent = new Date();

  afterEach(async () => {
    await ClientMemory.deleteMany({});
    mockCreate.mockReset();
  });

  const createOpenFollowUp = async (overrides = {}) => {
    const factText = overrides.fact || 'Worried about upcoming knee surgery next Tuesday';
    const category = overrides.category || 'concern';
    const priority = overrides.priority || 'normal';
    return ClientMemory.create({
      clientId,
      conversationId: priorConversationId,
      fact: factText,
      category,
      confidence: 'high',
      priority,
      source: overrides.source || 'post_call_extraction',
      extractedAt: recent,
      status: 'active',
      followUpStatus: overrides.followUpStatus,
      confidenceScore: 0.85,
      reinforcementCount: 3,
      firstObservedAt: recent,
      lastObservedAt: recent,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      normalizedKey: buildNormalizedKey(category, factText),
      sensitivity: priority === 'urgent' ? 'high' : 'normal',
      decayPolicy: getDefaultDecayPolicy(category, priority === 'urgent' ? 'high' : 'normal'),
      ...overrides,
      fact: factText,
      category,
      priority,
    });
  };

  it('marks discussed_resolved facts addressed and appends a resolution fact', async () => {
    const openFact = await createOpenFollowUp();

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                factIndex: 1,
                classification: 'discussed_resolved',
                resolutionFact: 'Knee surgery went well, recovering at home',
              },
            ]),
          },
        },
      ],
    });

    const result = await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Bianca: How did the surgery go?\nClient: It went fine, I am home recovering.',
      { skipConsentCheck: true }
    );

    expect(result.addressed).toBe(1);
    expect(result.resolutionFactsStored).toBeGreaterThanOrEqual(1);

    const updated = await ClientMemory.findById(openFact._id).lean();
    expect(updated.followUpStatus).toBe('addressed');
    expect(updated.addressedAt).toBeInstanceOf(Date);
    expect(String(updated.addressedByConversationId)).toBe(String(conversationId));
    expect(updated.fact).toBe('Worried about upcoming knee surgery next Tuesday');

    const resolution = await ClientMemory.findOne({
      clientId,
      fact: 'Knee surgery went well, recovering at home',
    }).lean();
    expect(resolution).toBeTruthy();
    expect(resolution.category).toBe('concern');
    expect(resolution.priority).toBe('normal');
    expect(resolution.status).toBe('active');
    expect(resolution.followUpStatus).toBe('addressed');
  });

  it('leaves discussed_ongoing facts open', async () => {
    const openFact = await createOpenFollowUp({
      fact: 'Still waiting on results from the heart specialist',
      category: 'concern',
    });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([{ factIndex: 1, classification: 'discussed_ongoing' }]),
          },
        },
      ],
    });

    await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Bianca: Any news from the specialist?\nClient: Still waiting.',
      { skipConsentCheck: true }
    );

    const updated = await ClientMemory.findById(openFact._id).lean();
    expect(updated.followUpStatus).toBe('open');
    expect(updated.addressedAt).toBeNull();
  });

  it('leaves not_discussed facts open', async () => {
    const openFact = await createOpenFollowUp({
      fact: 'Mentioned loneliness after daughter moved away',
      category: 'concern',
    });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([{ factIndex: 1, classification: 'not_discussed' }]),
          },
        },
      ],
    });

    await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Bianca: How is the weather?\nClient: Lovely today.',
      { skipConsentCheck: true }
    );

    const updated = await ClientMemory.findById(openFact._id).lean();
    expect(updated.followUpStatus).toBe('open');
    expect(updated.addressedAt).toBeNull();
  });

  it('treats legacy facts with no followUpStatus field as open', async () => {
    const legacy = await createOpenFollowUp({
      fact: 'Anxious about moving rooms next month',
      category: 'concern',
    });
    await ClientMemory.collection.updateOne({ _id: legacy._id }, { $unset: { followUpStatus: '' } });

    const reloaded = await ClientMemory.findById(legacy._id).lean();
    expect(reloaded.followUpStatus).toBeUndefined();

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                factIndex: 1,
                classification: 'discussed_resolved',
                resolutionFact: 'Settled into the new room and feeling comfortable',
              },
            ]),
          },
        },
      ],
    });

    const result = await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Client: The move went well, I like the new room.',
      { skipConsentCheck: true }
    );

    expect(result.addressed).toBe(1);
    const updated = await ClientMemory.findById(legacy._id).lean();
    expect(updated.followUpStatus).toBe('addressed');
  });

  it('excludes addressed facts from urgent/concern prompt tiers but keeps them in warmth', async () => {
    await createOpenFollowUp({
      fact: 'Reported a fall last week',
      category: 'safety',
      priority: 'urgent',
      followUpStatus: 'addressed',
      addressedAt: recent,
      addressedByConversationId: priorConversationId,
    });
    await createOpenFollowUp({
      fact: 'Worried about daughter not visiting',
      category: 'concern',
      priority: 'normal',
      followUpStatus: 'addressed',
      addressedAt: recent,
      addressedByConversationId: priorConversationId,
    });
    await createOpenFollowUp({
      fact: 'Still waiting on cardiology results',
      category: 'concern',
      priority: 'normal',
      followUpStatus: 'open',
    });
    await createOpenFollowUp({
      fact: 'Prefers to be called Rose',
      category: 'preference',
      priority: 'normal',
      followUpStatus: 'open',
    });

    const facts = await clientMemoryService.getClientFacts(clientId);
    expect(facts.length).toBeGreaterThanOrEqual(3);

    const block = clientMemoryService.formatFactsForPrompt(facts, 'Rose');
    expect(block).not.toContain('IMPORTANT — follow up on these from previous calls:');
    expect(block).toContain('Things to gently ask about');
    const concernSection = block.slice(
      block.indexOf('Things to gently ask about'),
      block.indexOf('What we know about Rose:')
    );
    expect(concernSection).toContain('Still waiting on cardiology results');
    expect(concernSection).not.toContain('Worried about daughter not visiting');
    expect(concernSection).not.toContain('Reported a fall last week');
    const warmthSection = block.slice(block.indexOf('What we know about Rose:'));
    expect(warmthSection).toContain('Ordered most-recent first');
    expect(warmthSection).toContain('Reported a fall last week');
    expect(warmthSection).toContain('Worried about daughter not visiting');
    expect(warmthSection).toContain('Prefers to be called Rose');
  });

  it('treats missing followUpStatus as open in prompt tiers', async () => {
    const legacyUrgent = await createOpenFollowUp({
      fact: 'Safety signal observed during call; care team was alerted.',
      category: 'safety',
      priority: 'urgent',
    });
    await ClientMemory.collection.updateOne({ _id: legacyUrgent._id }, { $unset: { followUpStatus: '' } });

    const facts = await clientMemoryService.getClientFacts(clientId);
    const block = clientMemoryService.formatFactsForPrompt(facts, 'Rose');
    expect(block).toContain('IMPORTANT — follow up on these from previous calls:');
    expect(block).toContain('Safety signal observed');
  });

  it('leaves all facts untouched on malformed JSON and does not throw', async () => {
    const openFact = await createOpenFollowUp();

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not-json{{{' } }],
    });

    await expect(
      clientMemoryService.resolveAddressedFacts(
        clientId,
        conversationId,
        'Client: Surgery went great.',
        { skipConsentCheck: true }
      )
    ).resolves.toEqual({ skipped: true, reason: 'parse_error' });

    const updated = await ClientMemory.findById(openFact._id).lean();
    expect(updated.followUpStatus).toBe('open');
    expect(updated.addressedAt).toBeNull();
  });

  it('leaves all facts untouched on LLM failure and does not throw', async () => {
    const openFact = await createOpenFollowUp();

    mockCreate.mockRejectedValue(new Error('openai down'));

    await expect(
      clientMemoryService.resolveAddressedFacts(
        clientId,
        conversationId,
        'Client: Surgery went great.',
        { skipConsentCheck: true }
      )
    ).resolves.toEqual({ skipped: true, reason: 'error' });

    const updated = await ClientMemory.findById(openFact._id).lean();
    expect(updated.followUpStatus).toBe('open');
    expect(await ClientMemory.countDocuments({ clientId })).toBe(1);
  });

  it('skips LLM call when there are no open urgent/concern facts', async () => {
    await createOpenFollowUp({
      fact: 'Prefers tea over coffee',
      category: 'preference',
      priority: 'normal',
    });

    const result = await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Client: Hello',
      { skipConsentCheck: true }
    );

    expect(result).toEqual({ skipped: true, reason: 'no_open_follow_ups' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('requires discussed_resolved to close mid_call_emergency facts (mention alone does not)', async () => {
    const emergency = await createOpenFollowUp({
      fact: 'Safety signal observed during call; care team was alerted. Follow up on resident wellbeing.',
      category: 'safety',
      priority: 'urgent',
      source: 'mid_call_emergency',
      conversationId,
    });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([{ factIndex: 1, classification: 'discussed_ongoing' }]),
          },
        },
      ],
    });

    await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Client: I had a scare earlier but I am okay now... wait still feeling uneasy.',
      { skipConsentCheck: true }
    );

    const updated = await ClientMemory.findById(emergency._id).lean();
    expect(updated.followUpStatus).toBe('open');
  });

  it('excludes archived + open follow-ups from prompt directives', async () => {
    await createOpenFollowUp({
      fact: 'Archived fall concern that must not resurface',
      category: 'safety',
      priority: 'urgent',
      status: 'archived',
      followUpStatus: 'open',
    });
    await createOpenFollowUp({
      fact: 'Still waiting on cardiology results',
      category: 'concern',
      priority: 'normal',
      followUpStatus: 'open',
    });

    const facts = await clientMemoryService.getClientFacts(clientId);
    expect(facts.map((f) => f.fact)).not.toContain('Archived fall concern that must not resurface');
    expect(facts.map((f) => f.fact)).toContain('Still waiting on cardiology results');

    const block = clientMemoryService.formatFactsForPrompt(facts, 'Rose');
    expect(block).not.toContain('Archived fall concern');
    expect(block).toContain('Still waiting on cardiology results');

    // Defense in depth: even if an archived row were passed directly, format still drops it.
    const leaked = clientMemoryService.formatFactsForPrompt(
      [
        {
          fact: 'Archived fall concern that must not resurface',
          status: 'archived',
          followUpStatus: 'open',
          priority: 'urgent',
          category: 'safety',
        },
      ],
      'Rose'
    );
    expect(leaked).toBe('');
  });

  it('resolution fact is inserted as active (valid for unique partial index)', async () => {
    await createOpenFollowUp();

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                factIndex: 1,
                classification: 'discussed_resolved',
                resolutionFact: 'Knee surgery went well, recovering at home',
              },
            ]),
          },
        },
      ],
    });

    await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Client: Surgery went fine.',
      { skipConsentCheck: true }
    );

    const resolution = await ClientMemory.findOne({
      clientId,
      fact: 'Knee surgery went well, recovering at home',
    }).lean();
    expect(resolution).toBeTruthy();
    expect(resolution.status).toBe('active');
    expect(resolution.followUpStatus).toBe('addressed');
    expect(resolution.normalizedKey).toBe(
      buildNormalizedKey('concern', 'Knee surgery went well, recovering at home')
    );
    expect(resolution.deletedAt).toBeNull();

    // Same key upserts/reinforces rather than violating the unique partial index.
    await expect(
      clientMemoryService.mergeExtractedFacts(clientId, conversationId, [
        {
          fact: 'Knee surgery went well, recovering at home',
          category: 'concern',
          confidence: 'high',
          priority: 'normal',
        },
      ])
    ).resolves.toMatchObject({ reinforced: 1, rejected: 0 });

    expect(
      await ClientMemory.countDocuments({
        clientId,
        normalizedKey: buildNormalizedKey('concern', 'Knee surgery went well, recovering at home'),
      })
    ).toBe(1);
  });

  it('resolution outcome appears in warmth tier on the next call', async () => {
    await createOpenFollowUp({
      fact: 'Worried about upcoming knee surgery next Tuesday',
      category: 'concern',
    });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                factIndex: 1,
                classification: 'discussed_resolved',
                resolutionFact: 'Knee surgery went well, recovering at home',
              },
            ]),
          },
        },
      ],
    });

    await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Bianca: How did the surgery go?\nClient: It went well, I am recovering at home.',
      { skipConsentCheck: true }
    );

    const facts = await clientMemoryService.getClientFacts(clientId);
    const block = clientMemoryService.formatFactsForPrompt(facts, 'Rose');

    expect(block).not.toContain('Things to gently ask about');
    expect(block).toContain('What we know about Rose:');
    expect(block).toContain('Knee surgery went well, recovering at home');
    // Original concern may remain as addressed history, but must not be a follow-up directive.
    const warmth = block.slice(block.indexOf('What we know about Rose:'));
    expect(warmth).toContain('Knee surgery went well, recovering at home');
  });

  it('skips append when extraction already captured the same outcome (different wording)', async () => {
    await createOpenFollowUp();

    await clientMemoryService.mergeExtractedFacts(clientId, conversationId, [
      {
        fact: 'Surgery went fine',
        category: 'concern',
        confidence: 'high',
        priority: 'normal',
      },
    ]);
    const extracted = await ClientMemory.findOne({
      clientId,
      fact: 'Surgery went fine',
    }).lean();
    // High-confidence concern activates on first insert (Option A); reuse still promotes/addresses it.
    expect(extracted.status).toBe('active');
    const countBefore = await ClientMemory.countDocuments({ clientId });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                factIndex: 1,
                classification: 'discussed_resolved',
                matchedExtractionFactId: String(extracted._id),
              },
            ]),
          },
        },
      ],
    });

    const result = await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Bianca: How was surgery?\nClient: Surgery went fine.',
      { skipConsentCheck: true }
    );

    expect(result.resolutionFactsReused).toBe(1);
    expect(result.resolutionFactsStored).toBe(0);
    expect(await ClientMemory.countDocuments({ clientId })).toBe(countBefore);

    const promoted = await ClientMemory.findById(extracted._id).lean();
    expect(promoted.status).toBe('active');
    expect(promoted.followUpStatus).toBe('addressed');
    expect(await ClientMemory.countDocuments({ fact: /knee surgery went well/i })).toBe(0);

    const facts = await clientMemoryService.getClientFacts(clientId);
    const block = clientMemoryService.formatFactsForPrompt(facts, 'Rose');
    expect(block).not.toContain('Things to gently ask about');
    expect(block).toContain('What we know about Rose:');
    expect(block).toContain('Surgery went fine');
  });

  it('still appends an active resolution fact when extraction captured nothing about the topic', async () => {
    await createOpenFollowUp();

    // Unrelated same-call extraction — should not be reused for the surgery resolution.
    await clientMemoryService.mergeExtractedFacts(clientId, conversationId, [
      {
        fact: 'Prefers to sit by the window',
        category: 'preference',
        confidence: 'high',
        priority: 'normal',
      },
    ]);
    const countBefore = await ClientMemory.countDocuments({ clientId });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                factIndex: 1,
                classification: 'discussed_resolved',
                resolutionFact: 'Knee surgery went well, recovering at home',
              },
            ]),
          },
        },
      ],
    });

    const result = await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Bianca: How was surgery?\nClient: It went well, recovering at home.',
      { skipConsentCheck: true }
    );

    expect(result.resolutionFactsStored).toBe(1);
    expect(result.resolutionFactsReused).toBe(0);
    expect(await ClientMemory.countDocuments({ clientId })).toBe(countBefore + 1);

    const resolution = await ClientMemory.findOne({
      clientId,
      fact: 'Knee surgery went well, recovering at home',
    }).lean();
    expect(resolution.status).toBe('active');
    expect(resolution.priority).toBe('normal');
    expect(resolution.followUpStatus).toBe('addressed');

    const facts = await clientMemoryService.getClientFacts(clientId);
    const block = clientMemoryService.formatFactsForPrompt(facts, 'Rose');
    expect(block).toContain('What we know about Rose:');
    expect(block).toContain('Knee surgery went well, recovering at home');
    expect(block).not.toContain('Things to gently ask about');
  });

  it('concern contradictsFactId is ignored so resolve path owns closing (no double handling)', async () => {
    const openConcern = await createOpenFollowUp({
      fact: 'Worried about upcoming knee surgery next Tuesday',
      category: 'concern',
      followUpStatus: 'open',
    });
    const allowlist = new Map([[String(openConcern._id), openConcern.toObject()]]);

    // Extraction claimed a contradiction; open follow-ups must not be conflicted here.
    const mergeResult = await clientMemoryService.mergeExtractedFacts(
      clientId,
      conversationId,
      [
        {
          fact: 'Knee surgery went well, recovering at home',
          category: 'concern',
          confidence: 'high',
          contradictsFactId: String(openConcern._id),
        },
      ],
      { contradictionAllowlist: allowlist }
    );
    expect(mergeResult.conflicted).toBe(0);

    const stillOpen = await ClientMemory.findById(openConcern._id).lean();
    expect(stillOpen.status).toBe('active');
    expect(stillOpen.followUpStatus).toBe('open');

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                factIndex: 1,
                classification: 'discussed_resolved',
                matchedExtractionFactId: String(
                  (
                    await ClientMemory.findOne({
                      clientId,
                      fact: 'Knee surgery went well, recovering at home',
                    }).lean()
                  )._id
                ),
              },
            ]),
          },
        },
      ],
    });

    const resolveResult = await clientMemoryService.resolveAddressedFacts(
      clientId,
      conversationId,
      'Bianca: How was surgery?\nClient: It went well.',
      { skipConsentCheck: true }
    );
    expect(resolveResult.addressed).toBe(1);
    expect(resolveResult.resolutionFactsReused).toBe(1);

    const closed = await ClientMemory.findById(openConcern._id).lean();
    expect(closed.status).toBe('active');
    expect(closed.followUpStatus).toBe('addressed');
    expect(closed.status).not.toBe('conflicted');
  });
});
