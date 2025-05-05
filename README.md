# Wellness Check Application Architecture

## Overview

This application provides automated wellness checks for elderly patients using AI-powered phone calls. The system can:

1. Make outbound calls to patients via Twilio
2. Handle incoming calls via Asterisk (optional)
3. Connect patients with OpenAI's realtime voice API
4. Record and summarize conversations for care providers
5. Generate alerts for missed calls or concerning health issues

## Core Components

### 1. Telephony Integration

The application supports two telephony options:

#### Twilio Integration
- Handles outbound calls to patients
- Uses Twilio's media streams for bidirectional audio
- Provides answering machine detection
- Records call metadata (duration, status, etc.)

#### Asterisk Integration (Optional)
- Handles incoming/outbound calls via SIP/VoIP
- Uses Asterisk REST Interface (ARI) for call control
- Requires more configuration but costs less per call
- Good for high call volume environments

### 2. OpenAI Realtime Service

The core AI component that:
- Connects to OpenAI's realtime voice API
- Handles audio transcoding between telephony and OpenAI
- Manages the conversation flow
- Stores conversation text in the database
- Handles failures gracefully with reconnection logic

### 3. WebSocket Service

Bridges between telephony systems and OpenAI:
- Handles WebSocket connections from Twilio
- Routes audio between systems
- Tracks call state
- Ensures proper cleanup when calls end

### 4. Database Integration

Stores important data about calls:
- Patient information
- Call metadata (time, duration, status)
- Conversation transcripts
- Summaries for care providers

## Data Flow

1. **Call Initiation**:
   - Outbound: System initiates a call to patient via Twilio
   - Inbound: Patient calls a number connected to Asterisk

2. **Call Establishment**:
   - Telephony system connects to the WebSocket service
   - WebSocket service initializes OpenAI connection
   - Initial greeting is played to the patient

3. **Conversation**:
   - Patient's audio is sent to OpenAI via the WebSocket
   - OpenAI processes the audio and returns responses
   - AI responses are played back to the patient

4. **Call Completion**:
   - Call ends (patient hangs up or timeout)
   - Resources are cleaned up
   - Conversation is summarized
   - Alerts are generated if needed

## Improvements Made

### 1. Code Organization
- Refactored to use class-based architecture
- Implemented proper singleton pattern
- Improved method organization and naming

### 2. Error Handling
- Added comprehensive error handling
- Implemented retry logic with exponential backoff
- Added graceful cleanup on failures

### 3. Connection Management
- Centralized tracking of connections
- Improved lifecycle management
- Better state handling

### 4. Audio Processing
- Streamlined conversion between audio formats
- Reduced unnecessary processing steps
- Improved buffering for audio chunks

### 5. Logging
- Added detailed logging at appropriate levels
- Included context in log messages
- Better diagnostics for troubleshooting

## Configuration

The application is configured via environment variables or a configuration file:

```javascript
// config.js example structure
module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  
  mongoose: {
    url: process.env.MONGODB_URL || 'mongodb://localhost:27017/wellness-app',
    options: {/* ... */}
  },
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phone: process.env.TWILIO_PHONE_NUMBER,
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    websocketUrl: process.env.WEBSOCKET_URL || 'ws://localhost:3000'
  },
  
  asterisk: {
    enabled: process.env.ASTERISK_ENABLED === 'true',
    url: process.env.ASTERISK_URL || 'http://asterisk:8088',
    username: process.env.ASTERISK_USERNAME || 'myphonefriend',
    password: process.env.ASTERISK_PASSWORD
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    realtimeModel: process.env.OPENAI_MODEL || 'gpt-4-turbo'
  }
};
```

## Deployment Considerations

### 1. Scaling
- The application can handle multiple concurrent calls
- WebSocket connections require persistent server connections
- Consider using PM2 or similar for process management

### 2. Security
- Store API keys securely (not in code)
- Use HTTPS for all endpoints
- Secure WebSocket connections with WSS

### 3. Monitoring
- Implement health checks
- Monitor call quality and success rates
- Set up alerts for system failures

### 4. Cost Management
- Track API usage (Twilio, OpenAI)
- Consider time-of-day scheduling for non-urgent checks
- Optimize call duration

## Future Enhancements

1. **Patient Context**: Provide OpenAI with patient history and context for more personalized interactions
2. **Emergency Detection**: Improved detection of health emergencies with automated escalation
3. **Integration with EHR**: Connect with Electronic Health Records for better context
4. **Multiple Languages**: Support for patients who speak languages other than English
5. **Call Scheduling**: Advanced scheduling with preferences and optimal timing