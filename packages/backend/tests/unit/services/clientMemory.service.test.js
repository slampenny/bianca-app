const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { ClientMemory } = require('../../../src/models/clientMemory.model');
const clientMemoryService = require('../../../src/services/clientMemory.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('clientMemoryService deletion helpers', () => {
  afterEach(async () => {
    await ClientMemory.deleteMany({});
  });

  const clientId = new mongoose.Types.ObjectId();
  const otherClientId = new mongoose.Types.ObjectId();
  const conversationId = new mongoose.Types.ObjectId();
  const otherConversationId = new mongoose.Types.ObjectId();

  const insertFacts = async () => {
    await ClientMemory.insertMany([
      {
        clientId,
        conversationId,
        fact: 'Prefers to be called Rose',
        category: 'preference',
      },
      {
        clientId,
        conversationId: otherConversationId,
        fact: 'Daughter Sarah visits on Sundays',
        category: 'relationship',
      },
      {
        clientId: otherClientId,
        conversationId,
        fact: 'Other client fact',
        category: 'general',
      },
    ]);
  };

  it('suppressFactsForClient sets deletedAt and deletedReason on all active facts for a client', async () => {
    await insertFacts();

    const modifiedCount = await clientMemoryService.suppressFactsForClient(clientId, 'org_deleted');

    expect(modifiedCount).toBe(2);

    const suppressed = await ClientMemory.find({ clientId }).lean();
    expect(suppressed).toHaveLength(2);
    suppressed.forEach((fact) => {
      expect(fact.deletedAt).toBeInstanceOf(Date);
      expect(fact.deletedReason).toBe('org_deleted');
    });

    const untouched = await ClientMemory.findOne({ clientId: otherClientId }).lean();
    expect(untouched.deletedAt).toBeNull();
    expect(untouched.deletedReason).toBeNull();
  });

  it('suppressFactsForConversation sets deletedAt and deletedReason only for matching conversation', async () => {
    await insertFacts();

    const modifiedCount = await clientMemoryService.suppressFactsForConversation(
      conversationId,
      'retention_expired'
    );

    expect(modifiedCount).toBe(2);

    const suppressedForConversation = await ClientMemory.find({
      conversationId,
      deletedReason: 'retention_expired',
    }).lean();
    expect(suppressedForConversation).toHaveLength(2);

    const activeOtherConversation = await ClientMemory.findOne({
      clientId,
      conversationId: otherConversationId,
    }).lean();
    expect(activeOtherConversation.deletedAt).toBeNull();
  });

  it('hardDeleteFactsForClient permanently removes all facts for a client', async () => {
    await insertFacts();

    const deletedCount = await clientMemoryService.hardDeleteFactsForClient(clientId);

    expect(deletedCount).toBe(2);
    expect(await ClientMemory.countDocuments({ clientId })).toBe(0);
    expect(await ClientMemory.countDocuments({ clientId: otherClientId })).toBe(1);
  });

  it('getClientFacts excludes suppressed facts', async () => {
    await insertFacts();
    await clientMemoryService.suppressFactsForClient(clientId, 'erasure_request');

    const facts = await clientMemoryService.getClientFacts(clientId);

    expect(facts).toHaveLength(0);
  });
});
