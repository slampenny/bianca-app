const mongoose = require('mongoose');
const faker = require('faker');
const { Conversation, Message } = require('../../src/models');

const generateMessage = (role) => {
  const userMessages = [
    "Hello, how are you feeling today?",
    "I've been having some trouble sleeping lately.",
    "Can you help me with my medication schedule?",
    "I'm feeling a bit anxious about my upcoming appointment.",
    "Thank you for checking in on me.",
    "I've been doing my exercises as recommended.",
    "Is it normal to feel tired after taking the new medication?",
    "I'd like to schedule a follow-up call.",
  ];
  
  const assistantMessages = [
    "Hello! I'm here to help. How are you feeling today?",
    "I understand that sleep issues can be challenging. Let's talk about what might be causing this.",
    "Of course! I can help you organize your medication schedule. What medications are you currently taking?",
    "It's completely normal to feel anxious about medical appointments. Would you like to discuss what's concerning you?",
    "You're very welcome! It's my pleasure to support you.",
    "That's excellent! Regular exercise is so important for your health. How has it been going?",
    "Yes, fatigue can be a common side effect. How long have you been taking it?",
    "I'd be happy to schedule a follow-up call. What time works best for you?",
  ];
  
  const content = role === 'user' 
    ? faker.random.arrayElement(userMessages)
    : faker.random.arrayElement(assistantMessages);
  
  return {
    role,
    content,
    messageType: 'text',
  };
};

const conversationOne = {
  patientId: new mongoose.Types.ObjectId(),
  messages: [], // Start with empty array, will be populated after creating messages
  history: faker.lorem.paragraph(),
  analyzedData: {},
  metadata: {},
  startTime: new Date(),
  endTime: new Date(),
  duration: faker.datatype.number({ min: 1, max: 60 }),
  status: 'completed',
  callType: 'inbound',
};

const conversationTwo = {
  patientId: new mongoose.Types.ObjectId(),
  messages: [], // Start with empty array, will be populated after creating messages
  history: faker.lorem.paragraph(),
  analyzedData: {},
  metadata: {},
  startTime: new Date(),
  endTime: new Date(),
  duration: faker.datatype.number({ min: 1, max: 60 }),
  status: 'completed',
  callType: 'inbound',
};

const insertConversations = async (conversations) => {
  const createdConversations = [];
  
  for (const conversationData of conversations) {
    // Create the conversation first without messages
    const conversation = new Conversation(conversationData);
    await conversation.save();
    
    // Create messages with the conversation ID
    const messageIds = [];
    
    // Generate different numbers of messages for each conversation to test variety
    const messageCount = faker.datatype.number({ min: 3, max: 8 });
    const messageDataArray = [];
    
    for (let i = 0; i < messageCount; i++) {
      // Alternate between user and assistant messages
      const role = i % 2 === 0 ? 'user' : 'assistant';
      messageDataArray.push(generateMessage(role));
    }
    
    for (const messageData of messageDataArray) {
      const message = new Message({
        ...messageData,
        conversationId: conversation._id,
      });
      await message.save();
      messageIds.push(message._id);
    }
    
    // Update conversation with message IDs
    conversation.messages = messageIds;
    await conversation.save();
    
    createdConversations.push(conversation);
  }

  return createdConversations;
};

module.exports = {
  conversationOne,
  conversationTwo,
  insertConversations,
};
