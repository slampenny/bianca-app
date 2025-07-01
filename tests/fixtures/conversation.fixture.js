const mongoose = require('mongoose');
const faker = require('faker');
const { Conversation, Message } = require('../../src/models');

const generateMessage = (role) => ({
  role,
  content: faker.lorem.sentence(),
  messageType: 'text',
  timestamp: new Date(),
});

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
    const messageDataArray = [generateMessage('user'), generateMessage('assistant')];
    
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
