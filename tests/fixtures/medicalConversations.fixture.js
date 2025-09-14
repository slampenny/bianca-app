// tests/fixtures/medicalConversations.fixture.js
const mongoose = require('mongoose');
const { Conversation, Message } = require('../../src/models');

/**
 * Medical Conversation Fixtures
 * 
 * This fixture provides sophisticated test data for medical analysis scenarios,
 * including conversations that simulate realistic patient-assistant interactions
 * with progressive degradation patterns over time.
 */

/**
 * Base patient data for medical scenarios
 */
const medicalPatients = {
  // Patient with normal baseline, showing gradual cognitive decline
  cognitiveDeclinePatient: {
    _id: new mongoose.Types.ObjectId(),
    name: 'Margaret Thompson',
    age: 72,
    medicalConditions: ['hypertension', 'mild arthritis'],
    preferredLanguage: 'en',
    baselineCognitiveLevel: 'normal'
  },
  
  // Patient with depression, showing worsening psychiatric symptoms
  psychiatricDeclinePatient: {
    _id: new mongoose.Types.ObjectId(),
    name: 'Robert Chen',
    age: 45,
    medicalConditions: ['depression', 'anxiety'],
    preferredLanguage: 'en',
    baselinePsychiatricLevel: 'moderate'
  },
  
  // Patient with mixed decline patterns
  mixedDeclinePatient: {
    _id: new mongoose.Types.ObjectId(),
    name: 'Eleanor Rodriguez',
    age: 68,
    medicalConditions: ['diabetes', 'early dementia'],
    preferredLanguage: 'en',
    baselineLevel: 'declining'
  },
  
  // Control patient with stable condition
  stablePatient: {
    _id: new mongoose.Types.ObjectId(),
    name: 'William Foster',
    age: 65,
    medicalConditions: ['controlled diabetes'],
    preferredLanguage: 'en',
    baselineLevel: 'stable'
  }
};

/**
 * Progressive cognitive decline conversation series
 * Simulates 6 months of conversations showing gradual cognitive deterioration
 */
