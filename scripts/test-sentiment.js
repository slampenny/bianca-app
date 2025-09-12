#!/usr/bin/env node

// test-sentiment.js
// Simple script to test the sentiment analysis service

const { getOpenAISentimentServiceInstance } = require('../src/services/openai.sentiment.service');

async function testSentimentAnalysis() {
  console.log('🧪 Testing OpenAI Sentiment Analysis Service...\n');

  const sentimentService = getOpenAISentimentServiceInstance();

  // Test conversation with positive sentiment
  const positiveConversation = `
    Patient: Hi Bianca, I'm feeling really good today!
    Bianca: That's wonderful to hear! What's making you feel so good?
    Patient: I had a great walk this morning and my medication seems to be working well.
    Bianca: I'm so happy to hear that! Regular exercise and proper medication can make such a difference.
    Patient: Yes, I feel like I have more energy and I'm sleeping better too.
    Bianca: That's fantastic! It sounds like you're taking great care of yourself.
  `;

  console.log('📝 Testing positive sentiment conversation...');
  const positiveResult = await sentimentService.analyzeSentiment(positiveConversation, { detailed: true });
  
  if (positiveResult.success) {
    console.log('✅ Positive sentiment analysis successful:');
    console.log(`   Overall Sentiment: ${positiveResult.data.overallSentiment}`);
    console.log(`   Sentiment Score: ${positiveResult.data.sentimentScore}`);
    console.log(`   Confidence: ${positiveResult.data.confidence}`);
    console.log(`   Patient Mood: ${positiveResult.data.patientMood || 'N/A'}`);
    console.log(`   Key Emotions: ${positiveResult.data.keyEmotions ? positiveResult.data.keyEmotions.join(', ') : 'N/A'}`);
    console.log(`   Summary: ${positiveResult.data.summary}\n`);
  } else {
    console.log('❌ Positive sentiment analysis failed:', positiveResult.error, '\n');
  }

  // Test conversation with negative sentiment
  const negativeConversation = `
    Patient: Hi Bianca, I'm feeling really frustrated today.
    Bianca: I'm sorry to hear that. What's been bothering you?
    Patient: My pain medication isn't working and I can't sleep at night.
    Bianca: That sounds very difficult. Have you spoken with your doctor about adjusting your medication?
    Patient: I have an appointment next week, but I'm worried it won't help.
    Bianca: I understand your concerns. It's important to communicate with your healthcare team.
  `;

  console.log('📝 Testing negative sentiment conversation...');
  const negativeResult = await sentimentService.analyzeSentiment(negativeConversation, { detailed: true });
  
  if (negativeResult.success) {
    console.log('✅ Negative sentiment analysis successful:');
    console.log(`   Overall Sentiment: ${negativeResult.data.overallSentiment}`);
    console.log(`   Sentiment Score: ${negativeResult.data.sentimentScore}`);
    console.log(`   Confidence: ${negativeResult.data.confidence}`);
    console.log(`   Patient Mood: ${negativeResult.data.patientMood || 'N/A'}`);
    console.log(`   Key Emotions: ${negativeResult.data.keyEmotions ? negativeResult.data.keyEmotions.join(', ') : 'N/A'}`);
    console.log(`   Concern Level: ${negativeResult.data.concernLevel || 'N/A'}`);
    console.log(`   Summary: ${negativeResult.data.summary}\n`);
  } else {
    console.log('❌ Negative sentiment analysis failed:', negativeResult.error, '\n');
  }

  // Test conversation with neutral sentiment
  const neutralConversation = `
    Patient: Hi Bianca, how are you today?
    Bianca: I'm doing well, thank you for asking! How are you feeling?
    Patient: I'm doing okay. Just checking in as usual.
    Bianca: That's good to hear. Is there anything specific you'd like to discuss today?
    Patient: Not really, just wanted to say hello and see how things are going.
    Bianca: That's perfectly fine. I'm here whenever you need to talk.
  `;

  console.log('📝 Testing neutral sentiment conversation...');
  const neutralResult = await sentimentService.analyzeSentiment(neutralConversation, { detailed: false });
  
  if (neutralResult.success) {
    console.log('✅ Neutral sentiment analysis successful:');
    console.log(`   Overall Sentiment: ${neutralResult.data.overallSentiment}`);
    console.log(`   Sentiment Score: ${neutralResult.data.sentimentScore}`);
    console.log(`   Confidence: ${neutralResult.data.confidence}`);
    console.log(`   Summary: ${neutralResult.data.summary}\n`);
  } else {
    console.log('❌ Neutral sentiment analysis failed:', neutralResult.error, '\n');
  }

  console.log('🎉 Sentiment analysis testing completed!');
}

// Run the test
testSentimentAnalysis().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
