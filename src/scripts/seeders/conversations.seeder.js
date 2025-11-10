const { Conversation, Message } = require('../../models');
const conversationFixture = require('../../../tests/fixtures/conversation.fixture');

/**
 * Add declining patient conversations to show progression over time
 * @param {string} patientId - The patient ID to add conversations for
 */
async function addDecliningPatientConversations(patientId) {
  console.log('Adding declining patient conversations for patient:', patientId);
  
  const decliningConversations = [];
  
  // Month 1: Healthy baseline
  const month1Date = new Date();
  month1Date.setMonth(month1Date.getMonth() - 5);
  
  const conv1 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient discussing medication management and overall health status.',
    analyzedData: {},
    metadata: { source: 'declining_patient_seed', month: 1 },
    createdAt: month1Date,
    updatedAt: month1Date,
    startTime: month1Date,
    endTime: new Date(month1Date.getTime() + 30 * 60 * 1000),
    duration: 30,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.30,
    lineItemId: null
  });
  await conv1.save();
  
  const msg1 = new Message({
    role: 'patient',
    content: 'Good morning! I hope you are having a wonderful day. I wanted to discuss my medication schedule with you today. I take my blood pressure medication every morning at 8 AM, and I have been very consistent with it. I feel good and I have energy. I am managing my health well and everything is going smoothly. My memory has been sharp and I have been able to keep track of all my appointments and medications without any issues.',
    conversationId: conv1._id
  });
  await msg1.save();
  
  conv1.messages.push(msg1._id);
  await conv1.save();
  decliningConversations.push(conv1);
  
  // Add more months (simplified - full implementation in original seedDatabase.js)
  // For now, just return what we have - can expand later if needed
  
  return decliningConversations;
}

/**
 * Add normal patient conversations
 * @param {string} patientId - The patient ID to add conversations for
 */
async function addNormalPatientConversations(patientId) {
  console.log('Adding normal patient conversations for patient:', patientId);
  // Implementation similar to declining conversations but with stable/improving content
  // Simplified for now - can expand later
  return [];
}

/**
 * Add recent patient conversations (within last 30 days)
 * @param {string} patientId - The patient ID to add conversations for
 */
async function addRecentPatientConversations(patientId) {
  console.log('Adding recent patient conversations for patient:', patientId);
  
  const recentConversations = [];
  const daysAgo = [2, 7, 14];
  
  for (let i = 0; i < daysAgo.length; i++) {
    const days = daysAgo[i];
    const convDate = new Date();
    convDate.setDate(convDate.getDate() - days);
    convDate.setHours(10, 0, 0, 0);
    
    const conv = new Conversation({
      patientId: patientId,
      messages: [],
      history: `Recent wellness check conversation from ${days} days ago.`,
      analyzedData: {},
      metadata: { source: 'recent_patient_seed', daysAgo: days },
      createdAt: convDate,
      updatedAt: convDate,
      startTime: convDate,
      endTime: new Date(convDate.getTime() + 25 * 60 * 1000),
      duration: 25,
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.25,
      lineItemId: null
    });
    await conv.save();
    
    const messages = [
      {
        role: 'patient',
        content: i === 0 
          ? 'Good morning! I am feeling really good today. I had a great week and I am very happy with how things are going. My medications are working well and I have been sleeping better. I feel positive and optimistic about the future.'
          : i === 1
          ? 'Hello! I am doing okay today. Some days are better than others, but overall I am managing well. I have been taking my medications as prescribed and trying to stay active. I appreciate the support I receive.'
          : 'Hi there. I wanted to check in about my health. I have been feeling a bit tired lately, but I am still managing my daily activities. I am following my medication schedule and trying to maintain a routine.'
      },
      {
        role: 'assistant',
        content: i === 0
          ? 'That is wonderful to hear! I am so glad you are feeling positive and that your medications are working well. It sounds like you are taking great care of yourself.'
          : i === 1
          ? 'Thank you for the update. It is good to hear that you are managing well overall. Consistency with medications and staying active are both important.'
          : 'Thank you for sharing. It is important to monitor how you are feeling. Let us make sure you are getting enough rest and staying hydrated.'
      }
    ];
    
    for (const msgData of messages) {
      const msg = new Message({
        role: msgData.role,
        content: msgData.content,
        conversationId: conv._id
      });
      await msg.save();
      conv.messages.push(msg._id);
    }
    
    await conv.save();
    recentConversations.push(conv);
  }
  
  return recentConversations;
}

/**
 * Seed conversations using fixtures
 * @param {Object} patient - Patient to seed conversations for
 * @returns {Promise<Array>} Array of created conversations
 */
async function seedConversations(patient) {
  console.log('Seeding Conversations for patient:', patient._id);
  const { conversationOne, conversationTwo, insertConversations } = conversationFixture;
  
  // insertConversations expects just an array of conversations
  // Set patientId on the conversation objects
  const conversationsToInsert = [
    { ...conversationOne, patientId: patient._id },
    { ...conversationTwo, patientId: patient._id }
  ];
  
  const conversations = await insertConversations(conversationsToInsert);
  console.log(`Seeded ${conversations.length} conversations`);
  
  return conversations;
}

module.exports = {
  seedConversations,
  addDecliningPatientConversations,
  addNormalPatientConversations,
  addRecentPatientConversations,
};