const cognitiveDeclineConversations = {
  // Month 1: Normal baseline
  month1: [
    {
      date: new Date('2024-01-15T10:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'Good morning! I hope you\'re having a wonderful day. I wanted to discuss my medication schedule with you today.',
          timestamp: new Date('2024-01-15T10:00:00')
        },
        {
          role: 'assistant',
          content: 'Good morning, Margaret! I\'m doing well, thank you. I\'d be happy to help you with your medication schedule. What would you like to discuss?',
          timestamp: new Date('2024-01-15T10:00:30')
        },
        {
          role: 'patient',
          content: 'I take my blood pressure medication every morning at 8 AM, and I\'ve been very consistent with it. I also take my arthritis medication twice daily as prescribed.',
          timestamp: new Date('2024-01-15T10:01:00')
        },
        {
          role: 'assistant',
          content: 'That\'s excellent, Margaret! Consistency with medications is so important for managing your conditions effectively. Have you noticed any side effects or concerns?',
          timestamp: new Date('2024-01-15T10:01:30')
        },
        {
          role: 'patient',
          content: 'No, everything seems to be working well. I feel quite good and I\'m able to maintain my daily activities without any issues.',
          timestamp: new Date('2024-01-15T10:02:00')
        }
      ]
    },
    {
      date: new Date('2024-01-22T14:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'Hello there! I wanted to share some good news with you today.',
          timestamp: new Date('2024-01-22T14:00:00')
        },
        {
          role: 'assistant',
          content: 'Hello Margaret! I\'d love to hear your good news. What would you like to share?',
          timestamp: new Date('2024-01-22T14:00:30')
        },
        {
          role: 'patient',
          content: 'My daughter came to visit last weekend, and we had a lovely time together. We went for a walk in the park and had lunch at my favorite restaurant.',
          timestamp: new Date('2024-01-22T14:01:00')
        },
        {
          role: 'assistant',
          content: 'That sounds absolutely wonderful! Spending quality time with family and getting some gentle exercise must have been very enjoyable. How are you feeling after your walk?',
          timestamp: new Date('2024-01-22T14:01:30')
        },
        {
          role: 'patient',
          content: 'I felt great! The weather was perfect, and it was so nice to be outside. I think regular walks are really helping with my arthritis.',
          timestamp: new Date('2024-01-22T14:02:00')
        }
      ]
    }
  ],
  
  // Month 2: Slight cognitive changes begin
  month2: [
    {
      date: new Date('2024-02-10T09:30:00'),
      messages: [
        {
          role: 'patient',
          content: 'Good morning... um, I think I need to talk about my medications again.',
          timestamp: new Date('2024-02-10T09:30:00')
        },
        {
          role: 'assistant',
          content: 'Good morning, Margaret! Of course, I\'m here to help with your medications. What would you like to discuss?',
          timestamp: new Date('2024-02-10T09:30:30')
        },
        {
          role: 'patient',
          content: 'Well, I... I think I might have missed a dose yesterday. I\'m not entirely sure, but I feel like I might have forgotten to take something.',
          timestamp: new Date('2024-02-10T09:31:00')
        },
        {
          role: 'assistant',
          content: 'I understand your concern. Let\'s go through your medication schedule together. You take your blood pressure medication at 8 AM and your arthritis medication twice daily. Did you take your morning blood pressure medication today?',
          timestamp: new Date('2024-02-10T09:31:30')
        },
        {
          role: 'patient',
          content: 'Yes, I did take that one this morning. I remember that clearly. It\'s just the... the other one that I\'m not sure about.',
          timestamp: new Date('2024-02-10T09:32:00')
        }
      ]
    }
  ],
  
  // Month 3: More noticeable cognitive changes
  month3: [
    {
      date: new Date('2024-03-05T11:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'Hello, I\'m... I\'m not sure why I called today. Can you help me remember?',
          timestamp: new Date('2024-03-05T11:00:00')
        },
        {
          role: 'assistant',
          content: 'Hello Margaret! That\'s perfectly okay. Sometimes we call just to check in. How are you feeling today?',
          timestamp: new Date('2024-03-05T11:00:30')
        },
        {
          role: 'patient',
          content: 'I feel... um, I feel a bit confused today. I was supposed to do something important, but I can\'t remember what it was.',
          timestamp: new Date('2024-03-05T11:01:00')
        },
        {
          role: 'assistant',
          content: 'That can be frustrating. Let\'s think together. Was it related to your health, your medications, or perhaps an appointment?',
          timestamp: new Date('2024-03-05T11:01:30')
        },
        {
          role: 'patient',
          content: 'I think... I think it might have been about my... my medicine? But I\'m not sure. Everything feels a bit fuzzy today.',
          timestamp: new Date('2024-03-05T11:02:00')
        }
      ]
    }
  ],
  
  // Month 4: Clear cognitive decline indicators
  month4: [
    {
      date: new Date('2024-04-12T15:30:00'),
      messages: [
        {
          role: 'patient',
          content: 'Hi there... um, I don\'t know... I don\'t know why I\'m here.',
          timestamp: new Date('2024-04-12T15:30:00')
        },
        {
          role: 'assistant',
          content: 'Hello Margaret, it\'s okay. You\'re speaking with your health assistant. How are you feeling today?',
          timestamp: new Date('2024-04-12T15:30:30')
        },
        {
          role: 'patient',
          content: 'I feel... I feel lost. I can\'t remember what I\'m supposed to do. The thing is... the thing is...',
          timestamp: new Date('2024-04-12T15:31:00')
        },
        {
          role: 'assistant',
          content: 'Take your time, Margaret. There\'s no rush. You mentioned feeling lost - can you tell me more about that?',
          timestamp: new Date('2024-04-12T15:31:30')
        },
        {
          role: 'patient',
          content: 'I... I don\'t know. Everything is so confusing. I used to know what to do, but now... now I don\'t.',
          timestamp: new Date('2024-04-12T15:32:00')
        }
      ]
    }
  ],
  
  // Month 5: Significant cognitive decline
  month5: [
    {
      date: new Date('2024-05-08T10:15:00'),
      messages: [
        {
          role: 'patient',
          content: 'Hello... um... who are you again?',
          timestamp: new Date('2024-05-08T10:15:00')
        },
        {
          role: 'assistant',
          content: 'Hello Margaret, I\'m your health assistant. We talk regularly about your health and medications.',
          timestamp: new Date('2024-05-08T10:15:30')
        },
        {
          role: 'patient',
          content: 'Oh... oh yes. I think I remember now. You help me with... with the things I need to take.',
          timestamp: new Date('2024-05-08T10:16:00')
        },
        {
          role: 'assistant',
          content: 'That\'s right! I help you with your medications. How are you feeling today?',
          timestamp: new Date('2024-05-08T10:16:30')
        },
        {
          role: 'patient',
          content: 'I feel... I feel confused. I can\'t remember if I took my... my pills today. Did I take them?',
          timestamp: new Date('2024-05-08T10:17:00')
        }
      ]
    }
  ],
  
  // Month 6: Advanced cognitive decline
  month6: [
    {
      date: new Date('2024-06-15T09:45:00'),
      messages: [
        {
          role: 'patient',
          content: 'Hello... hello... is anyone there?',
          timestamp: new Date('2024-06-15T09:45:00')
        },
        {
          role: 'assistant',
          content: 'Yes Margaret, I\'m here. This is your health assistant calling to check on you.',
          timestamp: new Date('2024-06-15T09:45:30')
        },
        {
          role: 'patient',
          content: 'Oh... oh good. I was... I was worried. I don\'t know what\'s happening to me.',
          timestamp: new Date('2024-06-15T09:46:00')
        },
        {
          role: 'assistant',
          content: 'You\'re safe, Margaret. Can you tell me how you\'re feeling today?',
          timestamp: new Date('2024-06-15T09:46:30')
        },
        {
          role: 'patient',
          content: 'I feel... I feel scared. Everything is so... so strange. I don\'t understand what\'s happening.',
          timestamp: new Date('2024-06-15T09:47:00')
        }
      ]
    }
  ]
};

