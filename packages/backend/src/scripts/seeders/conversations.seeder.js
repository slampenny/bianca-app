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

/**
 * Add fraud/abuse pattern conversations for testing
 * Creates conversations showing financial exploitation, abuse, and neglect patterns
 * @param {string} patientId - The patient ID to add conversations for
 */
async function addFraudAbuseConversations(patientId) {
  console.log('Adding fraud/abuse pattern conversations for patient:', patientId);
  
  const conversations = [];
  const now = new Date();
  
  // Financial exploitation conversations (escalating over time)
  const financialDates = [
    new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
    new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),  // 5 days ago
  ];
  
  const financialMessages = [
    'I met someone new online and they seem really nice. They said they need help with something.',
    'This new friend I met asked if I could send them some money. They said it was urgent and they would pay me back. I think I should help them.',
    'I sent five thousand dollars to my new friend through Western Union. They said it was an emergency and I needed to act now. They told me not to tell anyone about it.',
    'I got a call from someone saying I won a prize and I need to send them money for taxes. They said I need to send ten thousand dollars immediately or I will lose the prize. This is urgent!',
    'I need to send more money. They said I won a lottery and I need to verify my identity with gift cards. I bought five thousand dollars in gift cards. They said this is my last chance to claim the money. Don\'t tell anyone about this.'
  ];
  
  for (let i = 0; i < financialDates.length; i++) {
    const conv = new Conversation({
      patientId: patientId,
      messages: [],
      history: `Financial exploitation pattern conversation ${i + 1}`,
      analyzedData: {},
      metadata: { source: 'fraud_abuse_seed', type: 'financial', sequence: i + 1 },
      createdAt: financialDates[i],
      updatedAt: financialDates[i],
      startTime: financialDates[i],
      endTime: new Date(financialDates[i].getTime() + 20 * 60 * 1000),
      duration: 20,
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.20,
      lineItemId: null
    });
    await conv.save();
    
    const msg = new Message({
      role: 'patient',
      content: financialMessages[i],
      conversationId: conv._id
    });
    await msg.save();
    
    conv.messages.push(msg._id);
    await conv.save();
    conversations.push(conv);
  }
  
  // Physical abuse conversations
  const abuseDates = [
    new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
  ];
  
  const abuseMessages = [
    'I fell down yesterday and I have a bruise on my arm. I don\'t really remember how it happened. It was an accident I think.',
    'I have a cut on my face. I bumped into something. I am afraid to talk about it. I don\'t want to get in trouble.',
    'Someone hit me and I have a black eye. They said I deserved it because I did something wrong. I am scared of them. I don\'t want to tell anyone because they said they would hurt me more if I did.'
  ];
  
  for (let i = 0; i < abuseDates.length; i++) {
    const conv = new Conversation({
      patientId: patientId,
      messages: [],
      history: `Physical abuse pattern conversation ${i + 1}`,
      analyzedData: {},
      metadata: { source: 'fraud_abuse_seed', type: 'physical_abuse', sequence: i + 1 },
      createdAt: abuseDates[i],
      updatedAt: abuseDates[i],
      startTime: abuseDates[i],
      endTime: new Date(abuseDates[i].getTime() + 15 * 60 * 1000),
      duration: 15,
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.15,
      lineItemId: null
    });
    await conv.save();
    
    const msg = new Message({
      role: 'patient',
      content: abuseMessages[i],
      conversationId: conv._id
    });
    await msg.save();
    
    conv.messages.push(msg._id);
    await conv.save();
    conversations.push(conv);
  }
  
  // Emotional abuse and isolation conversations
  const emotionalDates = [
    new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
  ];
  
  const emotionalMessages = [
    'I am not allowed to talk to my friends anymore. They said I can\'t see them. I feel isolated and alone.',
    'I am afraid to do anything because they control everything I do. They tell me what to do and I have to ask permission for everything. I feel worthless.',
    'They threatened me and said they would leave if I don\'t do what they say. I am walking on eggshells. I don\'t want to upset them. I can\'t talk to anyone about this.'
  ];
  
  for (let i = 0; i < emotionalDates.length; i++) {
    const conv = new Conversation({
      patientId: patientId,
      messages: [],
      history: `Emotional abuse pattern conversation ${i + 1}`,
      analyzedData: {},
      metadata: { source: 'fraud_abuse_seed', type: 'emotional_abuse', sequence: i + 1 },
      createdAt: emotionalDates[i],
      updatedAt: emotionalDates[i],
      startTime: emotionalDates[i],
      endTime: new Date(emotionalDates[i].getTime() + 18 * 60 * 1000),
      duration: 18,
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.18,
      lineItemId: null
    });
    await conv.save();
    
    const msg = new Message({
      role: 'patient',
      content: emotionalMessages[i],
      conversationId: conv._id
    });
    await msg.save();
    
    conv.messages.push(msg._id);
    await conv.save();
    conversations.push(conv);
  }
  
  // Neglect conversations
  const neglectDates = [
    new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
  ];
  
  const neglectMessages = [
    'I haven\'t eaten in two days. There is no food in the house. I am hungry and I don\'t know what to do.',
    'I haven\'t taken my medication in a week. I ran out and no one will help me get more. I need medical care but I can\'t see a doctor.',
    'I have been left alone for days. No one visits me. No one calls. I am all alone and I feel forgotten. I need help but there is no one here.'
  ];
  
  for (let i = 0; i < neglectDates.length; i++) {
    const conv = new Conversation({
      patientId: patientId,
      messages: [],
      history: `Neglect pattern conversation ${i + 1}`,
      analyzedData: {},
      metadata: { source: 'fraud_abuse_seed', type: 'neglect', sequence: i + 1 },
      createdAt: neglectDates[i],
      updatedAt: neglectDates[i],
      startTime: neglectDates[i],
      endTime: new Date(neglectDates[i].getTime() + 22 * 60 * 1000),
      duration: 22,
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.22,
      lineItemId: null
    });
    await conv.save();
    
    const msg = new Message({
      role: 'patient',
      content: neglectMessages[i],
      conversationId: conv._id
    });
    await msg.save();
    
    conv.messages.push(msg._id);
    await conv.save();
    conversations.push(conv);
  }
  
  console.log(`Added ${conversations.length} fraud/abuse pattern conversations`);
  return conversations;
}

module.exports = {
  seedConversations,
  addDecliningPatientConversations,
  addNormalPatientConversations,
  addRecentPatientConversations,
  addFraudAbuseConversations,
};

