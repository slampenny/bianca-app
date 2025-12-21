# OpenAI Realtime API Event Documentation

**Purpose:** Document all events and message types used in our implementation for Beta to GA migration reference.

**Last Updated:** December 21, 2025  
**Status:** Current Beta Implementation

---

## Events We Receive (from OpenAI)

### Session Events

#### `session.created`
**Handler:** `handleSessionCreated()`  
**Location:** `openai.realtime.service.js:1023`  
**Purpose:** Session initialization - triggers session.update  
**Payload Structure:**
```javascript
{
  type: 'session.created',
  session: {
    id: string,
    // ... other session properties
  }
}
```

#### `session.updated`
**Handler:** `handleSessionUpdated()`  
**Location:** `openai.realtime.service.js:1027`  
**Purpose:** Session configuration confirmed - marks session as ready  
**Payload Structure:**
```javascript
{
  type: 'session.updated',
  session: {
    // ... session configuration
  }
}
```

### Audio Buffer Events

#### `input_audio_buffer.speech_started`
**Handler:** Inline handler in `handleOpenAIMessage()`  
**Location:** `openai.realtime.service.js:1098`  
**Purpose:** User starts speaking - creates placeholder message, may interrupt AI  
**Payload Structure:**
```javascript
{
  type: 'input_audio_buffer.speech_started'
}
```

#### `input_audio_buffer.speech_stopped`
**Handler:** Inline handler in `handleOpenAIMessage()`  
**Location:** `openai.realtime.service.js:1132`  
**Purpose:** User stops speaking - saves transcript, triggers AI response  
**Payload Structure:**
```javascript
{
  type: 'input_audio_buffer.speech_stopped'
}
```

#### `input_audio_buffer.committed`
**Handler:** Inline handler in `handleOpenAIMessage()`  
**Location:** `openai.realtime.service.js:1256`  
**Purpose:** Audio buffer committed - clears pending audio  
**Payload Structure:**
```javascript
{
  type: 'input_audio_buffer.committed'
}
```

#### `input_audio_buffer.cleared`
**Handler:** Inline handler in `handleOpenAIMessage()`  
**Location:** `openai.realtime.service.js:1280`  
**Purpose:** Audio buffer cleared  
**Payload Structure:**
```javascript
{
  type: 'input_audio_buffer.cleared'
}
```

#### `input_audio_buffer.appended`
**Handler:** Inline handler in `handleOpenAIMessage()`  
**Location:** `openai.realtime.service.js:1289`  
**Purpose:** Audio appended to buffer  
**Payload Structure:**
```javascript
{
  type: 'input_audio_buffer.appended'
}
```

### Response Events

#### `response.content_part.added`
**Handler:** `MessageHandler.handleContentPartAdded()`  
**Location:** `openai.realtime.service.js:1031`  
**Purpose:** AI response content (text or audio) added  
**Payload Structure:**
```javascript
{
  type: 'response.content_part.added',
  response: {
    id: string,
    content: [{
      type: 'input_audio_transcription' | 'text' | 'audio',
      // ... content data
    }]
  }
}
```

#### `response.audio.delta`
**Handler:** `MessageHandler.handleResponseAudioDelta()`  
**Location:** `openai.realtime.service.js:1046`  
**Purpose:** AI audio chunk received - processes and sends to Asterisk  
**Payload Structure:**
```javascript
{
  type: 'response.audio.delta',
  delta: string, // Base64 encoded audio
  response: {
    id: string
  }
}
```

#### `response.done`
**Handler:** `handleResponseDone()`  
**Location:** `openai.realtime.service.js:1079`  
**Purpose:** AI response complete - saves transcript, resets flags  
**Payload Structure:**
```javascript
{
  type: 'response.done',
  response: {
    id: string,
    status: 'completed' | 'cancelled' | 'error',
    // ... other response properties
  }
}
```

#### `response.audio_transcript.delta`
**Handler:** `MessageHandler.handleResponseAudioTranscriptDelta()`  
**Location:** `openai.realtime.service.js:1088`  
**Purpose:** AI transcript chunk received  
**Payload Structure:**
```javascript
{
  type: 'response.audio_transcript.delta',
  delta: string, // Transcript text chunk
  response: {
    id: string
  }
}
```

#### `response.audio_transcript.done`
**Handler:** `MessageHandler.handleResponseAudioTranscriptDone()`  
**Location:** `openai.realtime.service.js:1093`  
**Purpose:** AI transcript complete  
**Payload Structure:**
```javascript
{
  type: 'response.audio_transcript.done',
  response: {
    id: string
  }
}
```

### Conversation Item Events