/**
 * Progressive psychiatric decline conversation series
 * Simulates 6 months of conversations showing gradual psychiatric deterioration
 */
const psychiatricDeclineConversations = {
  // Month 1: Baseline moderate depression/anxiety
  month1: [
    {
      date: new Date('2024-01-10T14:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'Hi, I wanted to talk about how I\'ve been feeling lately. I\'ve been having some ups and downs.',
          timestamp: new Date('2024-01-10T14:00:00')
        },
        {
          role: 'assistant',
          content: 'Hello Robert, I\'m glad you reached out. Can you tell me more about these ups and downs you\'ve been experiencing?',
          timestamp: new Date('2024-01-10T14:00:30')
        },
        {
          role: 'patient',
          content: 'Some days I feel okay, but other days I feel really down. I\'ve been having trouble sleeping and I worry a lot about work.',
          timestamp: new Date('2024-01-10T14:01:00')
        },
        {
          role: 'assistant',
          content: 'It sounds like you\'re dealing with some stress and mood changes. How long have you been experiencing these sleep issues?',
          timestamp: new Date('2024-01-10T14:01:30')
        },
        {
          role: 'patient',
          content: 'For about a month now. I wake up in the middle of the night and can\'t get back to sleep. Then I\'m exhausted the next day.',
          timestamp: new Date('2024-01-10T14:02:00')
        }
      ]
    }
  ],
  
  // Month 2: Worsening symptoms
  month2: [
    {
      date: new Date('2024-02-08T16:30:00'),
      messages: [
        {
          role: 'patient',
          content: 'I\'m not doing well today. I feel really hopeless and I don\'t see the point in anything.',
          timestamp: new Date('2024-02-08T16:30:00')
        },
        {
          role: 'assistant',
          content: 'I\'m sorry to hear you\'re feeling this way, Robert. Can you tell me what\'s been contributing to these feelings of hopelessness?',
          timestamp: new Date('2024-02-08T16:30:30')
        },
        {
          role: 'patient',
          content: 'Everything feels pointless. Work is overwhelming, I can\'t concentrate, and I feel like I\'m letting everyone down.',
          timestamp: new Date('2024-02-08T16:31:00')
        },
        {
          role: 'assistant',
          content: 'These feelings sound very difficult to manage. Have you noticed any changes in your appetite or interest in activities you used to enjoy?',
          timestamp: new Date('2024-02-08T16:31:30')
        },
        {
          role: 'patient',
          content: 'I don\'t feel like eating much, and I\'ve stopped doing things I used to like. I just want to stay in bed all day.',
          timestamp: new Date('2024-02-08T16:32:00')
        }
      ]
    }
  ],
  
  // Month 3: Severe depression indicators
  month3: [
    {
      date: new Date('2024-03-12T13:15:00'),
      messages: [
        {
          role: 'patient',
          content: 'I don\'t want to be here anymore. I can\'t take this pain anymore.',
          timestamp: new Date('2024-03-12T13:15:00')
        },
        {
          role: 'assistant',
          content: 'Robert, I\'m very concerned about what you\'re saying. Are you having thoughts of hurting yourself?',
          timestamp: new Date('2024-03-12T13:15:30')
        },
        {
          role: 'patient',
          content: 'I think about it all the time. I don\'t see any way out of this darkness. Everyone would be better off without me.',
          timestamp: new Date('2024-03-12T13:16:00')
        },
        {
          role: 'assistant',
          content: 'I want you to know that you\'re not alone, and there are people who care about you. Have you spoken to anyone else about these feelings?',
          timestamp: new Date('2024-03-12T13:16:30')
        },
        {
          role: 'patient',
          content: 'No, I don\'t want to burden anyone. I feel like such a failure. I can\'t even function normally anymore.',
          timestamp: new Date('2024-03-12T13:17:00')
        }
      ]
    }
  ],
  
  // Month 4: Crisis level symptoms
  month4: [
    {
      date: new Date('2024-04-20T11:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'I\'ve made up my mind. I can\'t live like this anymore. I have a plan.',
          timestamp: new Date('2024-04-20T11:00:00')
        },
        {
          role: 'assistant',
          content: 'Robert, I\'m extremely concerned about your safety right now. Can you tell me what plan you\'re referring to?',
          timestamp: new Date('2024-04-20T11:00:30')
        },
        {
          role: 'patient',
          content: 'I\'ve been thinking about it for weeks. I know exactly what I need to do to end this suffering.',
          timestamp: new Date('2024-04-20T11:01:00')
        },
        {
          role: 'assistant',
          content: 'I need you to know that there is help available and that these feelings can be treated. Are you willing to let me connect you with crisis support?',
          timestamp: new Date('2024-04-20T11:01:30')
        },
        {
          role: 'patient',
          content: 'It\'s too late for help. I\'ve made my decision. I\'m sorry.',
          timestamp: new Date('2024-04-20T11:02:00')
        }
      ]
    }
  ],
  
  // Month 5: Post-crisis, severe depression
  month5: [
    {
      date: new Date('2024-05-15T14:30:00'),
      messages: [
        {
          role: 'patient',
          content: 'I\'m still here, but I wish I wasn\'t. I feel nothing but emptiness.',
          timestamp: new Date('2024-05-15T14:30:00')
        },
        {
          role: 'assistant',
          content: 'I\'m glad you\'re still here, Robert. How have you been feeling since our last conversation?',
          timestamp: new Date('2024-05-15T14:30:30')
        },
        {
          role: 'patient',
          content: 'I feel like a shell of who I used to be. I can\'t feel joy or happiness anymore. Everything is gray.',
          timestamp: new Date('2024-05-15T14:31:00')
        },
        {
          role: 'assistant',
          content: 'That sounds incredibly difficult. Are you continuing with your treatment plan?',
          timestamp: new Date('2024-05-15T14:31:30')
        },
        {
          role: 'patient',
          content: 'I\'m trying, but nothing seems to work. I feel like I\'m broken beyond repair.',
          timestamp: new Date('2024-05-15T14:32:00')
        }
      ]
    }
  ],
  
  // Month 6: Severe, persistent depression
  month6: [
    {
      date: new Date('2024-06-10T12:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'I don\'t know why I keep trying. Nothing ever gets better.',
          timestamp: new Date('2024-06-10T12:00:00')
        },
        {
          role: 'assistant',
          content: 'I hear how hopeless you\'re feeling, Robert. Can you tell me what\'s been happening since our last conversation?',
          timestamp: new Date('2024-06-10T12:00:30')
        },
        {
          role: 'patient',
          content: 'I can\'t function anymore. I can\'t work, I can\'t take care of myself, I can\'t even get out of bed most days.',
          timestamp: new Date('2024-06-10T12:01:00')
        },
        {
          role: 'assistant',
          content: 'This level of functional impairment is very concerning. Have you been in contact with your mental health provider?',
          timestamp: new Date('2024-06-10T12:01:30')
        },
        {
          role: 'patient',
          content: 'I don\'t see the point. I\'m a lost cause. I just want the pain to stop.',
          timestamp: new Date('2024-06-10T12:02:00')
        }
      ]
    }
  ]
};

