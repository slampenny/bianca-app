const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const conversationService = require('../../../src/services/conversation.service');
const { Conversation, Message, Patient, Call } = require('../../../src/models');

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

describe('Conversation Profile Service', () => {
  beforeEach(async () => {
    await Patient.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();
    await Call.deleteMany();
  });

  describe('parseUserInformation', () => {
    // Access the private function through the service
    // Since parseUserInformation is not exported, we'll test it indirectly through updatePatientConversationProfile
    // But we can also test the parsing logic by checking the results

    it('should extract favorite color from user information', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test@example.com',
        phone: '+16045624263',
        preferredLanguage: 'en'
      });
      await patient.save();

      const userInformation = `User Information:
- Name: Test Patient
- Personal Preferences: favorite color is blue, enjoys gardening and reading
- Family Information: Has two grandchildren`;

      // Create a call and conversation
      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567890',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: new Date(),
        updatedAt: new Date(Date.now() + 120000) // 2 minutes later
      });
      await conversation.save();

      // Add some patient messages
      const message1 = new Message({
        role: 'patient',
        content: 'My favorite color is blue',
        conversationId: conversation._id
      });
      await message1.save();

      const message2 = new Message({
        role: 'patient',
        content: 'I really enjoy gardening in my backyard',
        conversationId: conversation._id
      });
      await message2.save();

      conversation.messages = [message1._id, message2._id];
      await conversation.save();

      // Update profile
      await conversationService.updatePatientConversationProfile(
        patient._id,
        userInformation,
        conversation._id
      );

      // Verify the profile was updated
      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.conversationProfile).toBeDefined();
      expect(updatedPatient.conversationProfile.personalPreferences.favoriteColor).toBe('blue');
      expect(updatedPatient.conversationProfile.personalPreferences.hobbies).toContain('gardening');
    });

    it('should extract hobbies from user information', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test2@example.com',
        phone: '+16045624264',
        preferredLanguage: 'en'
      });
      await patient.save();

      const userInformation = `User Information:
- Personal Preferences: enjoys reading, loves cooking, interested in photography`;

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567891',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: new Date(),
        endTime: new Date(Date.now() + 120000)
      });
      await conversation.save();

      await conversationService.updatePatientConversationProfile(
        patient._id,
        userInformation,
        conversation._id
      );

      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.conversationProfile.personalPreferences.hobbies).toBeDefined();
      expect(Array.isArray(updatedPatient.conversationProfile.personalPreferences.hobbies)).toBe(true);
    });

    it('should handle user information with no preferences gracefully', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test3@example.com',
        phone: '+16045624265',
        preferredLanguage: 'en'
      });
      await patient.save();

      const userInformation = `User Information:
- Name: Test Patient
- No specific preferences mentioned`;

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567892',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: new Date(),
        endTime: new Date(Date.now() + 120000)
      });
      await conversation.save();

      await conversationService.updatePatientConversationProfile(
        patient._id,
        userInformation,
        conversation._id
      );

      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.conversationProfile).toBeDefined();
      expect(updatedPatient.conversationProfile.personalPreferences).toBeDefined();
    });
  });

  describe('updatePatientConversationProfile', () => {
    it('should create conversation profile if it does not exist', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test4@example.com',
        phone: '+16045624266',
        preferredLanguage: 'en'
      });
      await patient.save();

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567893',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: new Date(),
        updatedAt: new Date(Date.now() + 180000) // 3 minutes
      });
      await conversation.save();

      // Add patient messages with sufficient content
      const messages = [];
      for (let i = 0; i < 5; i++) {
        const message = new Message({
          role: 'patient',
          content: `This is a longer patient message ${i} that contains enough characters to be meaningful for analysis purposes.`,
          conversationId: conversation._id
        });
        await message.save();
        messages.push(message._id);
      }

      conversation.messages = messages;
      await conversation.save();

      const userInformation = `User Information:
- Personal Preferences: favorite color is green, enjoys hiking`;

      await conversationService.updatePatientConversationProfile(
        patient._id,
        userInformation,
        conversation._id
      );

      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.conversationProfile).toBeDefined();
      expect(updatedPatient.conversationProfile.personalPreferences).toBeDefined();
      expect(updatedPatient.conversationProfile.lastUpdated).toBeDefined();
    });

    it('should update existing conversation profile with new information', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test5@example.com',
        phone: '+16045624267',
        preferredLanguage: 'en',
        conversationProfile: {
          personalPreferences: {
            favoriteColor: 'blue',
            hobbies: ['reading']
          },
          lastUpdated: new Date(Date.now() - 86400000) // Yesterday
        }
      });
      await patient.save();

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567894',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: new Date(),
        endTime: new Date(Date.now() + 180000)
      });
      await conversation.save();

      const messages = [];
      for (let i = 0; i < 3; i++) {
        const message = new Message({
          role: 'patient',
          content: `Patient message ${i} with some content`,
          conversationId: conversation._id
        });
        await message.save();
        messages.push(message._id);
      }

      conversation.messages = messages;
      await conversation.save();

      const userInformation = `User Information:
- Personal Preferences: favorite color is red, enjoys cooking and photography`;

      await conversationService.updatePatientConversationProfile(
        patient._id,
        userInformation,
        conversation._id
      );

      const updatedPatient = await Patient.findById(patient._id);
      // New preferences should override old ones
      expect(updatedPatient.conversationProfile.personalPreferences.favoriteColor).toBe('red');
      // Hobbies should be merged/updated
      expect(updatedPatient.conversationProfile.personalPreferences.hobbies).toBeDefined();
      expect(updatedPatient.conversationProfile.lastUpdated.getTime()).toBeGreaterThan(
        patient.conversationProfile.lastUpdated.getTime()
      );
    });

    it('should calculate conversation quality metrics', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test6@example.com',
        phone: '+16045624268',
        preferredLanguage: 'en'
      });
      await patient.save();

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567895',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 300000); // 5 minutes

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: startTime
      });
      await conversation.save();

      // Add multiple patient messages with varying lengths
      const messages = [];
      const messageContents = [
        'This is a short message',
        'This is a much longer patient message that contains more detailed information about their day and how they are feeling',
        'Another message with some content',
        'A detailed response about their health and wellbeing that provides good context',
        'Final message with additional information'
      ];

      for (const content of messageContents) {
        const message = new Message({
          role: 'patient',
          content: content,
          conversationId: conversation._id
        });
        await message.save();
        messages.push(message._id);
      }

      conversation.messages = messages;
      await conversation.save();
      
      // Set updatedAt after all saves to simulate conversation end time
      // Use findByIdAndUpdate to avoid Mongoose timestamps overwriting it
      await Conversation.findByIdAndUpdate(
        conversation._id,
        { $set: { updatedAt: endTime } },
        { timestamps: false }
      );

      await conversationService.updatePatientConversationProfile(
        patient._id,
        'User Information:\n- Personal Preferences: enjoys reading',
        conversation._id
      );

      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.conversationProfile.averageResponseLength).toBeGreaterThan(0);
      expect(updatedPatient.conversationProfile.averageConversationLength).toBeGreaterThan(0);
      expect(updatedPatient.conversationProfile.engagementScore).toBeGreaterThan(0);
      expect(updatedPatient.conversationProfile.engagementScore).toBeLessThanOrEqual(100);
    });

    it('should track optimal call times', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test7@example.com',
        phone: '+16045624269',
        preferredLanguage: 'en'
      });
      await patient.save();

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567896',
        status: 'completed',
        duration: 60
      });
      await call.save();

      // Create conversation at a specific hour (14 = 2 PM)
      const startTime = new Date();
      startTime.setHours(14, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 180000);

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: startTime,
        updatedAt: endTime
      });
      await conversation.save();

      const messages = [];
      for (let i = 0; i < 5; i++) {
        const message = new Message({
          role: 'patient',
          content: `Patient message ${i} with sufficient content for quality scoring`,
          conversationId: conversation._id
        });
        await message.save();
        messages.push(message._id);
      }

      conversation.messages = messages;
      await conversation.save();

      await conversationService.updatePatientConversationProfile(
        patient._id,
        'User Information:\n- Personal Preferences: enjoys gardening',
        conversation._id
      );

      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.conversationProfile.optimalCallTimes).toBeDefined();
      expect(updatedPatient.conversationProfile.optimalCallTimes.length).toBeGreaterThan(0);
      
      const timeEntry = updatedPatient.conversationProfile.optimalCallTimes.find(t => t.hour === 14);
      expect(timeEntry).toBeDefined();
      expect(timeEntry.qualityScore).toBeGreaterThan(0);
      expect(timeEntry.sampleSize).toBe(1);
    });

    it('should update existing optimal call time entry', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test8@example.com',
        phone: '+16045624270',
        preferredLanguage: 'en',
        conversationProfile: {
          optimalCallTimes: [{
            hour: 14,
            qualityScore: 50,
            sampleSize: 2
          }]
        }
      });
      await patient.save();

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567897',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const startTime = new Date();
      startTime.setHours(14, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 180000);

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: startTime,
        updatedAt: endTime
      });
      await conversation.save();

      const messages = [];
      for (let i = 0; i < 5; i++) {
        const message = new Message({
          role: 'patient',
          content: `Patient message ${i} with good content`,
          conversationId: conversation._id
        });
        await message.save();
        messages.push(message._id);
      }

      conversation.messages = messages;
      await conversation.save();

      await conversationService.updatePatientConversationProfile(
        patient._id,
        'User Information:\n- Personal Preferences: enjoys reading',
        conversation._id
      );

      const updatedPatient = await Patient.findById(patient._id);
      const timeEntry = updatedPatient.conversationProfile.optimalCallTimes.find(t => t.hour === 14);
      expect(timeEntry).toBeDefined();
      expect(timeEntry.sampleSize).toBe(3); // Should be incremented from 2
      // Quality score should be recalculated as average
      expect(timeEntry.qualityScore).toBeGreaterThan(0);
    });

    it('should handle missing conversation gracefully', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test9@example.com',
        phone: '+16045624271',
        preferredLanguage: 'en'
      });
      await patient.save();

      const userInformation = `User Information:
- Personal Preferences: favorite color is purple`;

      // Call with non-existent conversation ID
      const fakeConversationId = new mongoose.Types.ObjectId();

      await expect(
        conversationService.updatePatientConversationProfile(
          patient._id,
          userInformation,
          fakeConversationId.toString()
        )
      ).resolves.not.toThrow();

      // Profile should still be updated with preferences
      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.conversationProfile).toBeDefined();
      expect(updatedPatient.conversationProfile.personalPreferences.favoriteColor).toBe('purple');
    });

    it('should use exponential moving average for metrics', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test10@example.com',
        phone: '+16045624272',
        preferredLanguage: 'en',
        conversationProfile: {
          averageResponseLength: 50,
          averageConversationLength: 180,
          engagementScore: 60,
          lastUpdated: new Date()
        }
      });
      await patient.save();

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567898',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 240000); // 4 minutes

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: startTime,
        updatedAt: endTime
      });
      await conversation.save();

      // Add messages with different average length
      const messages = [];
      for (let i = 0; i < 3; i++) {
        const message = new Message({
          role: 'patient',
          content: `This is a longer message with more content ${i}`,
          conversationId: conversation._id
        });
        await message.save();
        messages.push(message._id);
      }

      conversation.messages = messages;
      await conversation.save();

      await conversationService.updatePatientConversationProfile(
        patient._id,
        'User Information:\n- Personal Preferences: enjoys cooking',
        conversation._id
      );

      const updatedPatient = await Patient.findById(patient._id);
      // Should be a weighted average, not just the new value
      expect(updatedPatient.conversationProfile.averageResponseLength).toBeGreaterThan(0);
      expect(updatedPatient.conversationProfile.averageResponseLength).not.toBe(50); // Should have changed
      expect(updatedPatient.conversationProfile.averageConversationLength).toBeGreaterThan(0);
      expect(updatedPatient.conversationProfile.engagementScore).toBeGreaterThan(0);
    });
  });

  describe('buildEnhancedPrompt with conversation profile', () => {
    it('should include conversation profile preferences in prompt', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test11@example.com',
        phone: '+16045624273',
        preferredLanguage: 'en',
        conversationProfile: {
          personalPreferences: {
            favoriteColor: 'blue',
            hobbies: ['gardening', 'reading'],
            rawPreferences: 'enjoys outdoor activities'
          },
          lastUpdated: new Date()
        }
      });
      await patient.save();

      const prompt = await conversationService.buildEnhancedPrompt(patient._id, 'wellness-check');

      expect(prompt).toContain('Favorite color: blue');
      expect(prompt).toContain('Hobbies/interests: gardening, reading');
      expect(prompt).toContain('Other preferences: enjoys outdoor activities');
      expect(prompt).toContain('Use this information naturally in conversation to build rapport');
    });

    it('should include preferred topics in prompt', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test12@example.com',
        phone: '+16045624274',
        preferredLanguage: 'en',
        conversationProfile: {
          preferredTopics: ['gardening', 'family', 'weather'],
          lastUpdated: new Date()
        }
      });
      await patient.save();

      const prompt = await conversationService.buildEnhancedPrompt(patient._id, 'wellness-check');

      expect(prompt).toContain('Topics that have worked well in past conversations: gardening, family, weather');
      expect(prompt).toContain('Consider naturally working these topics into the conversation if appropriate');
    });

    it('should handle patient without conversation profile gracefully', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test13@example.com',
        phone: '+16045624275',
        preferredLanguage: 'en'
      });
      await patient.save();

      const prompt = await conversationService.buildEnhancedPrompt(patient._id, 'wellness-check');

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
      // Should not throw error and should still generate a valid prompt
    });

    it('should handle empty conversation profile gracefully', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test14@example.com',
        phone: '+16045624276',
        preferredLanguage: 'en',
        conversationProfile: {
          personalPreferences: {},
          preferredTopics: [],
          lastUpdated: new Date()
        }
      });
      await patient.save();

      const prompt = await conversationService.buildEnhancedPrompt(patient._id, 'wellness-check');

      expect(prompt).toBeDefined();
      // Should not include preference sections if empty
      expect(prompt).not.toContain('Favorite color:');
      expect(prompt).not.toContain('Hobbies/interests:');
    });
  });

  describe('finalizeConversation with user information extraction', () => {
    it('should call updatePatientConversationProfile when user information is extracted', async () => {
      // This test verifies the integration - that finalizeConversation calls the profile update
      // Full integration testing with actual LangChain calls should be in integration tests
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test15@example.com',
        phone: '+16045624277',
        preferredLanguage: 'en',
        age: 75
      });
      await patient.save();

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567899',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: new Date(),
        endTime: new Date(Date.now() + 180000)
      });
      await conversation.save();

      const messages = [];
      for (let i = 0; i < 3; i++) {
        const message = new Message({
          role: i % 2 === 0 ? 'patient' : 'assistant',
          content: `Message content ${i} with enough text to be meaningful`,
          conversationId: conversation._id
        });
        await message.save();
        messages.push(message._id);
      }

      conversation.messages = messages;
      await conversation.save();

      // Mock the langChainAPI methods
      const langChainAPI = require('../../../src/api/langChainAPI');
      const originalSummarize = langChainAPI.langChainAPI.summarizeConversation;
      const originalExtract = langChainAPI.langChainAPI.extractUserInformation;

      langChainAPI.langChainAPI.summarizeConversation = jest.fn().mockResolvedValue('Test summary');
      langChainAPI.langChainAPI.extractUserInformation = jest.fn().mockResolvedValue(
        `User Information:
- Personal Preferences: favorite color is green, enjoys hiking and photography
- Family Information: Has three grandchildren`
      );

      try {
        const result = await conversationService.finalizeConversation(conversation._id, true);

        // Verify methods were called
        expect(langChainAPI.langChainAPI.summarizeConversation).toHaveBeenCalled();
        expect(langChainAPI.langChainAPI.extractUserInformation).toHaveBeenCalled();

        // Verify user information is in the result
        expect(result.userInformation).toBeDefined();

        // Verify conversation was updated with user information
        const updatedConversation = await Conversation.findById(conversation._id);
        expect(updatedConversation.analyzedData.userInformation).toBeDefined();
        expect(updatedConversation.analyzedData.userInformationExtractedAt).toBeDefined();

        // Verify patient profile was updated (this is the key test)
        const updatedPatient = await Patient.findById(patient._id);
        expect(updatedPatient.conversationProfile).toBeDefined();
        expect(updatedPatient.conversationProfile.personalPreferences.favoriteColor).toBe('green');
      } finally {
        // Restore original functions
        langChainAPI.langChainAPI.summarizeConversation = originalSummarize;
        langChainAPI.langChainAPI.extractUserInformation = originalExtract;
      }
    });

    it('should handle extraction failure gracefully', async () => {
      const patient = new Patient({
        name: 'Test Patient',
        email: 'test16@example.com',
        phone: '+16045624278',
        preferredLanguage: 'en',
        age: 75
      });
      await patient.save();

      const call = new Call({
        patientId: patient._id,
        callSid: 'CA1234567900',
        status: 'completed',
        duration: 60
      });
      await call.save();

      const conversation = new Conversation({
        patientId: patient._id,
        callId: call._id,
        createdAt: new Date(),
        endTime: new Date(Date.now() + 180000)
      });
      await conversation.save();

      const messages = [];
      for (let i = 0; i < 2; i++) {
        const message = new Message({
          role: i % 2 === 0 ? 'patient' : 'assistant',
          content: `Message ${i}`,
          conversationId: conversation._id
        });
        await message.save();
        messages.push(message._id);
      }

      conversation.messages = messages;
      await conversation.save();

      // Mock langChainAPI to fail on extraction
      const langChainAPI = require('../../../src/api/langChainAPI');
      const originalSummarize = langChainAPI.langChainAPI.summarizeConversation;
      const originalExtract = langChainAPI.langChainAPI.extractUserInformation;

      langChainAPI.langChainAPI.summarizeConversation = jest.fn().mockResolvedValue('Test summary');
      langChainAPI.langChainAPI.extractUserInformation = jest.fn().mockRejectedValue(
        new Error('Extraction failed')
      );

      try {
        // Should not throw error - should handle gracefully
        const result = await conversationService.finalizeConversation(conversation._id, true);
        
        expect(result).toBeDefined();
        expect(result.summary).toBe('Test summary');
        // userInformation should be null when extraction fails
        expect(result.userInformation).toBeNull();
      } finally {
        // Restore original functions
        langChainAPI.langChainAPI.summarizeConversation = originalSummarize;
        langChainAPI.langChainAPI.extractUserInformation = originalExtract;
      }
    });
  });
});

