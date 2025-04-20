const mongoose = require('mongoose');
const faker = require('faker');
const { Conversation, Message } = require('../../src/models');

const generateMessage = (role) => ({
  role,
  content: faker.lorem.sentence(),
});

const conversationOne = {
  patientId: mongoose.Types.ObjectId(),
  messages: [generateMessage('patient'), generateMessage('doctor')],
  history: faker.lorem.paragraph(),
  analyzedData: {},
  metadata: {},
  startTime: new Date(),
  endTime: new Date(),
  duration: faker.datatype.number({ min: 1, max: 60 }),
};

const conversationTwo = {
  patientId: mongoose.Types.ObjectId(),
  messages: [generateMessage('patient'), generateMessage('doctor')],
  history: faker.lorem.paragraph(),
  analyzedData: {},
  metadata: {},
  startTime: new Date(),
  endTime: new Date(),
  duration: faker.datatype.number({ min: 1, max: 60 }),
};

const insertConversations = async (conversations) => {
  // First, save messages individually and get their IDs
  const messages = [];
  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      const newMessage = new Message(message);
      await newMessage.save();
      messages.push(newMessage._id);
    }
    conversation.messages = messages;
  }

  // Insert conversations with message IDs
  return await Conversation.insertMany(conversations);
};

module.exports = {
  conversationOne,
  conversationTwo,
  insertConversations,
};
