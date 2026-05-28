const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const corpusRunner = require('../helpers/corpusRunner');
const emergencyEmbeddingPipeline = require('../../src/services/emergencyEmbeddingPipeline.service');
const { EmergencyProcessor } = require('../../src/services/emergencyProcessor.service');
const { ClientMemory } = require('../../src/models');

jest.mock('../../src/services/emergencyEmbeddingPipeline.service', () => ({
  evaluateEmergencyEmbedding: jest.fn(),
}));

jest.mock('../../src/services/clientMemory.service', () => {
  const actual = jest.requireActual('../../src/services/clientMemory.service');
  return {
    ...actual,
    writeUrgentFact: jest.fn().mockImplementation(actual.writeUrgentFact),
  };
});

const clientMemory = require('../../src/services/clientMemory.service');

let mongoServer;
let processor;
let clientId;
let conversationId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('ClientMemory from emergency (integration)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FORCE_EMBEDDING_PIPELINE = 'true';
    const { Client, Org } = require('../../src/models');
    await ClientMemory.deleteMany({});
    await Client.deleteMany({});
    await Org.deleteMany({});
    const org = await Org.create({ name: 'Mem Org', email: 'm@m.com', country: 'US' });
    const client = await Client.create({
      name: 'Mem Client',
      email: 'mc@mc.com',
      phone: '+15555550200',
      org: org._id,
      preferredLanguage: 'en',
    });
    clientId = client._id.toString();
    conversationId = new mongoose.Types.ObjectId().toString();
    processor = new EmergencyProcessor();
    const dedupe = require('../../src/utils/alertDeduplicator').getAlertDeduplicator();
    dedupe.clearHistory();

    clientMemory.writeUrgentFact.mockImplementation(
      jest.requireActual('../../src/services/clientMemory.service').writeUrgentFact
    );
  });

  afterEach(() => {
    delete process.env.FORCE_EMBEDDING_PIPELINE;
  });

  it('writes urgent ClientMemory fact when emergency is detected', async () => {
    const testCase = corpusRunner.getById('TP-MED-001');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: true,
      severity: 'CRITICAL',
      category: 'medical_emergency',
      matchedPhrase: 'heart attack',
      buckets: ['medical_emergency'],
      tense: 'current',
    });

    const spy = jest.spyOn(clientMemory, 'writeUrgentFact');

    await processor.processUtterance(clientId, testCase.text, Date.now(), conversationId);

    expect(spy).toHaveBeenCalledWith(
      clientId,
      expect.stringContaining('Emergency'),
      conversationId
    );
    spy.mockRestore();
  });

  it('urgent fact has priority:urgent and source:mid_call_emergency', async () => {
    const testCase = corpusRunner.getById('TP-MED-001');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: true,
      severity: 'CRITICAL',
      category: 'medical_emergency',
      matchedPhrase: 'heart attack',
      buckets: ['medical_emergency'],
      tense: 'current',
    });

    await processor.processUtterance(clientId, testCase.text, Date.now(), conversationId);

    const fact = await ClientMemory.findOne({ clientId });
    expect(fact).toBeTruthy();
    expect(fact.priority).toBe('urgent');
    expect(fact.source).toBe('mid_call_emergency');
    expect(fact.category).toBe('safety');
    expect(fact.status).toBe('provisional');
    expect(fact.sensitivity).toBe('high');
    expect(fact.confidenceScore).toBeLessThanOrEqual(0.55);
    expect(fact.fact).not.toContain(testCase.text.substring(0, 20));
    expect(fact.conversationId.toString()).toBe(conversationId);
  });

  it('does not write ClientMemory fact for true negative', async () => {
    const testCase = corpusRunner.getById('TN-MED-001');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: false,
      buckets: ['medical_emergency'],
      tense: 'past',
    });

    const spy = jest.spyOn(clientMemory, 'writeUrgentFact').mockResolvedValue(undefined);

    await processor.processUtterance(clientId, testCase.text, Date.now(), conversationId);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emergency processor does not throw if writeUrgentFact fails', async () => {
    const testCase = corpusRunner.getById('TP-MED-001');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: true,
      severity: 'CRITICAL',
      category: 'medical_emergency',
      matchedPhrase: 'heart attack',
      buckets: ['medical_emergency'],
      tense: 'current',
    });

    jest.spyOn(clientMemory, 'writeUrgentFact').mockRejectedValue(new Error('MongoDB timeout'));

    await expect(
      processor.processUtterance(clientId, testCase.text, Date.now(), conversationId)
    ).resolves.toMatchObject({ shouldAlert: true });
  });

  it('conversationId is null-safe for writeUrgentFact', async () => {
    const testCase = corpusRunner.getById('TP-MED-001');
    emergencyEmbeddingPipeline.evaluateEmergencyEmbedding.mockResolvedValue({
      evaluated: true,
      isEmergency: true,
      severity: 'CRITICAL',
      category: 'medical_emergency',
      matchedPhrase: 'heart attack',
      buckets: ['medical_emergency'],
      tense: 'current',
    });

    const spy = jest.spyOn(clientMemory, 'writeUrgentFact').mockResolvedValue(undefined);

    await processor.processUtterance(clientId, testCase.text, Date.now(), null);

    expect(spy).toHaveBeenCalledWith(clientId, expect.any(String), null);
    spy.mockRestore();
  });
});
