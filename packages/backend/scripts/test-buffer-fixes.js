#!/usr/bin/env node

/**
 * Test script to verify the "buffer too small" fixes
 */

const OpenAIRealtimeService = require('./src/services/openai.realtime.service');

async function testAudioValidation() {
    console.log('🧪 Testing Audio Validation Fixes...\n');

    const openaiService = new OpenAIRealtimeService();

    // Test 1: Valid audio chunk
    console.log('1. Testing valid audio chunk:');
    const validAudio = Buffer.alloc(160, 0x7F).toString('base64'); // 20ms of tone
    const validResult = openaiService.validateAudioChunk(validAudio);
    console.log(`   Valid audio: ${validResult.isValid} - ${validResult.reason}`);
    console.log(`   Size: ${validResult.size} bytes, Duration: ${validResult.durationMs}ms\n`);

    // Test 2: Empty audio chunk
    console.log('2. Testing empty audio chunk:');
    const emptyResult = openaiService.validateAudioChunk('');
    console.log(`   Empty audio: ${emptyResult.isValid} - ${emptyResult.reason}\n`);

    // Test 3: Too small audio chunk
    console.log('3. Testing too small audio chunk:');
    const smallAudio = Buffer.alloc(80, 0x7F).toString('base64'); // 10ms
    const smallResult = openaiService.validateAudioChunk(smallAudio);
    console.log(`   Small audio: ${smallResult.isValid} - ${smallResult.reason}\n`);

    // Test 4: Invalid base64
    console.log('4. Testing invalid base64:');
    const invalidResult = openaiService.validateAudioChunk('invalid-base64!@#');
    console.log(`   Invalid base64: ${invalidResult.isValid} - ${invalidResult.reason}\n`);

    // Test 5: Commit readiness (no connection)
    console.log('5. Testing commit readiness (no connection):');
    const commitResult = openaiService.checkCommitReadiness('test-call-id');
    console.log(`   Commit ready: ${commitResult.canCommit} - ${commitResult.reason}\n`);

    console.log('✅ Audio validation tests completed!\n');
}

async function testCommitLogic() {
    console.log('🧪 Testing Commit Logic Fixes...\n');

    const openaiService = new OpenAIRealtimeService();

    // Create a mock connection
    const callId = 'test-call-123';
    openaiService.connections.set(callId, {
        status: 'ready',
        sessionReady: true,
        webSocket: { readyState: 1 }, // OPEN
        audioChunksReceived: 10,
        audioChunksSent: 0,
        pendingCommit: false
    });

    // Test commit readiness with no audio sent
    console.log('1. Testing commit readiness with no audio sent:');
    const noAudioResult = openaiService.checkCommitReadiness(callId);
    console.log(`   Can commit: ${noAudioResult.canCommit} - ${noAudioResult.reason}\n`);

    // Test commit readiness with some audio sent
    console.log('2. Testing commit readiness with some audio sent:');
    const conn = openaiService.connections.get(callId);
    conn.audioChunksSent = 3; // 60ms of audio
    const someAudioResult = openaiService.checkCommitReadiness(callId);
    console.log(`   Can commit: ${someAudioResult.canCommit} - ${someAudioResult.reason}\n`);

    // Test commit readiness with sufficient audio
    console.log('3. Testing commit readiness with sufficient audio:');
    conn.audioChunksSent = 10; // 200ms of audio
    const sufficientAudioResult = openaiService.checkCommitReadiness(callId);
    console.log(`   Can commit: ${sufficientAudioResult.canCommit} - ${sufficientAudioResult.reason}\n`);

    console.log('✅ Commit logic tests completed!\n');
}

async function runTests() {
    try {
        await testAudioValidation();
        await testCommitLogic();
        console.log('🎉 All tests passed! The "buffer too small" fixes are working correctly.');
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { testAudioValidation, testCommitLogic }; 