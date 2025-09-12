#!/usr/bin/env node

// debug-recent-conversation.js
// Script to debug sentiment analysis for recent conversations

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { getOpenAISentimentServiceInstance } = require('../src/services/openai.sentiment.service');

async function debugRecentConversations() {
  console.log('🔍 Debugging Recent Conversations for Sentiment Analysis...\n');

  try {
    // Connect to database
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('✅ Connected to database\n');

    const { Conversation, Message } = require('../src/models');

    // Get recent completed conversations (last 24 hours)
    const recentConversations = await Conversation.find({
      status: 'completed',
      endTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .populate('patientId', 'name')
    .sort({ endTime: -1 })
    .limit(5);

    console.log(`📊 Found ${recentConversations.length} recent completed conversations:\n`);

    for (const conversation of recentConversations) {
      console.log(`🗣️  Conversation ${conversation._id}:`);
      console.log(`   Patient: ${conversation.patientId?.name || 'Unknown'}`);
      console.log(`   End Time: ${conversation.endTime}`);
      console.log(`   Has Sentiment: ${!!conversation.analyzedData?.sentiment}`);
      
      if (conversation.analyzedData?.sentiment) {
        console.log(`   Sentiment: ${conversation.analyzedData.sentiment.overallSentiment}`);
        console.log(`   Score: ${conversation.analyzedData.sentiment.sentimentScore}`);
        console.log(`   Analyzed At: ${conversation.analyzedData.sentimentAnalyzedAt}`);
      } else {
        console.log(`   ❌ No sentiment analysis found`);
        
        // Get messages for this conversation
        const messages = await Message.find({ conversationId: conversation._id })
          .sort({ createdAt: 1 })
          .select('role content createdAt')
          .limit(10);

        console.log(`   📝 Messages (${messages.length} total):`);
        messages.forEach((msg, index) => {
          const speaker = msg.role === 'assistant' ? 'Bianca' : 'Patient';
          console.log(`      ${index + 1}. ${speaker}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        });

        // Try to manually analyze this conversation
        if (messages.length > 0) {
          console.log(`   🔄 Attempting manual sentiment analysis...`);
          
          const conversationText = messages
            .map(msg => {
              const speaker = msg.role === 'assistant' ? 'Bianca' : 'Patient';
              return `${speaker}: ${msg.content}`;
            })
            .join('\n');

          const sentimentService = getOpenAISentimentServiceInstance();
          const result = await sentimentService.analyzeSentiment(conversationText, { detailed: true });
          
          if (result.success) {
            console.log(`   ✅ Manual analysis successful:`);
            console.log(`      Sentiment: ${result.data.overallSentiment}`);
            console.log(`      Score: ${result.data.sentimentScore}`);
            console.log(`      Mood: ${result.data.patientMood || 'N/A'}`);
            
            // Update the conversation with sentiment data
            await Conversation.findByIdAndUpdate(conversation._id, {
              $set: {
                'analyzedData.sentiment': result.data,
                'analyzedData.sentimentAnalyzedAt': new Date()
              }
            });
            console.log(`   💾 Updated conversation with sentiment data`);
          } else {
            console.log(`   ❌ Manual analysis failed: ${result.error}`);
          }
        }
      }
      
      console.log(''); // Empty line for readability
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the debug script
debugRecentConversations().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});