#### `conversation.item.created`
**Handler:** `handleConversationItemCreated()`  
**Location:** `openai.realtime.service.js:1075`  
**Purpose:** Conversation item created - may contain user transcript  
**Payload Structure:**
```javascript
{
  type: 'conversation.item.created',
  item: {
    id: string,
    type: 'message' | 'input_audio_transcription' | 'function_call',
    // ... item properties
  }
}
```

#### `conversation.item.input_audio_transcription.completed`
**Handler:** `handleInputAudioTranscriptionCompleted()`  
**Location:** `openai.realtime.service.js:1084`  
**Purpose:** User transcription complete - saves to database  
**Payload Structure:**
```javascript
{
  type: 'conversation.item.input_audio_transcription.completed',
  item: {
    id: string,
    input_audio_transcription: {
      transcript: string,
      // ... transcription properties
    }
  }
}
```

---

## Messages We Send (to OpenAI)

### Audio Buffer Messages

#### `input_audio_buffer.append`
**Location:** `openai.realtime.service.js:2314`  
**Purpose:** Send audio chunk to OpenAI  
**Message Structure:**
```javascript
{
  type: 'input_audio_buffer.append',
  audio: string // Base64 encoded PCM audio (G.711 μ-law)
}
```

#### `input_audio_buffer.commit`
**Location:** `openai.realtime.service.js:207, 2348, 2387`  
**Purpose:** Commit audio buffer - triggers speech detection  
**Message Structure:**
```javascript
{
  type: 'input_audio_buffer.commit'
}
```

#### `input_audio_buffer.clear`
**Location:** `openai.realtime.service.js:1272, 2783`  
**Purpose:** Clear audio buffer  
**Message Structure:**
```javascript
{
  type: 'input_audio_buffer.clear'
}
```

### Session Messages

#### `session.update`
**Location:** `openai.realtime.service.js:966`  
**Purpose:** Configure session (instructions, voice, turn detection, etc.)  
**Message Structure:**
```javascript
{
  type: 'session.update',
  session: {
    instructions: string,
    voice: string, // 'alloy', 'echo', 'shimmer', etc.
    input_audio_format: 'g711_ulaw',
    output_audio_format: 'g711_ulaw',
    turn_detection: {
      type: 'server_vad',
      threshold: 0.6,
      prefix_padding_ms: 200,
      silence_duration_ms: 500
    },
    input_audio_transcription: {
      model: 'whisper-1'
    }
  }
}
```

### Response Messages

#### `response.create`
**Location:** `openai.realtime.service.js:535`  
**Purpose:** Request AI response generation  
**Message Structure:**
```javascript
{
  type: 'response.create',
  response: {
    modalities: ['text', 'audio'],
    instructions: string, // Optional override
    // ... other response options
  }
}
```

#### `response.cancel`
**Location:** `openai.realtime.service.js:1119`  
**Purpose:** Cancel ongoing AI response (user interruption)  
**Message Structure:**
```javascript
{
  type: 'response.cancel'
}
```

### Conversation Item Messages

#### `conversation.item.create`
**Location:** `openai.realtime.service.js:2568, 2599, 2645`  
**Purpose:** Create conversation item (for context/history)  
**Message Structure:**
```javascript
{
  type: 'conversation.item.create',
  item: {
    type: 'message',
    role: 'user' | 'assistant',
    content: [{
      type: 'input_text',
      text: string
    }]
  }
}
```

---

## Current Implementation Details

### Audio Format
- **Input:** G.711 μ-law (8kHz, mono)
- **Output:** G.711 μ-law (8kHz, mono)
- **Source:** Asterisk RTP → UDP Listener → OpenAI
- **Destination:** OpenAI → Audio Processor → Asterisk RTP

### Session Configuration
- **Turn Detection:** Server VAD (Voice Activity Detection)
  - Threshold: 0.6
  - Prefix Padding: 200ms
  - Silence Duration: 500ms
- **Transcription:** Whisper-1 model
- **Voice:** Configurable (default: 'alloy')

### State Management
- Uses state machine for conversation flow
- Tracks user/AI speaking states
- Handles interruptions and turn-taking

### Message Ordering
- Creates placeholder messages when speech starts
- Updates placeholders when transcripts complete
- Preserves message order using MongoDB `_id` timestamps

---

## GA Migration Checklist

For each event/message above, verify in GA:
- [ ] Event name unchanged
- [ ] Payload structure unchanged
- [ ] Behavior unchanged
- [ ] New fields added (if any)
- [ ] Deprecated fields removed (if any)

---

## Notes

- We use **RTP** (not WebRTC), so WebRTC-specific changes don't apply
- All audio is G.711 μ-law format
- Session is configured once after `session.created`
- Turn detection uses server-side VAD
- We handle interruptions by canceling AI responses