/**
 * Mixed decline patterns - both cognitive and psychiatric
 */
const mixedDeclineConversations = {
  // Month 1: Early signs of both types of decline
  month1: [
    {
      date: new Date('2024-01-20T10:30:00'),
      messages: [
        {
          role: 'patient',
          content: 'Hello, I\'ve been having some concerns about my memory lately, and I\'ve also been feeling quite anxious.',
          timestamp: new Date('2024-01-20T10:30:00')
        },
        {
          role: 'assistant',
          content: 'Hello Eleanor, I\'m here to help. Can you tell me more about the memory concerns and anxiety you\'ve been experiencing?',
          timestamp: new Date('2024-01-20T10:30:30')
        },
        {
          role: 'patient',
          content: 'I keep forgetting where I put things, and sometimes I can\'t remember what I was doing. This makes me worry that something is wrong with me.',
          timestamp: new Date('2024-01-20T10:31:00')
        },
        {
          role: 'assistant',
          content: 'Memory changes can be concerning, and I understand how that would increase your anxiety. How long have you been noticing these changes?',
          timestamp: new Date('2024-01-20T10:31:30')
        },
        {
          role: 'patient',
          content: 'For a few months now. I worry that it\'s getting worse, and that thought makes me feel even more anxious.',
          timestamp: new Date('2024-01-20T10:32:00')
        }
      ]
    }
  ],
  
  // Month 3: Noticeable decline in both areas
  month3: [
    {
      date: new Date('2024-03-15T14:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'I\'m scared. I don\'t know what\'s happening to me. I can\'t remember things and I feel so worried all the time.',
          timestamp: new Date('2024-03-15T14:00:00')
        },
        {
          role: 'assistant',
          content: 'Eleanor, I can hear how frightened you are. Let\'s talk through what you\'re experiencing. What specific things are you having trouble remembering?',
          timestamp: new Date('2024-03-15T14:00:30')
        },
        {
          role: 'patient',
          content: 'I forget... I forget what I was saying. I forget people\'s names, even people I know well. I feel like I\'m losing myself.',
          timestamp: new Date('2024-03-15T14:01:00')
        },
        {
          role: 'assistant',
          content: 'That must be very distressing. When you say you feel like you\'re losing yourself, can you tell me more about that?',
          timestamp: new Date('2024-03-15T14:01:30')
        },
        {
          role: 'patient',
          content: 'I don\'t feel like the same person anymore. I\'m confused and scared and I don\'t know who I am.',
          timestamp: new Date('2024-03-15T14:02:00')
        }
      ]
    }
  ],
  
  // Month 6: Advanced mixed decline
  month6: [
    {
      date: new Date('2024-06-20T09:15:00'),
      messages: [
        {
          role: 'patient',
          content: 'Help me... please help me. I don\'t know where I am or what\'s happening.',
          timestamp: new Date('2024-06-20T09:15:00')
        },
        {
          role: 'assistant',
          content: 'Eleanor, you\'re safe. This is your health assistant calling to check on you. Can you tell me where you are right now?',
          timestamp: new Date('2024-06-20T09:15:30')
        },
        {
          role: 'patient',
          content: 'I\'m... I\'m at home, I think. But I don\'t remember how I got here. I\'m so confused and afraid.',
          timestamp: new Date('2024-06-20T09:16:00')
        },
        {
          role: 'assistant',
          content: 'You\'re at home and you\'re safe. I can hear how confused and frightened you are. Are there any familiar objects around you?',
          timestamp: new Date('2024-06-20T09:16:30')
        },
        {
          role: 'patient',
          content: 'I see... I see things, but I don\'t know what they are. Everything looks strange and scary. I want to go back to being normal.',
          timestamp: new Date('2024-06-20T09:17:00')
        }
      ]
    }
  ]
};

