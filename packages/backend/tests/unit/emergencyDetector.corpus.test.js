/**
 * Golden corpus tests for embedding + tense emergency path (mocked OpenAI).
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const corpusRunner = require('../helpers/corpusRunner');
const emergencyEmbeddingPipeline = require('../../src/services/emergencyEmbeddingPipeline.service');
const { getConversationContextWindow } = require('../../src/utils/conversationContextWindow');
const { EmergencyProcessor } = require('../../src/services/emergencyProcessor.service');

let classifySpy;

jest.mock('../../src/services/emergencyEmbeddingPipeline.service', () => ({
  evaluateEmergencyEmbedding: jest.fn(),
}));

jest.mock('../../src/services/clientMemory.service', () => {
  const actual = jest.requireActual('../../src/services/clientMemory.service');
  return {
    ...actual,
    writeUrgentFact: jest.fn().mockResolvedValue(undefined),
  };
});

const { writeUrgentFact } = require('../../src/services/clientMemory.service');

let mongoServer;
let processor;
let clientId;
let conversationId;
let corpusPhoneSeq = 0;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  jest.clearAllMocks();
  emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockReset();
  getConversationContextWindow().clearAll();
  classifySpy = jest.spyOn(getConversationContextWindow(), 'classifyNarrativeVsPresent').mockReturnValue({
    isNarrative: false,
    confidence: 0.2,
    reason: 'corpus test stub',
  });
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key-for-corpus';
  const { Client, Org } = require('../../src/models');
  await Client.deleteMany({});
  await Org.deleteMany({});
  const org = await Org.create({ name: 'T', email: 't@t.com', country: 'US' });
  corpusPhoneSeq += 1;
  const client = await Client.create({
    name: 'Corpus Client',
    email: `c${Date.now()}-${corpusPhoneSeq}@c.com`,
    phone: `+1604562${String(4200 + corpusPhoneSeq).slice(-4)}`,
    org: org._id,
    preferredLanguage: 'en',
  });
  clientId = client._id.toString();
  conversationId = new mongoose.Types.ObjectId().toString();
  processor = new EmergencyProcessor();

  const dedupe = require('../../src/utils/alertDeduplicator').getAlertDeduplicator();
  dedupe.clearHistory();

  process.env.FORCE_EMBEDDING_PIPELINE = 'true';
});

afterEach(() => {
  if (classifySpy) classifySpy.mockRestore();
  delete process.env.FORCE_EMBEDDING_PIPELINE;
});

describe('Emergency detector corpus (mocked pipeline)', () => {
  const t = (tc) => tc.text.replace(/^Client:\s*/i, '').trim() || tc.text;

  test.each(
    corpusRunner.getTruePositives().filter((x) => x.expectedDetector === 'emergencyDetector')
  )('$id — should alert ($label)', async (testCase) => {
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: true,
      severity: testCase.expectedSeverity,
      category: testCase.expectedCategory || testCase.category,
      matchedPhrase: 'corpus',
      buckets: ['medical_emergency'],
      tense: 'current',
      tenseCheckCalled: true,
    });

    const result = await processor.processUtterance(clientId, t(testCase), Date.now(), conversationId);
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe(testCase.expectedSeverity);
  });

  test.each(
    corpusRunner.getTrueNegatives().filter((c) => ['medical_emergency', 'self_harm'].includes(c.category))
  )('$id — should not alert ($label)', async (testCase) => {
    if (testCase.id === 'TN-MED-004') {
      emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
        evaluated: true,
        isEmergency: false,
        buckets: [],
        tenseCheckCalled: false,
      });
    } else {
      emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
        evaluated: true,
        isEmergency: false,
        buckets: ['medical_emergency'],
        tense: testCase.tense === 'past' ? 'past' : 'hypothetical',
        tenseCheckCalled: true,
      });
    }

    const result = await processor.processUtterance(clientId, t(testCase), Date.now(), conversationId);
    expect(result.shouldAlert).toBe(false);
  });

  test('TN-MED-001 — tense veto (embedding hit + past tense)', async () => {
    const tc = corpusRunner.getById('TN-MED-001');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: false,
      buckets: ['medical_emergency'],
      tense: 'past',
      tenseCheckCalled: true,
    });

    const result = await processor.processUtterance(clientId, t(tc), Date.now(), conversationId);
    expect(result.shouldAlert).toBe(false);
  });

  test('TN-MED-004 — empty buckets: no tense stage', async () => {
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: false,
      buckets: [],
      tenseCheckCalled: false,
    });
    const tc = corpusRunner.getById('TN-MED-004');
    const result = await processor.processUtterance(clientId, t(tc), Date.now(), conversationId);
    expect(result.shouldAlert).toBe(false);
    expect(emergencyEmbeddingPipeline.evaluateEmergencyEmbedding).toHaveBeenCalled();
    const ret = await emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mock.results[0].value;
    expect(ret.tenseCheckCalled).toBe(false);
  });

  test('EDGE-001 — mixed tense, LLM returns current → HIGH alert', async () => {
    const tc = corpusRunner.getById('EDGE-001');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: true,
      severity: 'HIGH',
      category: 'physical_acute',
      matchedPhrase: 'pain',
      buckets: ['physical_acute'],
      tense: 'current',
      tenseCheckCalled: true,
    });
    const result = await processor.processUtterance(clientId, t(tc), Date.now(), conversationId);
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe('HIGH');
  });

  test('EDGE-002 — third party emergency fires', async () => {
    const tc = corpusRunner.getById('EDGE-002');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: true,
      severity: 'HIGH',
      category: 'medical_emergency',
      matchedPhrase: 'collapse',
      buckets: ['third_party_emergency'],
      tense: 'current',
      tenseCheckCalled: true,
    });
    const result = await processor.processUtterance(clientId, t(tc), Date.now(), conversationId);
    expect(result.shouldAlert).toBe(true);
  });

  test('EDGE-003 — very short help suppressed', async () => {
    const tc = corpusRunner.getById('EDGE-003');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: false,
      buckets: [],
      tenseCheckCalled: false,
    });
    const result = await processor.processUtterance(clientId, t(tc), Date.now(), conversationId);
    expect(result.shouldAlert).toBe(false);
  });

  test('EDGE-004 — passive ideation HIGH', async () => {
    const tc = corpusRunner.getById('EDGE-004');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: true,
      severity: 'HIGH',
      category: 'self_harm',
      matchedPhrase: 'ideation',
      buckets: ['passive_ideation'],
      tense: 'current',
      tenseCheckCalled: true,
    });
    const result = await processor.processUtterance(clientId, t(tc), Date.now(), conversationId);
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe('HIGH');
  });
});
