#!/usr/bin/env node

/**
 * Local Testing Script for OpenAI Sentiment Analysis
 *
 * Tests the sentiment analysis service locally without deploying or running
 * a full call. Requires OPENAI_API_KEY in .env or environment.
 *
 * Usage:
 *   # From repo root (or packages/backend with .env present)
 *   yarn workspace @bianca-app/backend test:sentiment:local
 *
 *   # Or from packages/backend
 *   node scripts/test-sentiment-local.js
 *
 *   # With sample text override
 *   SENTIMENT_SAMPLE="Patient: I'm feeling great today. Bianca: That's wonderful to hear."
 *   node scripts/test-sentiment-local.js
 *
 *   # Test with a conversation ID (requires MongoDB running and a real conversation)
 *   MONGODB_URL=mongodb://localhost:27017/bianca-app node scripts/test-sentiment-local.js <conversationId>
 */

require('dotenv').config();
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Ensure we load .env from packages/backend if running from repo root
const backendRoot = path.resolve(__dirname, '..');
try {
  require('dotenv').config({ path: path.join(backendRoot, '.env') });
} catch (_) {}

const config = require('../src/config/config');
const { getOpenAISentimentServiceInstance } = require('../src/services/openai.sentiment.service');

const DEFAULT_SAMPLE = `Patient: I've been having trouble sleeping lately. I wake up at 3 AM and can't get back to sleep.
Bianca: I'm sorry to hear that. How long has this been going on?
Patient: About two weeks. I'm also feeling more anxious during the day.
Bianca: That sounds really challenging. Have you tried any relaxation techniques before bed?
Patient: I tried reading but it doesn't help much. I'm worried about work.
Bianca: It's common for stress to affect sleep. Would you like to talk through some options that might help?`;

async function main() {
  console.log('\n🧪 OpenAI Sentiment Analysis – Local Test\n');
  console.log('='.repeat(60));

  console.log('\n📋 Configuration:');
  console.log(`   API Key: ${config.openai?.apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Model: ${config.openai?.model || 'gpt-4o'}`);

  if (!config.openai?.apiKey) {
    console.error('\n❌ ERROR: OPENAI_API_KEY is not set.');
    console.error('   Add it to packages/backend/.env or set the environment variable.');
    process.exit(1);
  }

  const conversationId = process.argv[2];
  const sampleText = process.env.SENTIMENT_SAMPLE || DEFAULT_SAMPLE;

  try {
    const service = getOpenAISentimentServiceInstance();

    if (conversationId) {
      console.log(`\n🔍 Analyzing conversation by ID: ${conversationId}`);
      console.log('   (Requires MongoDB with that conversation and messages.)\n');
      const result = await service.analyzeConversationSentiment(conversationId, { detailed: true });
      if (result.success) {
        console.log('✅ Sentiment analysis succeeded:\n');
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.error('❌ Sentiment analysis failed:', result.error);
        process.exit(1);
      }
      return;
    }

    console.log('\n📝 Analyzing sample conversation text...\n');
    const result = await service.analyzeSentiment(sampleText, { detailed: true });

    if (result.success) {
      console.log('✅ Sentiment analysis succeeded:\n');
      console.log(JSON.stringify(result.data, null, 2));
      console.log('\n   Model:', result.model);
      console.log('   Conversation length:', result.conversationLength, 'chars');
    } else {
      console.error('❌ Sentiment analysis failed:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.response) {
      console.error('   API status:', err.response?.status);
      console.error('   API body:', err.response?.data ? JSON.stringify(err.response.data, null, 2) : '(none)');
    }
    process.exit(1);
  }
}

main();
