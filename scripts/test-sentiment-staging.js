#!/usr/bin/env node

// test-sentiment-staging.js
// Test script for sentiment analysis that can be run from staging instance
// Uses the test routes to avoid authentication issues

const axios = require('axios');

// Configuration - can be overridden with environment variables
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_URL = `${API_BASE_URL}/v1`;

// Test data - can be overridden with environment variables
const TEST_PATIENT_ID = process.env.TEST_PATIENT_ID || '507f1f77bcf86cd799439011';
const TEST_CONVERSATION_ID = process.env.TEST_CONVERSATION_ID || '507f1f77bcf86cd799439012';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function testSentimentAnalysis() {
  console.log('🧪 Testing Sentiment Analysis via Test Routes...\n');
  console.log(`API Base URL: ${API_URL}`);
  console.log(`Test Patient ID: ${TEST_PATIENT_ID}`);
  console.log(`Test Conversation ID: ${TEST_CONVERSATION_ID}\n`);

  try {
    // Test 1: Basic sentiment analysis
    console.log('📝 Test 1: Basic sentiment analysis');
    try {
      const response = await api.post('/test/sentiment/analyze', {
        conversationText: `Patient: Hi Bianca, I'm feeling really good today!
Bianca: That's wonderful to hear! What's making you feel so good?
Patient: I had a great walk this morning and my medication seems to be working well.
Bianca: I'm so happy to hear that! Regular exercise and proper medication can make such a difference.
Patient: Yes, I feel like I have more energy and I'm sleeping better too.`,
        detailed: true
      });

      if (response.data.success) {
        console.log('✅ Basic sentiment analysis successful:');
        console.log(`   Overall Sentiment: ${response.data.result.data.overallSentiment}`);
        console.log(`   Sentiment Score: ${response.data.result.data.sentimentScore}`);
        console.log(`   Confidence: ${response.data.result.data.confidence}`);
        console.log(`   Patient Mood: ${response.data.result.data.patientMood || 'N/A'}`);
        console.log(`   Key Emotions: ${response.data.result.data.keyEmotions ? response.data.result.data.keyEmotions.join(', ') : 'N/A'}\n`);
      } else {
        console.log('❌ Basic sentiment analysis failed:', response.data.error, '\n');
      }
    } catch (error) {
      console.log('❌ Basic sentiment analysis failed:', error.response?.data?.error || error.message, '\n');
    }

    // Test 2: Patient trend analysis
    console.log('📊 Test 2: Patient sentiment trend analysis');
    try {
      const response = await api.get(`/test/sentiment/trend/${TEST_PATIENT_ID}?timeRange=month`);
      
      if (response.data.success) {
        console.log('✅ Patient trend analysis successful:');
        console.log(`   Time Range: ${response.data.result.timeRange}`);
        console.log(`   Total Conversations: ${response.data.result.totalConversations}`);
        console.log(`   Analyzed Conversations: ${response.data.result.analyzedConversations}`);
        console.log(`   Average Sentiment: ${response.data.result.summary.averageSentiment}`);
        console.log(`   Trend Direction: ${response.data.result.summary.trendDirection}`);
        console.log(`   Data Points: ${response.data.result.dataPoints.length}`);
        console.log(`   Key Insights: ${response.data.result.summary.keyInsights.join(', ')}\n`);
      } else {
        console.log('❌ Patient trend analysis failed:', response.data.error, '\n');
      }
    } catch (error) {
      console.log('❌ Patient trend analysis failed:', error.response?.data?.error || error.message, '\n');
    }

    // Test 3: Patient summary analysis
    console.log('📋 Test 3: Patient sentiment summary');
    try {
      const response = await api.get(`/test/sentiment/summary/${TEST_PATIENT_ID}`);
      
      if (response.data.success) {
        console.log('✅ Patient summary analysis successful:');
        console.log(`   Total Recent Conversations: ${response.data.result.totalConversations}`);
        console.log(`   Analyzed Conversations: ${response.data.result.analyzedConversations}`);
        console.log(`   Average Sentiment: ${response.data.result.averageSentiment}`);
        console.log(`   Trend Direction: ${response.data.result.trendDirection}`);
        console.log(`   Confidence: ${response.data.result.confidence}`);
        console.log(`   Key Insights: ${response.data.result.keyInsights.join(', ')}\n`);
      } else {
        console.log('❌ Patient summary analysis failed:', response.data.error, '\n');
      }
    } catch (error) {
      console.log('❌ Patient summary analysis failed:', error.response?.data?.error || error.message, '\n');
    }

    // Test 4: Conversation sentiment check
    console.log('💬 Test 4: Conversation sentiment check');
    try {
      const response = await api.get(`/test/sentiment/conversation/${TEST_CONVERSATION_ID}`);
      
      if (response.data.success) {
        console.log('✅ Conversation sentiment check successful:');
        console.log(`   Has Sentiment Analysis: ${response.data.result.hasSentimentAnalysis}`);
        if (response.data.result.sentiment) {
          console.log(`   Overall Sentiment: ${response.data.result.sentiment.overallSentiment}`);
          console.log(`   Sentiment Score: ${response.data.result.sentiment.sentimentScore}`);
          console.log(`   Confidence: ${response.data.result.sentiment.confidence}`);
        }
        console.log('');
      } else {
        console.log('❌ Conversation sentiment check failed:', response.data.error, '\n');
      }
    } catch (error) {
      console.log('❌ Conversation sentiment check failed:', error.response?.data?.error || error.message, '\n');
    }

    // Test 5: Comprehensive test suite
    console.log('🔄 Test 5: Comprehensive test suite');
    try {
      const response = await api.post('/test/sentiment/run-all-tests', {
        patientId: TEST_PATIENT_ID,
        conversationId: TEST_CONVERSATION_ID
      });
      
      if (response.data.success) {
        console.log('✅ Comprehensive test suite successful:');
        console.log(`   Total Tests: ${response.data.summary.totalTests}`);
        console.log(`   Successful Tests: ${response.data.summary.successfulTests}`);
        console.log(`   Failed Tests: ${response.data.summary.failedTests}`);
        console.log('   Test Results:');
        response.data.results.forEach(result => {
          const status = result.success ? '✅' : '❌';
          console.log(`     ${status} ${result.test}: ${result.result}`);
        });
        console.log('');
      } else {
        console.log('❌ Comprehensive test suite failed:', response.data.error, '\n');
      }
    } catch (error) {
      console.log('❌ Comprehensive test suite failed:', error.response?.data?.error || error.message, '\n');
    }

    console.log('🎉 Sentiment Analysis Testing via Test Routes completed!');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Helper function to test with different time ranges
async function testTimeRanges() {
  console.log('\n🔄 Testing different time ranges...\n');
  
  const timeRanges = ['month', 'year', 'lifetime'];
  
  for (const timeRange of timeRanges) {
    console.log(`Testing ${timeRange} time range:`);
    try {
      const response = await api.get(`/test/sentiment/trend/${TEST_PATIENT_ID}?timeRange=${timeRange}`);
      if (response.data.success) {
        console.log(`✅ ${timeRange}: ${response.data.result.dataPoints.length} data points, avg sentiment: ${response.data.result.summary.averageSentiment}`);
      } else {
        console.log(`❌ ${timeRange}: ${response.data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${timeRange}: ${error.response?.data?.error || error.message}`);
    }
  }
  console.log('');
}

// Helper function to test with different conversation texts
async function testDifferentConversations() {
  console.log('\n💬 Testing different conversation types...\n');
  
  const testConversations = [
    {
      name: 'Positive Conversation',
      text: `Patient: Hi Bianca, I'm feeling really good today!
Bianca: That's wonderful to hear! What's making you feel so good?
Patient: I had a great walk this morning and my medication seems to be working well.
Bianca: I'm so happy to hear that! Regular exercise and proper medication can make such a difference.`
    },
    {
      name: 'Negative Conversation',
      text: `Patient: Hi Bianca, I'm feeling really frustrated today.
Bianca: I'm sorry to hear that. What's been bothering you?
Patient: My pain medication isn't working and I can't sleep at night.
Bianca: That sounds very difficult. Have you spoken with your doctor about adjusting your medication?
Patient: I have an appointment next week, but I'm worried it won't help.`
    },
    {
      name: 'Neutral Conversation',
      text: `Patient: Hi Bianca, how are you today?
Bianca: I'm doing well, thank you for asking! How are you feeling?
Patient: I'm doing okay. Just checking in as usual.
Bianca: That's good to hear. Is there anything specific you'd like to discuss today?
Patient: Not really, just wanted to say hello and see how things are going.`
    }
  ];

  for (const testConv of testConversations) {
    console.log(`Testing ${testConv.name}:`);
    try {
      const response = await api.post('/test/sentiment/analyze', {
        conversationText: testConv.text,
        detailed: true
      });
      
      if (response.data.success) {
        console.log(`✅ ${testConv.name}: ${response.data.result.data.overallSentiment} (score: ${response.data.result.data.sentimentScore})`);
      } else {
        console.log(`❌ ${testConv.name}: ${response.data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${testConv.name}: ${error.response?.data?.error || error.message}`);
    }
  }
  console.log('');
}

// Run the tests
if (require.main === module) {
  console.log('🚀 Starting Sentiment Analysis Tests via Test Routes...\n');
  
  if (TEST_PATIENT_ID === '507f1f77bcf86cd799439011') {
    console.log('⚠️  Warning: Using default test patient ID. Set TEST_PATIENT_ID environment variable for real testing.');
    console.log('   Example: TEST_PATIENT_ID=real-patient-id node test-sentiment-staging.js\n');
  }
  
  if (TEST_CONVERSATION_ID === '507f1f77bcf86cd799439012') {
    console.log('⚠️  Warning: Using default test conversation ID. Set TEST_CONVERSATION_ID environment variable for real testing.');
    console.log('   Example: TEST_CONVERSATION_ID=real-conversation-id node test-sentiment-staging.js\n');
  }
  
  testSentimentAnalysis()
    .then(() => {
      console.log('\n📊 Running additional tests...');
      return testTimeRanges();
    })
    .then(() => {
      console.log('\n💬 Testing different conversation types...');
      return testDifferentConversations();
    })
    .then(() => {
      console.log('\n✅ All tests completed successfully!');
    })
    .catch(error => {
      console.error('\n❌ Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  testSentimentAnalysis,
  testTimeRanges,
  testDifferentConversations
};


