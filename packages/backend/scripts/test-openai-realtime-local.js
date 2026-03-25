#!/usr/bin/env node

/**
 * Local Testing Script for OpenAI Realtime API (Beta/GA Migration)
 * 
 * This script allows you to test the OpenAI Realtime API connection locally
 * without needing to deploy to staging or make a real phone call.
 * 
 * Usage:
 *   # Test with current config (Beta or GA based on OPENAI_REALTIME_USE_GA)
 *   node scripts/test-openai-realtime-local.js
 * 
 *   # Test with Beta API explicitly
 *   OPENAI_REALTIME_USE_GA=false node scripts/test-openai-realtime-local.js
 * 
 *   # Test with GA API explicitly
 *   OPENAI_REALTIME_USE_GA=true node scripts/test-openai-realtime-local.js
 * 
 *   # Test with specific transcription model
 *   OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-transcribe OPENAI_REALTIME_USE_GA=true node scripts/test-openai-realtime-local.js
 *
 * To exercise user transcript + placeholder logic without a phone call (mocked OpenAI payloads + Mongo memory):
 *   yarn test tests/unit/services/openai.realtime.user-transcript.mock.test.js
 */

require('dotenv').config();
const path = require('path');

// Set up environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Load config after setting NODE_ENV
const config = require('../src/config/config');
const logger = require('../src/config/logger');
const OpenAIRealtimeService = require('../src/services/openai.realtime.service').OpenAIRealtimeService;

async function testConnection() {
  console.log('\n🧪 OpenAI Realtime API Connection Test (Local)\n');
  console.log('='.repeat(60));
  
  // Check configuration
  const useGA = config.openai.useGA !== undefined ? config.openai.useGA : false;
  const apiVersion = useGA ? 'GA' : 'Beta';
  // Model is auto-selected: gpt-realtime for GA, gpt-4o-realtime-preview-2025-01-12 for Beta
  const model = config.openai.realtimeModel || (useGA ? 'gpt-realtime' : 'gpt-4o-realtime-preview-2025-01-12');
  const transcriptionModel = config.openai.realtimeTranscriptionModel || 'gpt-4o-mini-transcribe';
  const voice = config.openai.realtimeVoice || 'alloy';
  
  console.log('\n📋 Configuration:');
  console.log(`   API Version: ${apiVersion} (useGA: ${useGA})`);
  console.log(`   Model: ${model}`);
  console.log(`   Transcription Model: ${transcriptionModel}`);
  console.log(`   Voice: ${voice}`);
  console.log(`   API Key: ${config.openai.apiKey ? '✅ Set' : '❌ Missing'}`);
  
  if (!config.openai.apiKey) {
    console.error('\n❌ ERROR: OPENAI_API_KEY is not set!');
    console.error('   Set it in your .env file or environment variables.');
    process.exit(1);
  }
  
  console.log('\n🔌 Testing Connection...\n');
  
  try {
    const service = new OpenAIRealtimeService();
    const testId = `local-test-${Date.now()}`;
    
    console.log(`   Test ID: ${testId}`);
    console.log(`   Connecting to OpenAI Realtime API (${apiVersion})...\n`);
    
    const result = await service.testBasicConnectionAndSession(testId);
    
    console.log('\n✅ Connection Test SUCCESSFUL!\n');
    console.log('='.repeat(60));
    console.log('\n📊 Results:');
    console.log(`   Status: ${result.status}`);
    console.log(`   Session ID: ${result.sessionId || 'N/A'}`);
    console.log(`   API Version: ${apiVersion}`);
    console.log(`   Messages Received: ${result.receivedMessages?.length || 0}`);
    
    if (result.sessionDetails) {
      console.log('\n📝 Session Details:');
      console.log(`   Model: ${result.sessionDetails.session?.model || 'N/A'}`);
      console.log(`   Voice: ${result.sessionDetails.session?.voice || 'N/A'}`);
      if (useGA) {
        console.log(`   Audio Input Format: ${result.sessionDetails.session?.audio?.input?.format?.type || 'N/A'}`);
        console.log(`   Audio Output Format: ${result.sessionDetails.session?.audio?.output?.format?.type || 'N/A'}`);
        console.log(`   Transcription Model: ${result.sessionDetails.session?.audio?.input?.transcription?.model || 'N/A'}`);
      } else {
        console.log(`   Input Audio Format: ${result.sessionDetails.session?.input_audio_format || 'N/A'}`);
        console.log(`   Output Audio Format: ${result.sessionDetails.session?.output_audio_format || 'N/A'}`);
        console.log(`   Transcription Model: ${result.sessionDetails.session?.input_audio_transcription?.model || 'N/A'}`);
      }
    }
    
    if (result.receivedMessages && result.receivedMessages.length > 0) {
      console.log('\n📨 Received Messages:');
      result.receivedMessages.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. ${msg.type} (${msg.timestamp})`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test completed successfully!\n');
    
    // Verify API version matches expectations
    if (useGA && result.sessionDetails) {
      const hasGAFormat = result.sessionDetails.session?.audio?.input?.format;
      if (hasGAFormat) {
        console.log('✅ GA format confirmed - session.audio structure present');
      } else {
        console.log('⚠️  WARNING: Using GA but session structure looks like Beta format');
      }
    } else if (!useGA && result.sessionDetails) {
      const hasBetaFormat = result.sessionDetails.session?.input_audio_format;
      if (hasBetaFormat) {
        console.log('✅ Beta format confirmed - input_audio_format present');
      } else {
        console.log('⚠️  WARNING: Using Beta but session structure looks like GA format');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection Test FAILED!\n');
    console.error('='.repeat(60));
    console.error('\n📊 Error Details:');
    console.error(`   Status: ${error.status || 'error'}`);
    console.error(`   Message: ${error.message || 'Unknown error'}`);
    console.error(`   API Version: ${apiVersion}`);
    
    if (error.receivedMessages && error.receivedMessages.length > 0) {
      console.error('\n📨 Messages Received Before Error:');
      error.receivedMessages.forEach((msg, idx) => {
        console.error(`   ${idx + 1}. ${msg.type} (${msg.timestamp})`);
      });
    }
    
    console.error('\n' + '='.repeat(60));
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that OPENAI_API_KEY is set correctly');
    console.error('   2. Verify your OpenAI account has access to Realtime API');
    console.error('   3. Check network connectivity');
    console.error('   4. Review logs above for specific error details');
    console.error('   5. Try switching API version:');
    console.error(`      OPENAI_REALTIME_USE_GA=${!useGA} node scripts/test-openai-realtime-local.js\n`);
    
    process.exit(1);
  }
}

// Run the test
testConnection().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

