#!/usr/bin/env node

// test-sentiment-api.js
// Test script for sentiment analysis API endpoints

const axios = require('axios');
const config = require('../src/config/config');

// Configuration
const API_BASE_URL = config.baseUrl || 'http://localhost:3000';
const API_URL = `${API_BASE_URL}/v1`;

// You'll need to set these for testing
const TEST_PATIENT_ID = process.env.TEST_PATIENT_ID || '507f1f77bcf86cd799439011'; // Replace with actual patient ID
const TEST_CONVERSATION_ID = process.env.TEST_CONVERSATION_ID || '507f1f77bcf86cd799439012'; // Replace with actual conversation ID
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-jwt-token-here'; // Replace with actual JWT token

// Create axios instance with auth headers
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testSentimentAPI() {
  console.log('🧪 Testing Sentiment Analysis API Endpoints...\n');
  console.log(`API Base URL: ${API_URL}`);
  console.log(`Test Patient ID: ${TEST_PATIENT_ID}`);
  console.log(`Test Conversation ID: ${TEST_CONVERSATION_ID}\n`);

  try {
    // Test 1: Get sentiment trend for a patient
    console.log('📊 Test 1: Get sentiment trend for a patient (month)');
    try {
      const trendResponse = await api.get(`/sentiment/patient/${TEST_PATIENT_ID}/trend?timeRange=month`);
      console.log('✅ Sentiment trend retrieved successfully:');
      console.log(`   Time Range: ${trendResponse.data.timeRange}`);
      console.log(`   Total Conversations: ${trendResponse.data.totalConversations}`);
      console.log(`   Analyzed Conversations: ${trendResponse.data.analyzedConversations}`);
      console.log(`   Average Sentiment: ${trendResponse.data.summary.averageSentiment}`);
      console.log(`   Trend Direction: ${trendResponse.data.summary.trendDirection}`);
      console.log(`   Data Points: ${trendResponse.data.dataPoints.length}`);
      console.log(`   Key Insights: ${trendResponse.data.summary.keyInsights.join(', ')}\n`);
    } catch (error) {
      console.log('❌ Sentiment trend test failed:', error.response?.data?.message || error.message, '\n');
    }

    // Test 2: Get sentiment trend for different time ranges
    console.log('📊 Test 2: Get sentiment trend for different time ranges');
    const timeRanges = ['month', 'year', 'lifetime'];
    
    for (const timeRange of timeRanges) {
      try {
        const trendResponse = await api.get(`/sentiment/patient/${TEST_PATIENT_ID}/trend?timeRange=${timeRange}`);
        console.log(`✅ ${timeRange} trend: ${trendResponse.data.dataPoints.length} data points, avg sentiment: ${trendResponse.data.summary.averageSentiment}`);
      } catch (error) {
        console.log(`❌ ${timeRange} trend failed:`, error.response?.data?.message || error.message);
      }
    }
    console.log('');

    // Test 3: Get sentiment summary for a patient
    console.log('📋 Test 3: Get sentiment summary for a patient');
    try {
      const summaryResponse = await api.get(`/sentiment/patient/${TEST_PATIENT_ID}/summary`);
      console.log('✅ Sentiment summary retrieved successfully:');
      console.log(`   Total Recent Conversations: ${summaryResponse.data.totalConversations}`);
      console.log(`   Analyzed Conversations: ${summaryResponse.data.analyzedConversations}`);
      console.log(`   Average Sentiment: ${summaryResponse.data.averageSentiment}`);
      console.log(`   Trend Direction: ${summaryResponse.data.trendDirection}`);
      console.log(`   Confidence: ${summaryResponse.data.confidence}`);
      console.log(`   Key Insights: ${summaryResponse.data.keyInsights.join(', ')}\n`);
    } catch (error) {
      console.log('❌ Sentiment summary test failed:', error.response?.data?.message || error.message, '\n');
    }

    // Test 4: Get sentiment for a specific conversation
    console.log('💬 Test 4: Get sentiment for a specific conversation');
    try {
      const conversationResponse = await api.get(`/sentiment/conversation/${TEST_CONVERSATION_ID}`);
      console.log('✅ Conversation sentiment retrieved successfully:');
      console.log(`   Has Sentiment Analysis: ${conversationResponse.data.hasSentimentAnalysis}`);
      if (conversationResponse.data.sentiment) {
        console.log(`   Overall Sentiment: ${conversationResponse.data.sentiment.overallSentiment}`);
        console.log(`   Sentiment Score: ${conversationResponse.data.sentiment.sentimentScore}`);
        console.log(`   Confidence: ${conversationResponse.data.sentiment.confidence}`);
        console.log(`   Patient Mood: ${conversationResponse.data.sentiment.patientMood || 'N/A'}`);
      }
      console.log('');
    } catch (error) {
      console.log('❌ Conversation sentiment test failed:', error.response?.data?.message || error.message, '\n');
    }

    // Test 5: Trigger sentiment analysis for a conversation
    console.log('🔄 Test 5: Trigger sentiment analysis for a conversation');
    try {
      const analyzeResponse = await api.post(`/sentiment/conversation/${TEST_CONVERSATION_ID}/analyze`);
      console.log('✅ Sentiment analysis triggered successfully:');
      console.log(`   Success: ${analyzeResponse.data.success}`);
      console.log(`   Overall Sentiment: ${analyzeResponse.data.sentiment.overallSentiment}`);
      console.log(`   Sentiment Score: ${analyzeResponse.data.sentiment.sentimentScore}`);
      console.log(`   Confidence: ${analyzeResponse.data.sentiment.confidence}`);
      console.log(`   Analyzed At: ${analyzeResponse.data.analyzedAt}\n`);
    } catch (error) {
      console.log('❌ Sentiment analysis trigger test failed:', error.response?.data?.message || error.message, '\n');
    }

    // Test 6: Test error handling with invalid parameters
    console.log('🚫 Test 6: Test error handling with invalid parameters');
    try {
      await api.get(`/sentiment/patient/${TEST_PATIENT_ID}/trend?timeRange=invalid`);
      console.log('❌ Should have failed with invalid timeRange');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correctly rejected invalid timeRange parameter\n');
      } else {
        console.log('❌ Unexpected error:', error.response?.data?.message || error.message, '\n');
      }
    }

    console.log('🎉 Sentiment Analysis API testing completed!');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Helper function to test with different patient IDs
async function testWithMultiplePatients() {
  console.log('\n🔄 Testing with multiple patients...\n');
  
  const patientIds = [
    '507f1f77bcf86cd799439011',
    '507f1f77bcf86cd799439012',
    '507f1f77bcf86cd799439013'
  ];

  for (const patientId of patientIds) {
    console.log(`Testing patient: ${patientId}`);
    try {
      const summaryResponse = await api.get(`/sentiment/patient/${patientId}/summary`);
      console.log(`✅ Patient ${patientId}: ${summaryResponse.data.analyzedConversations} analyzed conversations`);
    } catch (error) {
      console.log(`❌ Patient ${patientId}: ${error.response?.data?.message || error.message}`);
    }
  }
}

// Run the tests
if (require.main === module) {
  console.log('🚀 Starting Sentiment Analysis API Tests...\n');
  
  if (AUTH_TOKEN === 'your-jwt-token-here') {
    console.log('⚠️  Warning: Please set AUTH_TOKEN environment variable with a valid JWT token');
    console.log('   Example: AUTH_TOKEN=your-jwt-token node test-sentiment-api.js\n');
  }
  
  if (TEST_PATIENT_ID === '507f1f77bcf86cd799439011') {
    console.log('⚠️  Warning: Please set TEST_PATIENT_ID environment variable with a real patient ID');
    console.log('   Example: TEST_PATIENT_ID=real-patient-id node test-sentiment-api.js\n');
  }
  
  testSentimentAPI()
    .then(() => {
      console.log('\n📊 Running additional tests...');
      return testWithMultiplePatients();
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
  testSentimentAPI,
  testWithMultiplePatients
};
