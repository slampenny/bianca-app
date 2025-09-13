# Emergency Detection Integration Guide

## When Emergency Detection Runs

Emergency detection should run **DURING** conversations at multiple points to ensure comprehensive coverage:

### 1. **Real-time Detection** (Immediate)
- **When**: User stops speaking (`input_audio_buffer.speech_stopped`)
- **Purpose**: Immediate detection for critical emergencies
- **Response Time**: < 1 second

### 2. **Post-Message Detection** (After each complete user message)
- **When**: User message is saved to database
- **Purpose**: Comprehensive analysis of complete utterances
- **Response Time**: < 5 seconds

### 3. **End-of-Conversation Analysis** (Optional)
- **When**: Call ends
- **Purpose**: Pattern analysis across entire conversation
- **Response Time**: Background processing

## Integration Steps

### Step 1: Add Emergency Detection Import

Add this to the top of your `openai.realtime.service.js`:

```javascript
const { emergencyProcessor } = require('./emergencyProcessor.service');
```

### Step 2: Modify Connection Setup

In your connection setup method, add patient ID:

```javascript
// When creating a new connection, add patient ID
const connectionState = {
  // ... existing properties ...
  patientId: patientId, // Add this line
  // ... rest of properties ...
};
```

### Step 3: Add Real-time Detection

Modify your `handleInputAudioTranscriptionCompleted` method:

```javascript
async handleInputAudioTranscriptionCompleted(callId, message) {
  // ... existing code ...
  
  // ADD THIS: Real-time emergency detection
  if (conn && conn.patientId && message.transcript && message.transcript.trim().length > 10) {
    try {
      const emergencyResult = await emergencyProcessor.processUtterance(
        conn.patientId,
        message.transcript,
        Date.now()
      );

      if (emergencyResult.shouldAlert) {
        logger.warn(`[Emergency Detection] EMERGENCY DETECTED for patient ${conn.patientId}: ${emergencyResult.reason}`);
        
        // Create alert and notify caregivers
        const alertResult = await emergencyProcessor.createAlert(
          conn.patientId,
          emergencyResult.alertData,
          message.transcript
        );

        if (alertResult.success) {
          logger.info(`[Emergency Detection] Alert created: ${alertResult.alert._id}`);
          
          // For CRITICAL emergencies, consider interrupting conversation
          if (emergencyResult.alertData.severity === 'CRITICAL') {
            logger.warn(`[Emergency Detection] CRITICAL emergency - consider intervention for ${callId}`);
            // Add your critical emergency handling logic here
          }
        }
      }
    } catch (error) {
      logger.error(`[Emergency Detection] Error: ${error.message}`);
      // Don't let emergency detection break the conversation
    }
  }
  
  // ... rest of existing code ...
}
```

### Step 4: Add Post-Message Detection

Modify your `saveCompleteMessage` method:

```javascript
async saveCompleteMessage(callId, role, content) {
  // ... existing code ...
  
  // ADD THIS: Post-message emergency detection for user messages
  if ((role === 'user' || role === 'patient') && conn && conn.patientId && content && content.trim().length > 10) {
    try {
      const emergencyResult = await emergencyProcessor.processUtterance(
        conn.patientId,
        content,
        Date.now()
      );

      if (emergencyResult.shouldAlert && !emergencyResult.processing.falsePositive) {
        logger.warn(`[Emergency Detection] Post-message emergency detected: ${emergencyResult.reason}`);
        
        const alertResult = await emergencyProcessor.createAlert(
          conn.patientId,
          emergencyResult.alertData,
          content
        );

        if (alertResult.success) {
          logger.info(`[Emergency Detection] Post-message alert created: ${alertResult.alert._id}`);
        }
      }
    } catch (error) {
      logger.error(`[Emergency Detection] Post-message error: ${error.message}`);
    }
  }
  
  // ... rest of existing code ...
}
```

### Step 5: Add End-of-Conversation Analysis (Optional)

Modify your `endCall` method:

```javascript
async endCall(callId) {
  // ... existing code ...
  
  // ADD THIS: End-of-conversation emergency analysis
  if (conn && conn.patientId && conn.conversationId) {
    try {
      // Get all user messages from the conversation
      const conversationService = require('./conversation.service');
      const messages = await conversationService.getConversationMessages(conn.conversationId);
      
      if (messages && messages.length > 0) {
        const userMessages = messages
          .filter(msg => msg.role === 'user' || msg.role === 'patient')
          .map(msg => msg.content)
          .join(' ');

        if (userMessages.trim().length > 20) {
          const emergencyResult = await emergencyProcessor.processUtterance(
            conn.patientId,
            userMessages,
            Date.now()
          );

          if (emergencyResult.shouldAlert) {
            logger.warn(`[Emergency Detection] End-of-conversation emergency detected: ${emergencyResult.reason}`);
            
            const alertResult = await emergencyProcessor.createAlert(
              conn.patientId,
              emergencyResult.alertData,
              userMessages
            );

            if (alertResult.success) {
              logger.info(`[Emergency Detection] End-of-conversation alert created: ${alertResult.alert._id}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`[Emergency Detection] End-of-conversation error: ${error.message}`);
    }
  }
  
  // ... rest of existing code ...
}
```

## Configuration

### Environment Variables

```bash
# Enable SNS push notifications
EMERGENCY_SNS_TOPIC_ARN=arn:aws:sns:us-east-2:123456789012:emergency-alerts
AWS_REGION=us-east-2

# Emergency detection configuration
EMERGENCY_CONFIG='{"debounceMinutes": 5, "maxAlertsPerHour": 10, "enableSNSPushNotifications": true}'
```

### Configuration File

Create `config/emergency.config.json`:

```json
{
  "debounceMinutes": 5,
  "maxAlertsPerHour": 10,
  "enableSNSPushNotifications": true,
  "severityResponseTimes": {
    "CRITICAL": 60,
    "HIGH": 300,
    "MEDIUM": 900
  }
}
```

## Testing

After integration, test with these scenarios:

1. **Real Emergency**: "I'm having a heart attack"
2. **False Positive**: "If I had a stroke, what would happen?"
3. **Duplicate Alert**: Say the same emergency twice within 5 minutes
4. **Non-Emergency**: "Everything is fine today"

## Monitoring

Check emergency detection status:

```javascript
const status = emergencyProcessor.getStatus();
console.log('Emergency detection status:', status);
```

## Performance Considerations

- Emergency detection runs asynchronously and won't block conversation flow
- Deduplication prevents alert spam
- False positive filtering reduces unnecessary alerts
- Graceful error handling ensures conversation continues even if emergency detection fails

## Security & Privacy

- Patient data is only stored temporarily for deduplication
- Emergency alerts are only sent to assigned caregivers
- All operations are logged for audit trails
- Configuration can be updated without code changes