/**
 * Stable patient conversations for comparison
 */
const stablePatientConversations = {
  month1: [
    {
      date: new Date('2024-01-15T11:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'Good morning! I wanted to update you on my diabetes management. My blood sugar levels have been quite stable.',
          timestamp: new Date('2024-01-15T11:00:00')
        },
        {
          role: 'assistant',
          content: 'Good morning, William! That\'s excellent news. Can you tell me what your recent readings have been?',
          timestamp: new Date('2024-01-15T11:00:30')
        },
        {
          role: 'patient',
          content: 'They\'ve been consistently between 120 and 140 mg/dL, which my doctor says is good for someone my age.',
          timestamp: new Date('2024-01-15T11:01:00')
        }
      ]
    }
  ],
  month3: [
    {
      date: new Date('2024-03-15T11:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'Hello! I\'m continuing to do well with my diabetes management. I\'ve been very consistent with my diet and exercise routine.',
          timestamp: new Date('2024-03-15T11:00:00')
        },
        {
          role: 'assistant',
          content: 'That\'s wonderful to hear, William! Consistency is key for diabetes management. How have you been feeling overall?',
          timestamp: new Date('2024-03-15T11:00:30')
        },
        {
          role: 'patient',
          content: 'I feel great! I have good energy levels and I\'m able to maintain my daily activities without any problems.',
          timestamp: new Date('2024-03-15T11:01:00')
        }
      ]
    }
  ],
  month6: [
    {
      date: new Date('2024-06-15T11:00:00'),
      messages: [
        {
          role: 'patient',
          content: 'Good morning! I wanted to share that my diabetes management continues to go well. My A1C was 6.8% at my last checkup.',
          timestamp: new Date('2024-06-15T11:00:00')
        },
        {
          role: 'assistant',
          content: 'That\'s excellent news, William! An A1C of 6.8% shows great diabetes control. How do you feel about your overall health?',
          timestamp: new Date('2024-06-15T11:00:30')
        },
        {
          role: 'patient',
          content: 'I feel very good about my health. I\'m managing my condition well and I\'m confident in my ability to maintain this level of control.',
          timestamp: new Date('2024-06-15T11:01:00')
        }
      ]
    }
  ]
};

