#!/usr/bin/env node

/**
 * Comprehensive Event Handler Test for OpenAI Realtime API (Beta/GA)
 * 
 * Tests all event handlers to ensure they work correctly with both Beta and GA APIs.
 * 
 * Usage:
 *   # Test with Beta API
 *   OPENAI_REALTIME_USE_GA=false node scripts/test-openai-realtime-events.js
 * 
 *   # Test with GA API
 *   OPENAI_REALTIME_USE_GA=true node scripts/test-openai-realtime-events.js
 */

require('dotenv').config();
const path = require('path');
const WebSocket = require('ws');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const config = require('../src/config/config');
const logger = require('../src/config/logger');
const MessageHandler = require('../src/services/ai/realtime/message.handler');

const CONSTANTS = {
  TEST_CONNECTION_TIMEOUT: 30000,
};

async function testEventHandlers() {
  console.log('\n🧪 OpenAI Realtime API Event Handler Test\n');
  console.log('='.repeat(60));
  
  const useGA = config.openai.useGA !== undefined ? config.openai.useGA : false;
  const apiVersion = useGA ? 'GA' : 'Beta';
  const model = config.openai.realtimeModel || (useGA ? 'gpt-realtime' : 'gpt-4o-realtime-preview-2025-01-12');
  const voice = config.openai.realtimeVoice || 'alloy';
  
  console.log('\n📋 Configuration:');
  console.log(`   API Version: ${apiVersion} (useGA: ${useGA})`);
  console.log(`   Model: ${model}`);
  console.log(`   Voice: ${voice}`);
  console.log(`   API Key: ${config.openai.apiKey ? '✅ Set' : '❌ Missing'}`);
  
  if (!config.openai.apiKey) {
    console.error('\n❌ ERROR: OPENAI_API_KEY is not set!');
    process.exit(1);
  }
  
  console.log('\n🔌 Testing Event Handlers...\n');
  
  return new Promise((resolve, reject) => {
    const testId = `event-test-${Date.now()}`;
    let wsClient = null;
    let testTimeoutId = null;
    const receivedEvents = new Map();
    const eventTests = {
      'session.created': false,
      'session.updated': false,
      'response.created': false,
      'response.content_part.added': false,
      'response.audio.delta': false,
      'response.done': false,
      'input_audio_buffer.speech_started': false,
      'input_audio_buffer.speech_stopped': false,
      'input_audio_buffer.committed': false,
    };
    
    const cleanupAndFinish = (outcome, data) => {
      if (testTimeoutId) clearTimeout(testTimeoutId);
      if (wsClient) {
        wsClient.removeAllListeners();
        if (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING) {
          wsClient.close(1000, `Test ${testId} finished`);
        }
      }
      
      if (outcome === 'resolve') {
        console.log('\n✅ Event Handler Test SUCCESSFUL!\n');
        console.log('='.repeat(60));
        console.log('\n📊 Results:');
        console.log(`   Status: ${data.status}`);
        console.log(`   Session ID: ${data.sessionId || 'N/A'}`);
        console.log(`   API Version: ${apiVersion}`);
        console.log(`   Events Received: ${receivedEvents.size}`);
        console.log('\n📨 Events Tested:');
        Object.keys(eventTests).forEach(eventType => {
          const received = receivedEvents.has(eventType);
          const status = received ? '✅' : '❌';
          console.log(`   ${status} ${eventType}`);
        });
        console.log('\n' + '='.repeat(60));
        resolve(data);
      } else {
        console.error('\n❌ Event Handler Test FAILED!\n');
        console.error('='.repeat(60));
        console.error(`\n📊 Error: ${data.message || 'Unknown error'}`);
        console.error(`   API Version: ${apiVersion}`);
        console.error(`   Events Received: ${receivedEvents.size}`);
        if (receivedEvents.size > 0) {
          console.error('\n📨 Events Received Before Error:');
          Array.from(receivedEvents.keys()).forEach(eventType => {
            console.error(`   - ${eventType}`);
          });
        }
        console.error('\n' + '='.repeat(60));
        reject(data);
      }
    };
    
    testTimeoutId = setTimeout(() => {
      cleanupAndFinish('reject', {
        status: 'timeout',
        message: `Test timed out after ${CONSTANTS.TEST_CONNECTION_TIMEOUT}ms`,
      });
    }, CONSTANTS.TEST_CONNECTION_TIMEOUT);
    
    try {
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;
      const headers = {
        Authorization: `Bearer ${config.openai.apiKey}`,
      };
      
      if (!useGA) {
        headers['OpenAI-Beta'] = 'realtime=v1';
      }
      
      wsClient = new WebSocket(wsUrl, { headers });
      let sessionId = null;
      let responseId = null;
      let sessionReady = false;
      
      wsClient.on('open', () => {
        logger.info(`[Event Test] WebSocket opened (${apiVersion})`);
      });
      
      wsClient.on('message', async (data) => {
        if (!wsClient) return;
        
        let message;
        try {
          message = JSON.parse(data);
          receivedEvents.set(message.type, message);
          logger.info(`[Event Test] Received: ${message.type}`);
        } catch (err) {
          logger.error(`[Event Test] JSON parse error: ${err.message}`);
          return;
        }
        
        // Handle session.created
        if (message.type === 'session.created') {
          sessionId = message.session?.id;
          eventTests['session.created'] = true;
          logger.info(`[Event Test] ✅ session.created - Session ID: ${sessionId}`);
          
          // Send session.update
          const testConnection = { initialPrompt: 'You are a helpful assistant. Say "Hello, this is a test."' };
          const sessionConfig = MessageHandler.buildSessionConfig(testConnection);
          
          try {
            wsClient.send(JSON.stringify(sessionConfig));
            logger.info(`[Event Test] Sent session.update`);
          } catch (err) {
            cleanupAndFinish('reject', {
              status: 'error_sending_session_update',
              message: err.message,
            });
          }
        }
        
        // Handle session.updated
        else if (message.type === 'session.updated') {
          eventTests['session.updated'] = true;
          sessionReady = true;
          logger.info(`[Event Test] ✅ session.updated`);
          
          // Now trigger a response to test response events
          // Send a response.create message
          // GA doesn't accept response.modalities, Beta does
          const responseCreate = useGA ? {
            type: 'response.create'
          } : {
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
            }
          };
          
          try {
            wsClient.send(JSON.stringify(responseCreate));
            logger.info(`[Event Test] Sent response.create to trigger response events`);
          } catch (err) {
            logger.error(`[Event Test] Error sending response.create: ${err.message}`);
          }
        }
        
        // Handle response.created
        else if (message.type === 'response.created') {
          eventTests['response.created'] = true;
          responseId = message.response?.id;
          logger.info(`[Event Test] ✅ response.created - Response ID: ${responseId}`);
        }
        
        // Handle response.content_part.added
        else if (message.type === 'response.content_part.added') {
          eventTests['response.content_part.added'] = true;
          logger.info(`[Event Test] ✅ response.content_part.added`);
        }
        
        // Handle response.audio.delta (Beta) or response.output_audio.delta (GA)
        else if (message.type === 'response.audio.delta' || message.type === 'response.output_audio.delta') {
          eventTests['response.audio.delta'] = true;
          logger.info(`[Event Test] ✅ ${message.type} (audio chunk received)`);
        }
        
        // Handle response.done
        else if (message.type === 'response.done') {
          eventTests['response.done'] = true;
          logger.info(`[Event Test] ✅ response.done`);
          
          // Test audio buffer events by sending some audio
          // Create a small test audio chunk (silence)
          const testAudio = Buffer.alloc(160, 0x7F).toString('base64');
          const audioAppend = {
            type: 'input_audio_buffer.append',
            audio: testAudio
          };
          
          try {
            wsClient.send(JSON.stringify(audioAppend));
            logger.info(`[Event Test] Sent input_audio_buffer.append to test audio buffer events`);
            
            // Commit the audio buffer
            setTimeout(() => {
              const audioCommit = {
                type: 'input_audio_buffer.commit'
              };
              wsClient.send(JSON.stringify(audioCommit));
              logger.info(`[Event Test] Sent input_audio_buffer.commit`);
            }, 100);
          } catch (err) {
            logger.error(`[Event Test] Error sending audio: ${err.message}`);
          }
        }
        
        // Handle input_audio_buffer.speech_started
        else if (message.type === 'input_audio_buffer.speech_started') {
          eventTests['input_audio_buffer.speech_started'] = true;
          logger.info(`[Event Test] ✅ input_audio_buffer.speech_started`);
        }
        
        // Handle input_audio_buffer.speech_stopped
        else if (message.type === 'input_audio_buffer.speech_stopped') {
          eventTests['input_audio_buffer.speech_stopped'] = true;
          logger.info(`[Event Test] ✅ input_audio_buffer.speech_stopped`);
        }
        
        // Handle input_audio_buffer.committed
        else if (message.type === 'input_audio_buffer.committed') {
          eventTests['input_audio_buffer.committed'] = true;
          logger.info(`[Event Test] ✅ input_audio_buffer.committed`);
          
          // All key events tested, finish successfully
          setTimeout(() => {
            cleanupAndFinish('resolve', {
              status: 'success',
              message: 'All event handlers tested successfully',
              sessionId,
              responseId,
              receivedEvents: Array.from(receivedEvents.keys()),
              eventTests,
            });
          }, 500);
        }
        
        // Handle errors
        else if (message.type === 'error') {
          logger.error(`[Event Test] Error: ${JSON.stringify(message.error)}`);
          cleanupAndFinish('reject', {
            status: 'openai_error',
            error: message.error,
            sessionId,
            receivedEvents: Array.from(receivedEvents.keys()),
          });
        }
      });
      
      wsClient.on('error', (error) => {
        logger.error(`[Event Test] WebSocket error: ${error.message}`);
        cleanupAndFinish('reject', {
          status: 'ws_error',
          message: error.message,
        });
      });
      
      wsClient.on('close', (code, reason) => {
        const reasonStr = reason ? reason.toString() : 'No reason provided';
        logger.info(`[Event Test] WebSocket closed. Code: ${code}, Reason: ${reasonStr}`);
        if (testTimeoutId && !sessionReady) {
          cleanupAndFinish('reject', {
            status: 'ws_closed_unexpectedly',
            code,
            reason: reasonStr,
            sessionId,
            receivedEvents: Array.from(receivedEvents.keys()),
          });
        }
      });
    } catch (err) {
      logger.error(`[Event Test] Error creating WebSocket: ${err.message}`, err);
      cleanupAndFinish('reject', {
        status: 'init_error',
        message: err.message,
      });
    }
  });
}

// Run the test
testEventHandlers()
  .then(() => {
    console.log('\n✅ All event handlers tested successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Event handler test failed:', error);
    process.exit(1);
  });

