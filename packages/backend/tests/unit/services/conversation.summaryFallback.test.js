const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Conversation, Client, Org, Call } = require('../../../src/models');
const conversationService = require('../../../src/services/conversation.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('getConversationHistory summary fallback limits', () => {
  let clientId;

  beforeEach(async () => {
    await Conversation.deleteMany({});
    await Call.deleteMany({});
    await Client.deleteMany({});
    await Org.deleteMany({});

    const org = await Org.create({ name: 'Org', email: 'org@example.com', country: 'US' });
    const client = await Client.create({
      name: 'Resident',
      email: 'res@example.com',
      phone: '+15555550199',
      org: org._id,
    });
    clientId = client._id;
  });

  const createConversationWithSummary = async ({ endTime, history }) => {
    const call = await Call.create({
      clientId,
      callSid: `CA${new mongoose.Types.ObjectId().toString()}`,
      startTime: endTime,
      endTime,
      status: 'completed',
    });
    return Conversation.create({
      clientId,
      callId: call._id,
      endTime,
      history,
      callType: 'wellness-check',
    });
  };

  it('returns only summaries within the age window', async () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await createConversationWithSummary({ endTime: recent, history: 'Recent summary about sleep' });
    const oldConv = await createConversationWithSummary({
      endTime: old,
      history: 'Old summary that should not appear',
    });
    await Conversation.collection.updateOne(
      { _id: oldConv._id },
      { $set: { updatedAt: old, createdAt: old } }
    );

    const history = await conversationService.getConversationHistory(clientId);
    expect(history).toContain('Recent summary about sleep');
    expect(history).not.toContain('Old summary that should not appear');
  });

  it('limits the number of fallback summaries', async () => {
    const base = Date.now() - 24 * 60 * 60 * 1000;
    for (let i = 0; i < 4; i += 1) {
      await createConversationWithSummary({
        endTime: new Date(base - i * 60 * 60 * 1000),
        history: `Summary number ${i}`,
      });
    }

    const history = await conversationService.getConversationHistory(clientId);
    const lines = history.split('\n');
    expect(lines.length).toBeLessThanOrEqual(conversationService.SUMMARY_FALLBACK_MAX_CONVERSATIONS);
  });
});