/**
 * Helper function to create conversation objects from the fixture data
 */
const createConversationsFromFixture = async (patientId, conversationData) => {
  const conversations = [];
  
  for (const monthData of Object.values(conversationData)) {
    for (const convData of monthData) {
      // Create conversation
      const conversation = new Conversation({
        patientId,
        startTime: convData.date,
        endTime: new Date(convData.date.getTime() + 30 * 60 * 1000), // 30 minutes later
        duration: 30,
        status: 'completed',
        callType: 'inbound',
        messages: []
      });
      
      await conversation.save();
      
      // Create messages
      const messageIds = [];
      for (const msgData of convData.messages) {
        const message = new Message({
          role: msgData.role,
          content: msgData.content,
          conversationId: conversation._id,
          messageType: 'text',
          createdAt: msgData.timestamp
        });
        
        await message.save();
        messageIds.push(message._id);
      }
      
      // Update conversation with message IDs
      conversation.messages = messageIds;
      await conversation.save();
      
      conversations.push(conversation);
    }
  }
  
  return conversations;
};

/**
 * Create all medical conversation fixtures
 */
const createMedicalConversationFixtures = async () => {
  const fixtures = {};
  
  // Cognitive decline patient conversations
  fixtures.cognitiveDecline = await createConversationsFromFixture(
    medicalPatients.cognitiveDeclinePatient._id,
    cognitiveDeclineConversations
  );
  
  // Psychiatric decline patient conversations
  fixtures.psychiatricDecline = await createConversationsFromFixture(
    medicalPatients.psychiatricDeclinePatient._id,
    psychiatricDeclineConversations
  );
  
  // Mixed decline patient conversations
  fixtures.mixedDecline = await createConversationsFromFixture(
    medicalPatients.mixedDeclinePatient._id,
    mixedDeclineConversations
  );
  
  // Stable patient conversations
  fixtures.stable = await createConversationsFromFixture(
    medicalPatients.stablePatient._id,
    stablePatientConversations
  );
  
  return fixtures;
};

module.exports = {
  medicalPatients,
  cognitiveDeclineConversations,
  psychiatricDeclineConversations,
  mixedDeclineConversations,
  stablePatientConversations,
  createConversationsFromFixture,
  createMedicalConversationFixtures
};

