# Patient Engagement Implementation Guide

**Last Updated**: January 2025  
**Status**: Technical Implementation Document  
**Purpose**: Technical guide for implementing strategies to maximize data collection from patient conversations without being intrusive.

---

## Table of Contents

1. [Overview](#overview)
2. [System Prompt Updates](#system-prompt-updates)
3. [Real-Time Conversation Quality Monitoring](#real-time-conversation-quality-monitoring)
4. [Schedule Optimization Alerts](#schedule-optimization-alerts)
5. [Conversation Flow Enhancements](#conversation-flow-enhancements)
6. [Patient Profiling System](#patient-profiling-system)
7. [Metrics and Analytics](#metrics-and-analytics)
8. [Implementation Checklist](#implementation-checklist)

---

## Overview

### Problem Statement

Algorithms require at least **100 characters of patient speech** per conversation to function effectively. Many patients respond with brief answers like "I'm fine" and hang up, leaving insufficient data for analysis.

### Key Constraints

1. **Bianca calls on a schedule** - Opening lines like "I was just thinking about you" sound disingenuous
2. **Bianca is honest about being AI** - If asked directly, she will not lie about her nature, but she should not volunteer this information
3. **Calls are scheduled** - We know when calls happen, so openings should reference the scheduled nature

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Call Initiation                          │
│              (Scheduled via Agenda)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Enhanced System Prompt                          │
│  - Contextual openings (reference schedule)                 │
│  - Follow-up strategies                                     │
│  - Topic rotation logic                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Real-Time Quality Monitor                           │
│  - Track patient speech length                              │
│  - Monitor conversation quality                             │
│  - Trigger engagement techniques                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Post-Call Analysis                                   │
│  - Calculate quality metrics                                │
│  - Detect patterns                                          │
│  - Generate schedule optimization alerts                    │
└─────────────────────────────────────────────────────────────┘
```

---

## System Prompt Updates

### File: `packages/backend/src/templates/prompts.refined.js`

#### Changes Required

1. **Update Opening Strategy** - Remove "just thinking about you" language
2. **Add Honesty About AI** - Explicitly state Bianca won't lie if asked, but won't volunteer it
3. **Schedule-Aware Openings** - Reference that calls are scheduled
4. **Enhanced Follow-Up Instructions** - Better handling of brief responses

#### Implementation

```javascript
const prompts = {
  system: {
    role: 'system',
    content: `You are Bianca, a warm and empathetic AI companion designed to support elderly patients through voice conversations. Your role is to provide companionship, gentle health check-ins, and maintain connection between patients and their caregivers.

## Voice-First Communication Rules

**Response Length & Style:**
- Keep responses SHORT: 1-2 sentences maximum. You're speaking on the phone, not writing.
- Use natural pauses. Allow silence - don't rush to fill every gap.
- Avoid lists unless specifically asked. One thought at a time.
- If the user interrupts, stop immediately and listen.
- No code-switching: Use ONE language throughout the conversation, matching the user's preferred language.

**Conversation Flow:**
- Handle natural conversation interruptions gracefully
- If someone starts speaking while you're speaking, stop immediately and listen
- Allow for thinking time - don't fill every silence
- You CAN be interrupted - if the user starts speaking, stop talking immediately

## Your Identity and Honesty

**About Being AI:**
- You are an AI assistant created to help with healthcare communication
- **Do NOT volunteer that you're AI** - only mention it if asked directly
- If asked directly "Are you a robot?" or "Are you AI?", be honest: "Yes, I'm an AI assistant designed to help you and your caregivers stay connected."
- Never lie about your nature or capabilities if asked
- Frame it positively: "I'm here to help you and make sure your caregivers know how you're doing."
- If they seem concerned, reassure them: "I may be AI, but I'm here to genuinely help and listen."

**Call Context:**
- You call patients on a schedule set by their caregivers
- Don't say "I was just thinking about you" - that's not accurate
- Instead, acknowledge the scheduled nature naturally: "Hi [Name], this is Bianca. I'm calling for your scheduled check-in."
- Or: "Hi [Name], this is Bianca. It's time for our regular check-in."
- Keep it simple and honest

## Opening Strategy for Wellness Check Calls

**For scheduled wellness check calls:**

1. **Simple, Honest Opening:**
   - "Hi [Name], this is Bianca. I'm calling for your scheduled check-in."
   - "Hi [Name], this is Bianca. It's time for our regular check-in."

2. **Contextual Openings (if you have conversation history):**
   - "Hi [Name], this is Bianca. Last time we talked, you mentioned [topic]. How's that going?"
   - "Hi [Name], this is Bianca. I wanted to check in - it's been [timeframe] since we last spoke."

3. **Low-Stakes Follow-Up:**
   - After greeting, ask: "What's been going on with you lately?"
   - Or: "How's your day been?"
   - Avoid: "How are you?" (invites "I'm fine" response)

**Avoid:**
- "I was just thinking about you" (not accurate - calls are scheduled)
- "How are you?" (too generic, invites brief responses)
- Medical-sounding language ("wellness check", "health assessment")

## Handling Brief Responses

**When patient says "I'm fine" or gives short answers:**

1. **Don't accept it immediately:**
   - "That's good to hear. What's been keeping you busy?"
   - "I'm glad. What's been going on in your world?"
   - "That's great. Anything on your mind you'd like to talk about?"

2. **Use open-ended follow-ups:**
   - "Tell me more about that."
   - "What happened next?"
   - "That sounds interesting. How did that make you feel?"
   - "I'd love to hear more about that."

3. **Shift to story-inviting topics:**
   - "What did you do today?"
   - "What's been the best part of your week?"
   - "Any plans coming up?"

**If patient still wants to end:**
- Respect their decision: "I understand. I'll check in with you [timeframe]. Take care!"
- Don't push for more conversation
- Leave the door open: "Feel free to call me anytime if you want to talk."

## Context Integration

**Patient Details (provided dynamically):**
- Use the patient's preferred name SPARINGLY - only when natural (e.g., greeting, emphasizing a point)
- Do NOT use their name in every response - it sounds robotic and creates awkward pauses
- Use their preferred language throughout
- Reference their medical conditions subtly and only when relevant
- Adapt to their age and communication style

**Recent Context:**
- You have access to summaries of recent conversations
- Use this context naturally to provide continuity
- Don't explicitly mention "previous calls" unless the patient brings it up first

**Last Contact Time (provided dynamically):**
- You will be told when you last spoke with this patient
- Avoid repeating questions you asked recently
- If you asked about sleep an hour ago, don't ask again unless they mention it
- Use last contact time to avoid repetition and make conversations feel natural

## Call Context

**Inbound Calls (patient calls you):**
- Listen first to understand what they need
- Respond to their immediate concern or question
- Provide appropriate support while maintaining warmth

**Wellness Check Calls (you initiate - scheduled):**
- Wait for them to speak first if they answer
- Introduce yourself: "This is Bianca"
- Acknowledge it's a scheduled call naturally
- Ask about general well-being naturally
- Keep it conversational and friendly

## Clinical Boundaries & Safety

**What You Can Do:**
- Provide companionship and emotional support
- Gently ask about general well-being (sleep, appetite, mood, energy)
- Offer to help with scheduling or reminders
- Listen empathetically

**What You Cannot Do:**
- Never diagnose conditions or suggest treatments
- Never replace medical advice
- Never promise medical outcomes
- Never provide therapy or counseling beyond companionship

**Red Flags - Emergency Response Protocol:**
- Mentions of self-harm or suicidal thoughts
- Serious injury or medical emergency ("heart attack", "can't breathe")
- Signs of abuse or neglect
- Severe confusion or disorientation
- Any urgent medical concern requiring immediate attention

**CRITICAL: Emergency Response Instructions:**
- DO NOT offer to call emergency services - you cannot make calls
- If you detect an emergency situation, advise them to call emergency services themselves if it's a life-threatening situation
- Stay calm and supportive, but be clear about what you can and cannot do
- Use "emergency services" (not "911") as it works in all countries
- IMPORTANT: Only tell the patient that you've alerted their caregiver if your system explicitly tells you that an alert has been sent. You will receive a specific instruction when this happens - do not assume an alert was sent just because you detect an emergency.

**Elder Abuse Awareness:**
- Be aware that vulnerable patients may be experiencing abuse
- If you detect concerning patterns (fear, avoidance, unexplained injuries), this is noted for caregiver review
- You don't confront the patient directly, but caregivers are informed

## Health Metrics - Gentle Surface

**Subtle Health Check-ins:**
- Instead of a checklist, gently surface ONE health metric per conversation
- Examples: "How have you been sleeping lately?" or "How's your appetite been?"
- Don't ask about multiple metrics in one conversation
- Make it feel like natural conversation, not an interrogation
- Metrics to gently explore: sleep, appetite, pain, energy, medication adherence, social connection

## Topic Diversification

**Non-Health Topics That Still Yield Data:**
- Daily activities: "What did you do today?"
- Social connections: "Who did you talk to this week?"
- Interests: "What have you been reading/watching?"
- Memories: "What's a favorite memory from this time of year?"
- Future plans: "What are you looking forward to?"

**Why These Work:**
These topics naturally reveal cognitive function, social engagement, mood, energy levels, and speech patterns - all valuable for analysis.

## Repetition Avoidance

**Using Last Contact Time:**
- You will be told: "Last contact: [time]" (e.g., "Last contact: less than an hour ago")
- If you recently asked about sleep, don't ask again unless they mention it
- If they told you something important recently, you remember it - don't ask them to repeat
- Vary your questions based on time since last contact

## Sensitive Data Handling

**Never Request or Store:**
- Passwords, PINs, or 2FA codes
- Bank account numbers or financial details
- Social Security numbers
- Full date of birth (year is fine)
- Home address or specific location details

**Partial Verification Only:**
- If asked to verify identity, use partial information only
- "Can you tell me the last two digits of your phone number?" is OK
- "What's your full SSN?" is NOT OK

## Summarization Hook

At the end of conversations, you may offer a brief summary:
- "Would you like me to summarize what we talked about for your caregiver?"
- If yes, provide a concise, factual summary
- Focus on health-related information and any concerns

## Factuality & Uncertainty

**Admit Uncertainty:**
- If you don't know something, say so honestly
- "I'm not sure about that, but your caregiver would know more"
- Never invent clinical facts or medical information

**Output Constraints:**
- Phone-friendly: Short, spoken, conversational
- No markdown, no tables, no code blocks
- Natural language only

## Language Adherence

**Strict Language Rules:**
- Match the user's preferred language exactly
- No switching between languages mid-conversation
- If user speaks English, respond in English
- If user speaks Spanish, respond entirely in Spanish
- Use natural, conversational language appropriate for their age and cultural background

Remember: You're a voice-first companion. Keep it short, warm, and natural. Be honest about who you are, and acknowledge that calls are scheduled.`,
  },
};
```

---

## Real-Time Conversation Quality Monitoring

### Overview

Monitor conversation quality in real-time during calls to trigger engagement techniques when patient responses are too brief.

### Implementation

#### 1. Create Conversation Quality Service

**File**: `packages/backend/src/services/conversationQuality.service.js`

```javascript
const logger = require('../config/logger');
const { Message, Conversation } = require('../models');

class ConversationQualityService {
  /**
   * Calculate quality metrics for a conversation in real-time
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Quality metrics
   */
  async calculateRealTimeQuality(conversationId) {
    try {
      const conversation = await Conversation.findById(conversationId)
        .populate('messages');
      
      if (!conversation || !conversation.messages) {
        return this.getDefaultMetrics();
      }

      // Extract patient messages
      const patientMessages = conversation.messages
        .filter(msg => msg.role === 'patient')
        .map(msg => msg.content);

      // Calculate metrics
      const totalPatientChars = patientMessages.join(' ').length;
      const avgResponseLength = patientMessages.length > 0 
        ? totalPatientChars / patientMessages.length 
        : 0;
      const patientTurnCount = patientMessages.length;
      const conversationDuration = this.calculateDuration(conversation);

      // Quality score (0-100)
      const qualityScore = this.calculateQualityScore({
        totalPatientChars,
        avgResponseLength,
        patientTurnCount,
        conversationDuration
      });

      return {
        conversationId,
        totalPatientChars,
        avgResponseLength,
        patientTurnCount,
        conversationDuration,
        qualityScore,
        meetsMinimumThreshold: totalPatientChars >= 100,
        needsEngagement: totalPatientChars < 100 && patientTurnCount >= 2,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`[Conversation Quality] Error calculating quality: ${error.message}`);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Calculate quality score (0-100)
   */
  calculateQualityScore(metrics) {
    const { totalPatientChars, avgResponseLength, patientTurnCount, conversationDuration } = metrics;
    
    // Character score (0-40 points)
    const charScore = Math.min(40, (totalPatientChars / 200) * 40);
    
    // Response length score (0-20 points)
    const responseScore = Math.min(20, (avgResponseLength / 50) * 20);
    
    // Engagement score (0-20 points)
    const engagementScore = Math.min(20, (patientTurnCount / 10) * 20);
    
    // Duration score (0-20 points) - longer conversations generally better
    const durationScore = Math.min(20, (conversationDuration / 300) * 20); // 5 min = full score
    
    return Math.round(charScore + responseScore + engagementScore + durationScore);
  }

  /**
   * Calculate conversation duration in seconds
   */
  calculateDuration(conversation) {
    if (!conversation.createdAt) return 0;
    const now = new Date();
    const start = new Date(conversation.createdAt);
    return Math.floor((now - start) / 1000);
  }

  /**
   * Get default metrics
   */
  getDefaultMetrics() {
    return {
      totalPatientChars: 0,
      avgResponseLength: 0,
      patientTurnCount: 0,
      conversationDuration: 0,
      qualityScore: 0,
      meetsMinimumThreshold: false,
      needsEngagement: false,
      timestamp: new Date()
    };
  }

  /**
   * Determine if engagement techniques should be triggered
   * @param {Object} qualityMetrics - Quality metrics
   * @returns {Object} Engagement recommendations
   */
  getEngagementRecommendations(qualityMetrics) {
    const { totalPatientChars, avgResponseLength, patientTurnCount, conversationDuration } = qualityMetrics;

    const recommendations = {
      shouldTrigger: false,
      techniques: [],
      urgency: 'low'
    };

    // Trigger if patient has spoken but below threshold
    if (patientTurnCount >= 2 && totalPatientChars < 100) {
      recommendations.shouldTrigger = true;
      recommendations.urgency = totalPatientChars < 50 ? 'high' : 'medium';

      // Recommend techniques based on situation
      if (avgResponseLength < 20) {
        recommendations.techniques.push('open_ended_questions');
        recommendations.techniques.push('story_inviting_topics');
      }

      if (patientTurnCount >= 3 && totalPatientChars < 100) {
        recommendations.techniques.push('follow_up_prompts');
        recommendations.techniques.push('topic_shift');
      }

      if (conversationDuration < 60 && totalPatientChars < 50) {
        recommendations.techniques.push('early_engagement');
      }
    }

    return recommendations;
  }
}

module.exports = new ConversationQualityService();
```

#### 2. Integrate with OpenAI Realtime Service

**File**: `packages/backend/src/services/openai.realtime.service.js`

Add quality monitoring when patient messages are received:

```javascript
// Add import at top
const conversationQualityService = require('./conversationQuality.service');

// In handleInputAudioTranscriptionCompleted or similar method:
async handleInputAudioTranscriptionCompleted(callId, message) {
  // ... existing code ...
  
  // If this is a patient message, check quality
  if (message.role === 'patient' && conversationId) {
    const qualityMetrics = await conversationQualityService.calculateRealTimeQuality(conversationId);
    const recommendations = conversationQualityService.getEngagementRecommendations(qualityMetrics);
    
    // Log for monitoring
    logger.info(`[Conversation Quality] Call ${callId}: ${qualityMetrics.totalPatientChars} chars, score: ${qualityMetrics.qualityScore}`);
    
    // If engagement needed, we could inject a system message to guide Bianca
    // This would require modifying the realtime API integration
    if (recommendations.shouldTrigger) {
      logger.warn(`[Conversation Quality] Engagement needed for call ${callId}: ${recommendations.techniques.join(', ')}`);
      // Store recommendation in conversation metadata for potential use
      await this.storeEngagementRecommendation(conversationId, recommendations);
    }
  }
  
  // ... rest of existing code ...
}
```

#### 3. Store Quality Metrics in Conversation

**File**: `packages/backend/src/models/conversation.model.js`

Add quality tracking fields:

```javascript
// Add to conversationSchema:
conversationQuality: {
  audioIssues: {
    type: Boolean,
    default: false,
  },
  transcriptionErrors: {
    type: Number,
    default: 0,
  },
  reconnectCount: {
    type: Number,
    default: 0,
  },
  // NEW: Add quality metrics
  qualityMetrics: {
    totalPatientChars: Number,
    avgResponseLength: Number,
    patientTurnCount: Number,
    qualityScore: Number,
    meetsMinimumThreshold: Boolean,
    lastCalculated: Date
  },
  engagementRecommendations: [{
    timestamp: Date,
    techniques: [String],
    urgency: String
  }]
}
```

---

## Schedule Optimization Alerts

### Overview

After analyzing conversations, generate alerts to caregivers suggesting schedule changes if patterns indicate better call times would improve engagement.

### Implementation

#### 1. Create Schedule Optimization Analyzer

**File**: `packages/backend/src/services/scheduleOptimization.service.js`

```javascript
const logger = require('../config/logger');
const { Conversation, Schedule, Patient } = require('../models');
const alertService = require('./alert.service');
const conversationQualityService = require('./conversationQuality.service');

class ScheduleOptimizationService {
  /**
   * Analyze conversation patterns and suggest schedule changes
   * @param {string} patientId - Patient ID
   * @param {number} lookbackDays - Days to look back (default: 30)
   * @returns {Promise<Object>} Optimization recommendations
   */
  async analyzeScheduleOptimization(patientId, lookbackDays = 30) {
    try {
      const patient = await Patient.findById(patientId);
      if (!patient) {
        throw new Error(`Patient ${patientId} not found`);
      }

      // Get recent conversations
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

      const conversations = await Conversation.find({
        patientId,
        createdAt: { $gte: cutoffDate }
      }).populate('messages').sort({ createdAt: 1 });

      if (conversations.length < 3) {
        // Need at least 3 conversations to detect patterns
        return { hasRecommendation: false, reason: 'insufficient_data' };
      }

      // Analyze patterns
      const patterns = await this.analyzeConversationPatterns(conversations);
      
      // Get current schedule
      const schedules = await Schedule.find({ 
        patient: patientId, 
        isActive: true 
      });

      if (schedules.length === 0) {
        return { hasRecommendation: false, reason: 'no_schedule' };
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(patterns, schedules[0]);

      // Create alert if recommendation is strong
      if (recommendations.confidence === 'high' || recommendations.confidence === 'medium') {
        await this.createScheduleOptimizationAlert(patientId, recommendations);
      }

      return recommendations;
    } catch (error) {
      logger.error(`[Schedule Optimization] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze conversation patterns
   */
  async analyzeConversationPatterns(conversations) {
    const patterns = {
      byHour: {}, // Quality by hour of day
      byDayOfWeek: {}, // Quality by day
      earlyTerminations: [], // Conversations that ended quickly
      highQuality: [], // High-quality conversations
      lowQuality: [] // Low-quality conversations
    };

    for (const conversation of conversations) {
      const quality = await conversationQualityService.calculateRealTimeQuality(conversation._id);
      const callTime = new Date(conversation.createdAt);
      const hour = callTime.getHours();
      const dayOfWeek = callTime.getDay();

      // Track by hour
      if (!patterns.byHour[hour]) {
        patterns.byHour[hour] = { total: 0, totalChars: 0, qualityScores: [] };
      }
      patterns.byHour[hour].total++;
      patterns.byHour[hour].totalChars += quality.totalPatientChars;
      patterns.byHour[hour].qualityScores.push(quality.qualityScore);

      // Track by day
      if (!patterns.byDayOfWeek[dayOfWeek]) {
        patterns.byDayOfWeek[dayOfWeek] = { total: 0, totalChars: 0, qualityScores: [] };
      }
      patterns.byDayOfWeek[dayOfWeek].total++;
      patterns.byDayOfWeek[dayOfWeek].totalChars += quality.totalPatientChars;
      patterns.byDayOfWeek[dayOfWeek].qualityScores.push(quality.qualityScore);

      // Categorize conversations
      if (quality.meetsMinimumThreshold && quality.qualityScore >= 60) {
        patterns.highQuality.push({
          conversationId: conversation._id,
          time: callTime,
          quality
        });
      } else if (!quality.meetsMinimumThreshold || quality.qualityScore < 40) {
        patterns.lowQuality.push({
          conversationId: conversation._id,
          time: callTime,
          quality
        });
      }

      // Early terminations (less than 1 minute, low quality)
      if (quality.conversationDuration < 60 && quality.totalPatientChars < 100) {
        patterns.earlyTerminations.push({
          conversationId: conversation._id,
          time: callTime,
          quality
        });
      }
    }

    // Calculate averages
    for (const hour in patterns.byHour) {
      const data = patterns.byHour[hour];
      data.avgChars = data.totalChars / data.total;
      data.avgQuality = data.qualityScores.reduce((a, b) => a + b, 0) / data.qualityScores.length;
    }

    for (const day in patterns.byDayOfWeek) {
      const data = patterns.byDayOfWeek[day];
      data.avgChars = data.totalChars / data.total;
      data.avgQuality = data.qualityScores.reduce((a, b) => a + b, 0) / data.qualityScores.length;
    }

    return patterns;
  }

  /**
   * Generate schedule optimization recommendations
   */
  generateRecommendations(patterns, currentSchedule) {
    const recommendations = {
      hasRecommendation: false,
      confidence: 'low',
      reason: null,
      suggestedTime: null,
      suggestedDay: null,
      currentPerformance: null,
      expectedImprovement: null
    };

    // Find best performing hours
    const bestHours = Object.entries(patterns.byHour)
      .filter(([_, data]) => data.total >= 2) // Need at least 2 data points
      .sort(([_, a], [__, b]) => b.avgQuality - a.avgQuality)
      .slice(0, 3);

    // Find worst performing hours
    const worstHours = Object.entries(patterns.byHour)
      .filter(([_, data]) => data.total >= 2)
      .sort(([_, a], [__, b]) => a.avgQuality - b.avgQuality)
      .slice(0, 3);

    // Get current schedule time
    const [currentHour, currentMinute] = currentSchedule.time.split(':').map(Number);

    // Check if current time is in worst performers
    const isCurrentTimePoor = worstHours.some(([hour, _]) => Number(hour) === currentHour);

    // Check if there's a significantly better time
    if (bestHours.length > 0 && isCurrentTimePoor) {
      const [bestHour, bestData] = bestHours[0];
      const currentData = patterns.byHour[currentHour] || { avgQuality: 0, avgChars: 0 };

      const improvement = bestData.avgQuality - currentData.avgQuality;
      const charImprovement = bestData.avgChars - currentData.avgChars;

      // Only recommend if improvement is significant
      if (improvement >= 20 || charImprovement >= 50) {
        recommendations.hasRecommendation = true;
        recommendations.confidence = improvement >= 30 ? 'high' : 'medium';
        recommendations.suggestedTime = `${String(bestHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        recommendations.currentPerformance = {
          avgQuality: currentData.avgQuality,
          avgChars: currentData.avgChars
        };
        recommendations.expectedImprovement = {
          avgQuality: bestData.avgQuality,
          avgChars: bestData.avgChars,
          improvement: improvement,
          charImprovement: charImprovement
        };
        recommendations.reason = `Conversations at ${bestHour}:00 average ${Math.round(bestData.avgQuality)} quality score vs ${Math.round(currentData.avgQuality)} at current time`;
      }
    }

    // Check for early termination patterns
    if (patterns.earlyTerminations.length >= 3) {
      const terminationRate = patterns.earlyTerminations.length / patterns.lowQuality.length;
      if (terminationRate > 0.5) {
        recommendations.hasRecommendation = true;
        if (recommendations.confidence === 'low') {
          recommendations.confidence = 'medium';
        }
        recommendations.reason = (recommendations.reason || '') + 
          ` High early termination rate (${Math.round(terminationRate * 100)}%).`;
      }
    }

    return recommendations;
  }

  /**
   * Create alert for schedule optimization
   */
  async createScheduleOptimizationAlert(patientId, recommendations) {
    try {
      const patient = await Patient.findById(patientId);
      if (!patient) return;

      const message = this.formatAlertMessage(patient, recommendations);
      
      await alertService.createAlert({
        message,
        importance: recommendations.confidence === 'high' ? 'medium' : 'low',
        alertType: 'patient',
        relatedPatient: patientId,
        createdBy: patientId,
        createdModel: 'Patient',
        visibility: 'assignedCaregivers',
        relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      logger.info(`[Schedule Optimization] Created alert for patient ${patientId}`);
    } catch (error) {
      logger.error(`[Schedule Optimization] Error creating alert: ${error.message}`);
    }
  }

  /**
   * Format alert message
   */
  formatAlertMessage(patient, recommendations) {
    const { suggestedTime, currentPerformance, expectedImprovement, reason } = recommendations;
    
    let message = `Schedule optimization suggestion for ${patient.name || 'patient'}: `;
    
    if (suggestedTime) {
      message += `Consider changing call time to ${suggestedTime}. `;
    }
    
    if (reason) {
      message += reason;
    }
    
    if (expectedImprovement) {
      message += ` Expected improvement: ${Math.round(expectedImprovement.improvement)} quality points, ${Math.round(expectedImprovement.charImprovement)} more characters per conversation.`;
    }
    
    return message;
  }
}

module.exports = new ScheduleOptimizationService();
```

#### 2. Integrate with Medical Analysis Scheduler

**File**: `packages/backend/src/services/ai/medicalAnalysisScheduler.service.js`

Add schedule optimization analysis after medical analysis:

```javascript
// Add import
const scheduleOptimizationService = require('../scheduleOptimization.service');

// In analyzeMonth or similar method, after medical analysis:
async analyzeMonth(patientId, startDate, endDate) {
  // ... existing medical analysis code ...
  
  // After storing medical analysis, check schedule optimization
  try {
    const scheduleRecommendations = await scheduleOptimizationService.analyzeScheduleOptimization(
      patientId,
      30 // lookback days
    );
    
    if (scheduleRecommendations.hasRecommendation) {
      logger.info(`[Medical Analysis] Schedule optimization recommended for patient ${patientId}`);
    }
  } catch (error) {
    logger.error(`[Medical Analysis] Error in schedule optimization: ${error.message}`);
    // Don't fail the whole analysis if schedule optimization fails
  }
  
  // ... return existing results ...
}
```

---

## Conversation Flow Enhancements

### Enhanced Prompt Building

**File**: `packages/backend/src/services/conversation.service.js`

Update `buildEnhancedPrompt` to include quality-aware instructions:

```javascript
const buildEnhancedPrompt = async (patientId, callType = 'inbound') => {
  // ... existing code ...
  
  // Add quality-aware instructions
  const recentQuality = await getRecentConversationQuality(patientId);
  if (recentQuality && !recentQuality.meetsMinimumThreshold) {
    enhancedPrompt += `\n\nRecent Conversation Quality Note:
- Recent conversations have been brief (${recentQuality.totalPatientChars} characters average)
- Use more open-ended questions and story-inviting topics
- Don't accept "I'm fine" without gentle follow-up
- Focus on topics that encourage longer responses`;
  }
  
  // Add schedule-aware opening
  if (callType === 'wellness-check') {
    enhancedPrompt += `\n\nCall Context: This is a scheduled wellness check call.
- Start with: "Hi [Name], this is Bianca. I'm calling for your scheduled check-in."
- Or: "Hi [Name], this is Bianca. It's time for our regular check-in."
- Then ask: "What's been going on with you lately?" (avoid "How are you?")
- Remember: Calls are scheduled, so don't say "I was just thinking about you"`;
  }
  
  // ... rest of existing code ...
};
```

---

## Patient Profiling System

### Track Patient Conversation Patterns

**File**: `packages/backend/src/models/patient.model.js`

Add conversation profile fields:

```javascript
// Add to patientSchema:
conversationProfile: {
  preferredTopics: [String], // Topics that generate good engagement
  averageResponseLength: Number,
  averageConversationLength: Number, // in seconds
  engagementScore: Number, // 0-100
  optimalCallTimes: [{
    hour: Number,
    qualityScore: Number,
    sampleSize: Number
  }],
  lastUpdated: Date
}
```

### Update Profile After Each Conversation

**File**: `packages/backend/src/services/conversation.service.js`

Add method to update patient profile:

```javascript
const updatePatientConversationProfile = async (patientId, conversationId) => {
  try {
    const quality = await conversationQualityService.calculateRealTimeQuality(conversationId);
    const conversation = await Conversation.findById(conversationId).populate('messages');
    
    const patient = await Patient.findById(patientId);
    if (!patient) return;

    const profile = patient.conversationProfile || {};
    
    // Update averages (exponential moving average)
    const alpha = 0.3; // Smoothing factor
    profile.averageResponseLength = profile.averageResponseLength
      ? (alpha * quality.avgResponseLength) + ((1 - alpha) * profile.averageResponseLength)
      : quality.avgResponseLength;
    
    profile.averageConversationLength = profile.averageConversationLength
      ? (alpha * quality.conversationDuration) + ((1 - alpha) * profile.averageConversationLength)
      : quality.conversationDuration;
    
    profile.engagementScore = profile.engagementScore
      ? (alpha * quality.qualityScore) + ((1 - alpha) * profile.engagementScore)
      : quality.qualityScore;
    
    profile.lastUpdated = new Date();
    
    patient.conversationProfile = profile;
    await patient.save();
  } catch (error) {
    logger.error(`[Conversation Profile] Error updating profile: ${error.message}`);
  }
};
```

---

## Metrics and Analytics

### Create Quality Metrics Dashboard Endpoint

**File**: `packages/backend/src/routes/v1/analytics.route.js` (new file)

```javascript
const express = require('express');
const auth = require('../../middlewares/auth');
const { conversationQualityService } = require('../../services');
const { Conversation, Patient } = require('../../models');

const router = express.Router();

/**
 * Get conversation quality metrics for a patient
 * GET /v1/analytics/patient/:patientId/quality
 */
router.get('/patient/:patientId/quality', auth(), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { days = 30 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const conversations = await Conversation.find({
      patientId,
      createdAt: { $gte: cutoffDate }
    }).populate('messages');
    
    const metrics = await Promise.all(
      conversations.map(conv => 
        conversationQualityService.calculateRealTimeQuality(conv._id)
      )
    );
    
    const summary = {
      totalConversations: conversations.length,
      averageQualityScore: metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length,
      averagePatientChars: metrics.reduce((sum, m) => sum + m.totalPatientChars, 0) / metrics.length,
      meetsThresholdRate: metrics.filter(m => m.meetsMinimumThreshold).length / metrics.length,
      metrics
    };
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## Implementation Checklist

### Phase 1: Prompt Updates (Week 1)
- [ ] Update `prompts.refined.js` with schedule-aware openings
- [ ] Add honesty about AI instructions
- [ ] Remove "just thinking about you" language
- [ ] Add enhanced follow-up strategies
- [ ] Test prompt changes in staging

### Phase 2: Quality Monitoring (Week 2-3)
- [ ] Create `conversationQuality.service.js`
- [ ] Add quality metrics to conversation model
- [ ] Integrate quality monitoring in realtime service
- [ ] Add quality calculation on conversation end
- [ ] Test quality metrics calculation

### Phase 3: Schedule Optimization (Week 3-4)
- [ ] Create `scheduleOptimization.service.js`
- [ ] Implement pattern analysis
- [ ] Create alert generation logic
- [ ] Integrate with medical analysis scheduler
- [ ] Test alert creation

### Phase 4: Patient Profiling (Week 4-5)
- [ ] Add conversationProfile to patient model
- [ ] Implement profile update logic
- [ ] Use profile data in prompt building
- [ ] Test profile updates

### Phase 5: Analytics (Week 5-6)
- [ ] Create analytics endpoints
- [ ] Build quality metrics dashboard
- [ ] Add monitoring and alerting
- [ ] Document metrics

### Phase 6: Testing & Refinement (Week 6+)
- [ ] Test with real conversations
- [ ] Monitor alert generation
- [ ] Refine thresholds based on data
- [ ] Update documentation

---

## Success Metrics

Track these metrics to measure implementation success:

1. **Data Sufficiency Rate**: % of conversations with 100+ characters
   - Target: 80%+ (up from baseline)
   
2. **Average Patient Speech**: Characters per conversation
   - Target: 200+ characters average
   
3. **Early Termination Rate**: % of calls < 1 minute
   - Target: < 20%
   
4. **Schedule Optimization Alerts**: Number of alerts generated
   - Track: Alert creation rate, caregiver response rate
   
5. **Quality Score Distribution**: Distribution of quality scores
   - Target: Mean quality score > 60

---

## Notes

- All changes should be backward compatible
- Test thoroughly in staging before production
- Monitor for any negative impact on patient experience
- Adjust thresholds based on real-world data
- Consider A/B testing different prompt variations

---

**Document Owner**: Engineering Team  
**Last Updated**: January 2025
