const { Conversation } = require('../../models');

/**
 * Generate fake but realistic sentiment analysis data based on conversation content
 * @param {string} conversationText - The conversation text
 * @param {Object} metadata - Optional metadata about the conversation
 * @returns {Object} Sentiment analysis data
 */
function generateFakeSentimentAnalysis(conversationText, metadata = {}) {
  const lowerText = conversationText.toLowerCase();
  
  // Analyze sentiment based on keywords and content
  let overallSentiment = 'neutral';
  let sentimentScore = 0;
  let confidence = 0.85;
  let concernLevel = 'low';
  let patientMood = 'Patient appears calm and engaged';
  let keyEmotions = ['neutral'];
  let satisfactionIndicators = { positive: [], negative: [] };
  let summary = 'Patient engaged in routine wellness check conversation.';
  let recommendations = 'Continue monitoring patient wellness.';
  
  // Positive indicators
  const positiveKeywords = ['good', 'great', 'wonderful', 'excellent', 'happy', 'pleased', 'satisfied', 'feeling well', 'doing well', 'better', 'improving', 'positive', 'optimistic', 'grateful', 'thankful', 'appreciate', 'energy', 'active', 'sharp', 'consistent', 'managing well'];
  const positiveCount = positiveKeywords.filter(word => lowerText.includes(word)).length;
  
  // Negative indicators
  const negativeKeywords = ['tired', 'exhausted', 'worried', 'concerned', 'frustrated', 'difficult', 'struggling', 'trouble', 'problem', 'issue', 'pain', 'uncomfortable', 'anxious', 'stressed', 'overwhelmed', 'confused', 'forgetful', 'declining'];
  const negativeCount = negativeKeywords.filter(word => lowerText.includes(word)).length;
  
  // Determine overall sentiment
  if (positiveCount > negativeCount + 2) {
    overallSentiment = 'positive';
    sentimentScore = 0.3 + (Math.min(positiveCount, 10) * 0.05);
    patientMood = 'Patient appears cheerful and optimistic';
    keyEmotions = ['happiness', 'satisfaction', 'contentment'];
    summary = 'Patient expressed positive feelings about their health and daily activities.';
    recommendations = 'Continue current treatment plan. Patient is responding well.';
    satisfactionIndicators.positive = ['Expressed satisfaction with care', 'Positive outlook on health'];
  } else if (negativeCount > positiveCount + 2) {
    overallSentiment = 'negative';
    sentimentScore = -0.3 - (Math.min(negativeCount, 10) * 0.05);
    patientMood = 'Patient appears concerned or experiencing some challenges';
    keyEmotions = ['concern', 'frustration', 'tiredness'];
    concernLevel = negativeCount > 5 ? 'high' : 'medium';
    summary = 'Patient expressed some concerns or challenges during the conversation.';
    recommendations = 'Schedule follow-up to address patient concerns. Monitor closely.';
    satisfactionIndicators.negative = ['Expressed some concerns', 'May need additional support'];
  } else if (positiveCount > 0 && negativeCount > 0) {
    overallSentiment = 'mixed';
    sentimentScore = (positiveCount - negativeCount) * 0.1;
    patientMood = 'Patient shows mixed emotions with both positive and concerning elements';
    keyEmotions = ['mixed', 'cautious', 'hopeful'];
    concernLevel = 'medium';
    summary = 'Patient conversation shows a mix of positive and concerning elements.';
    recommendations = 'Continue monitoring. Address any specific concerns raised.';
  } else {
    overallSentiment = 'neutral';
    sentimentScore = 0;
    patientMood = 'Patient appears calm and engaged in routine conversation';
    keyEmotions = ['neutral', 'calm'];
    summary = 'Patient engaged in routine wellness check conversation.';
  }
  
  // Adjust based on metadata (for declining patient conversations)
  if (metadata.source === 'declining_patient_seed') {
    if (metadata.month >= 4) {
      overallSentiment = 'negative';
      sentimentScore = -0.4 - (metadata.month - 4) * 0.1;
      concernLevel = 'high';
      patientMood = 'Patient showing signs of cognitive decline and increased confusion';
      keyEmotions = ['confusion', 'frustration', 'concern'];
      summary = 'Patient showing concerning signs of cognitive decline. Increased confusion and memory issues noted.';
      recommendations = 'Urgent follow-up recommended. Consider additional support services.';
      satisfactionIndicators.negative = ['Memory issues', 'Increased confusion', 'Difficulty managing daily tasks'];
    } else if (metadata.month >= 2) {
      overallSentiment = 'mixed';
      sentimentScore = -0.1;
      concernLevel = 'medium';
      patientMood = 'Patient showing mild concerns about memory and mood';
      keyEmotions = ['concern', 'uncertainty'];
      summary = 'Patient expressing mild concerns about cognitive function and mood.';
      recommendations = 'Monitor closely. Consider cognitive assessment.';
    }
  }
  
  // Ensure sentiment score is within bounds
  sentimentScore = Math.max(-1, Math.min(1, sentimentScore));
  
  return {
    overallSentiment,
    sentimentScore: Math.round(sentimentScore * 100) / 100, // Round to 2 decimal places
    confidence,
    patientMood,
    keyEmotions,
    concernLevel,
    satisfactionIndicators,
    summary,
    recommendations,
    fallback: false
  };
}

/**
 * Add sentiment analysis to all seeded conversations
 * @returns {Promise<void>}
 */
async function seedSentimentAnalysis() {
  console.log('Adding sentiment analysis to seeded conversations...');
  try {
    // Get all conversations for sentiment analysis
    const allConversations = await Conversation.find({
      status: 'completed',
      messages: { $exists: true, $ne: [] }
    }).populate('messages');
    
    console.log(`Found ${allConversations.length} conversations to analyze for sentiment`);
    
    // Analyze sentiment for each conversation
    for (const conversation of allConversations) {
      try {
        // Check if already has sentiment analysis
        if (conversation.analyzedData?.sentiment) {
          console.log(`Conversation ${conversation._id} already has sentiment analysis, skipping`);
          continue;
        }
        
        // Format conversation text from messages
        const conversationText = conversation.messages
          .map(msg => {
            const speaker = msg.role === 'assistant' ? 'Bianca' : 'Patient';
            return `${speaker}: ${msg.content}`;
          })
          .join('\n');
        
        if (!conversationText.trim()) {
          console.log(`Conversation ${conversation._id} has no text content, skipping`);
          continue;
        }
        
        // Generate fake but realistic sentiment analysis
        const sentimentData = generateFakeSentimentAnalysis(conversationText, conversation.metadata || {});
        
        // Update conversation with sentiment analysis
        await Conversation.findByIdAndUpdate(conversation._id, {
          $set: {
            'analyzedData.sentiment': sentimentData,
            'analyzedData.sentimentAnalyzedAt': new Date()
          }
        });
        
        console.log(`Added sentiment analysis to conversation ${conversation._id}: ${sentimentData.overallSentiment} (${sentimentData.sentimentScore})`);
        
      } catch (error) {
        console.warn(`Error analyzing sentiment for conversation ${conversation._id}:`, error.message);
      }
    }
    
    console.log('Sentiment analysis completed for seeded conversations');
  } catch (error) {
    console.warn('Failed to add sentiment analysis to seeded data:', error.message);
    // Don't fail the entire seeding process if sentiment analysis fails
  }
}

module.exports = {
  seedSentimentAnalysis,
  generateFakeSentimentAnalysis,
};

