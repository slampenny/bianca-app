const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { Conversation } = require('../../../src/models');

describe('Conversation Model - Billing', () => {
  let conversationData;
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

  beforeEach(async () => {
    // Clear the database before each test
    await Conversation.deleteMany({});
    
    conversationData = {
      callSid: 'CA1234567890abcdef1234567890abcdef',
      patientId: new mongoose.Types.ObjectId(),
      messages: [],
      callType: 'outbound',
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      duration: 120, // 2 minutes
      cost: 0.20 // $0.20 for 2 minutes at $0.10/minute
    };
  });

  describe('cost field validation', () => {
    it('should accept valid cost values', async () => {
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.cost).toBe(0.20);
    });

    it('should accept zero cost', async () => {
      conversationData.cost = 0;
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.cost).toBe(0);
    });

    it('should reject negative cost values', async () => {
      conversationData.cost = -5.00;
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).rejects.toThrow('Cost cannot be negative');
    });

    it('should default cost to 0 when not provided', async () => {
      delete conversationData.cost;
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.cost).toBe(0);
    });

    it('should accept large cost values', async () => {
      conversationData.cost = 999.99;
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.cost).toBe(999.99);
    });
  });

  describe('lineItemId field', () => {
    it('should default lineItemId to null', async () => {
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.lineItemId).toBeNull();
    });

    it('should accept valid ObjectId for lineItemId', async () => {
      const lineItemId = new mongoose.Types.ObjectId();
      conversationData.lineItemId = lineItemId;
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.lineItemId.toString()).toBe(lineItemId.toString());
    });

    it('should allow updating lineItemId from null to valid ObjectId', async () => {
      const conversation = new Conversation(conversationData);
      await conversation.save();
      
      const lineItemId = new mongoose.Types.ObjectId();
      conversation.lineItemId = lineItemId;
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.lineItemId.toString()).toBe(lineItemId.toString());
    });
  });

  describe('billing-related queries', () => {
    let unbilledConversation;
    let billedConversation;

    beforeEach(async () => {
      // Create unbilled conversation
      unbilledConversation = new Conversation(conversationData);
      await unbilledConversation.save();

      // Create billed conversation
      const billedData = { ...conversationData };
      billedData.callSid = 'CA1234567890abcdef1234567890abcdef2';
      billedData.lineItemId = new mongoose.Types.ObjectId();
      billedConversation = new Conversation(billedData);
      await billedConversation.save();
    });

    it('should find unbilled conversations', async () => {
      const unbilled = await Conversation.find({ lineItemId: null });
      expect(unbilled).toHaveLength(1);
      expect(unbilled[0]._id.toString()).toBe(unbilledConversation._id.toString());
    });

    it('should find billed conversations', async () => {
      const billed = await Conversation.find({ lineItemId: { $ne: null } });
      expect(billed).toHaveLength(1);
      expect(billed[0]._id.toString()).toBe(billedConversation._id.toString());
    });

    it('should find conversations with cost greater than zero', async () => {
      const withCost = await Conversation.find({ cost: { $gt: 0 } });
      expect(withCost).toHaveLength(2); // Both conversations have cost > 0
    });

    it('should find conversations with zero cost', async () => {
      const zeroCostData = { ...conversationData };
      zeroCostData.callSid = 'CA1234567890abcdef1234567890abcdef3';
      zeroCostData.cost = 0;
      const zeroCostConversation = new Conversation(zeroCostData);
      await zeroCostConversation.save();

      const zeroCost = await Conversation.find({ cost: 0 });
      expect(zeroCost).toHaveLength(1);
      expect(zeroCost[0]._id.toString()).toBe(zeroCostConversation._id.toString());
    });
  });

  describe('conversation cost calculation scenarios', () => {
    it('should handle minimum billable duration scenario', async () => {
      // Test with duration less than minimum billable duration
      conversationData.duration = 15; // 15 seconds
      conversationData.cost = 0.05; // Should be billed for minimum 30 seconds
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.cost).toBe(0.05);
    });

    it('should handle failed call scenario', async () => {
      conversationData.status = 'failed';
      conversationData.duration = 0; // Failed call with 0 duration
      conversationData.cost = 0.05; // Still charged minimum amount
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.cost).toBe(0.05);
    });

    it('should handle long conversation scenario', async () => {
      conversationData.duration = 1800; // 30 minutes
      conversationData.cost = 3.00; // $3.00 for 30 minutes
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).resolves.toBeDefined();
      expect(conversation.cost).toBe(3.00);
    });
  });
});