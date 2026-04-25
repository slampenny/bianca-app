# OpenAI Realtime API Beta to GA Migration Plan

**Status:** Planning  
**Target Completion:** Before February 27, 2026 (Beta Deprecation Date)  
**Last Updated:** December 21, 2025

## Executive Summary

OpenAI's Realtime API is transitioning from Beta to General Availability (GA). The Beta version will be **deprecated on February 27, 2026**. This document outlines the migration plan for our RTP-based implementation.

### Key Dates
- **Beta Deprecation:** February 27, 2026
- **Recommended Migration:** Complete by January 31, 2026 (1 month buffer)
- **Current Status:** Using Beta API with `OpenAI-Beta: realtime=v1` header

---

## Current Implementation Analysis

### Beta Features Currently Used

#### 1. **Beta Header** (CRITICAL - Must Remove)
**Location:** 2 files
- `packages/backend/src/services/openai.realtime.service.js` (line 3658)
- `packages/backend/src/services/ai/realtime/connection.manager.js` (line 37)

**Current Code:**
```javascript
headers: {
  Authorization: `Bearer ${config.openai.apiKey}`,
  'OpenAI-Beta': 'realtime=v1',  // ❌ MUST REMOVE
}
```

#### 2. **Event Handlers** (Verify Compatibility)
We handle the following events - need to verify if names/structures changed:

**Session Events:**
- `session.created` - Session initialization
- `session.updated` - Session configuration updates

**Audio Buffer Events:**
- `input_audio_buffer.speech_started` - User starts speaking
- `input_audio_buffer.speech_stopped` - User stops speaking
- `input_audio_buffer.committed` - Audio buffer committed
- `input_audio_buffer.cleared` - Audio buffer cleared
- `input_audio_buffer.appended` - Audio appended to buffer

**Response Events:**
- `response.content_part.added` - AI response content (text/audio)
- `response.audio.delta` - AI audio chunks
- `response.done` - AI response complete
- `response.audio_transcript.delta` - AI transcript updates
- `response.audio_transcript.done` - AI transcript complete

**Conversation Item Events:**
- `conversation.item.created` - Conversation item created
- `conversation.item.input_audio_transcription.completed` - User transcription complete

**Message Types We Send:**
- `input_audio_buffer.append` - Send audio to OpenAI
- `input_audio_buffer.commit` - Commit audio buffer
- `input_audio_buffer.clear` - Clear audio buffer
- `session.update` - Update session configuration
- `response.create` - Request AI response
- `response.cancel` - Cancel AI response
- `conversation.item.create` - Create conversation item

#### 3. **RTP vs WebRTC**
**Important:** We use **RTP** (not WebRTC), so WebRTC-specific migration steps in OpenAI's guide do NOT apply to us.

**Our Audio Flow:**
```
Asterisk RTP → UDP Listener → Audio Processing → OpenAI Realtime API (WebSocket)
```

---

## GA Migration Changes

### 1. **Header Changes** (REQUIRED)

**Remove:**
```javascript
'OpenAI-Beta': 'realtime=v1'
```

**Add (if needed):**
```javascript
'OpenAI-API-Version': '2025-01-XX'  // Use latest GA version date
```

**Note:** According to latest information, GA may not require a version header. Test without it first.

### 2. **Feature Availability in GA**

**New Features Available in GA (not in Beta):**
- ✅ **Image Input** - Not currently used
- ✅ **Async Function Calling** - Not currently used
- ✅ **Audio Token to Text** - May be useful for debugging
- ✅ **EU Data Residency** - May be useful for compliance

**Removed/Changed in GA:**
- ❌ **Temperature Parameter** - Removed in GA (was 0.6-1.2 in beta, default 0.8)
  - **Impact:** We don't currently set temperature, so no change needed

**Transcription Model Update:**
- ✅ **Updated to Latest Models** - `whisper-1` is deprecated
  - **New Models:**
    - `gpt-4o-mini-transcribe` - Faster, low-latency (default for real-time)
    - `gpt-4o-transcribe` - Higher accuracy (optional)
  - **Impact:** Updated code to use `gpt-4o-mini-transcribe` by default
  - **Configurable:** Can override via `OPENAI_REALTIME_TRANSCRIPTION_MODEL` env var

### 3. **Event Name Verification**

**Status:** ✅ Event names appear unchanged, but **session.update structure HAS CHANGED**

**Critical Finding:** The `session.update` structure changed in GA:
- **Beta Format:**
  ```javascript
  {
    type: 'session.update',
    session: {
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw',
      input_audio_transcription: { model: 'whisper-1' }
    }
  }
  ```

- **GA Format:**
  ```javascript
  {
    type: 'session.update',
    session: {
      audio: {
        input: {
          format: { type: 'g711_ulaw' },
          transcription: { model: 'whisper-1' }
        },
        output: {
          format: { type: 'g711_ulaw' }
        }
      }
    }
  }
  ```

**Action Taken:** Updated `MessageHandler.buildSessionConfig()` to support both formats based on `config.openai.useGA` flag.

**Events to Test:**
- All `input_audio_buffer.*` events
- All `response.*` events
- All `conversation.item.*` events
- All `session.*` events

### 4. **API Endpoint**

**Current:**
```
wss://api.openai.com/v1/realtime?model={model}&voice={voice}
```

**GA:** Same endpoint (no change expected)

---

## Migration Steps

### Phase 1: Preparation (Week 1) ✅ COMPLETED

#### Step 1.1: Review Latest Documentation ✅
- [x] Review [OpenAI Realtime API GA Documentation](https://platform.openai.com/docs/guides/realtime)
- [x] Review [Migration Guide](https://platform.openai.com/docs/guides/realtime#beta-to-ga-migration)
- [x] Check for any breaking changes in event structures
  - **Finding:** Event names appear unchanged, but session.update structure may have changed in GA
  - **Action:** Will verify during Phase 3 testing
- [x] Verify model names (we updated to `gpt-4o-realtime-preview-2025-01-12`)
  - **Status:** Model names updated in previous work

#### Step 1.2: Create Feature Flag ✅
- [x] Add environment variable: `OPENAI_REALTIME_USE_GA` (default: false)
  - **Location:** `packages/backend/src/config/config.js:110`
  - **Type:** `Joi.boolean().default(false)`
- [x] Add config option to toggle between beta and GA
  - **Location:** `packages/backend/src/config/domains/openai.config.js:26`
  - **Property:** `config.openai.useGA`
- [x] Update connection code to use feature flag
  - **Files Updated:**
    - `packages/backend/src/services/ai/realtime/connection.manager.js:33-39`
    - `packages/backend/src/services/openai.realtime.service.js:3655-3660`
  - **Behavior:** Beta header only added if `useGA === false`
- [x] This allows gradual rollout and easy rollback

#### Step 1.3: Document Current Behavior ✅
- [x] Document all event handlers and their expected payloads
  - **Document:** `packages/backend/docs/technical/OPENAI_REALTIME_EVENT_DOCUMENTATION.md`
  - **Contents:** Complete list of all events received and messages sent
- [x] Create test cases for each event type
  - **Status:** Test cases documented in Phase 3 section
- [x] Document audio flow (RTP → OpenAI)
  - **Documented:** RTP flow, audio formats, session configuration

### Phase 2: Implementation (Week 2) ✅ COMPLETED

#### Step 2.1: Remove Beta Header ✅
**Status:** Conditionally removed based on feature flag
- [x] Beta header only added if `useGA === false`
- [x] Updated in 2 files:
  - `packages/backend/src/services/openai.realtime.service.js` - Test connection method
  - `packages/backend/src/services/ai/realtime/connection.manager.js` - Main connection method
- [x] Feature flag allows gradual rollout without code changes

**Implementation:**
```javascript
// Build headers - remove beta header if using GA
const headers = {
  Authorization: `Bearer ${config.openai.apiKey}`,
};

// Only add beta header if NOT using GA
if (!useGA) {
  headers['OpenAI-Beta'] = 'realtime=v1';
}
```

#### Step 2.2: Update Configuration ✅
- [x] Update default model to latest GA-compatible model
  - **Status:** ✅ **COMPLETED** - Model names are now auto-selected based on `useGA` flag
  - **Beta Model:** `gpt-4o-realtime-preview-2025-01-12` (when `OPENAI_REALTIME_USE_GA=false`)
  - **GA Model:** `gpt-realtime` (when `OPENAI_REALTIME_USE_GA=true`)
  - **Implementation:** Model selection is automatic in `openai.config.js` based on `useGA` flag
  - **Override:** Can still override via `OPENAI_REALTIME_MODEL` env var if needed
- [x] Add feature flag support
  - **Status:** Feature flag implemented in Phase 1
- [x] Update session.update structure for GA compatibility
  - **Status:** ✅ **COMPLETED** - `MessageHandler.buildSessionConfig()` now supports both Beta and GA formats
  - **Files Updated:**
    - `packages/backend/src/services/ai/realtime/message.handler.js` - Added GA format support
    - `packages/backend/src/services/openai.realtime.service.js` - Uses MessageHandler for session config
- [x] Update transcription model to latest
  - **Status:** ✅ **COMPLETED** - Updated from `whisper-1` to `gpt-4o-mini-transcribe`
  - **Configurable:** Via `OPENAI_REALTIME_TRANSCRIPTION_MODEL` env var

#### Step 2.3: Add Logging ✅
- [x] Add logging to track which API version is being used
  - **Status:** ✅ **COMPLETED** - Added API version logging throughout
  - **Locations:**
    - Connection initialization
    - WebSocket open/close/error events
    - Session created/updated events
    - Message processing
    - Error handling
- [x] Log any unexpected event structures
  - **Status:** ✅ **COMPLETED** - Default case logs unexpected events with API version
  - **Tracking:** Unexpected events stored in connection state for monitoring
- [x] Add metrics for migration monitoring
  - **Status:** ✅ **COMPLETED** - Logs include API version in all relevant messages
  - **Format:** `(GA)` or `(Beta)` appended to log messages

### Phase 3: Testing (Week 3)

#### Step 3.1: Local Testing ✅ COMPLETED
- [x] Create local testing script
  - **Status:** ✅ **COMPLETED** - `scripts/test-openai-realtime-local.js`
  - **Usage:** `node scripts/test-openai-realtime-local.js`
  - **Documentation:** `docs/technical/LOCAL_TESTING_GUIDE.md`
- [x] Create HTTP test endpoint
  - **Status:** ✅ **COMPLETED** - `POST /v1/test/openai-connection`
  - **Location:** `src/routes/v1/test.route.js`
  - **Supports:** Beta/GA override via request body
- [x] Create comprehensive event handler test
  - **Status:** ✅ **COMPLETED** - `scripts/test-openai-realtime-events.js`
  - **Tests:** All major event handlers (session, response, audio buffer events)
  - **Supports:** Both Beta and GA APIs
- [x] Test WebSocket connection without beta header (local)
  - **Status:** ✅ **COMPLETED** - GA connection tested and working
- [x] Test all event handlers with GA responses (local)
  - **Status:** ✅ **COMPLETED** - All event handlers tested with GA API
  - **Events Tested:** session.created, session.updated, response.created, response.content_part.added, response.audio.delta, response.done, input_audio_buffer events
- [ ] Verify audio flow still works (staging) - Requires staging deployment

#### Step 3.2: Integration Tests ✅ COMPLETED
- [x] Create integration test suite
  - **Status:** ✅ **COMPLETED** - `tests/integration/openai-realtime.integration.test.js`
  - **Supports:** Both Beta and GA via `OPENAI_REALTIME_USE_GA` env var
- [x] Test session configuration for both APIs
  - **Status:** ✅ **COMPLETED** - Tests verify correct model names, formats, and structures
- [x] Test call workflow with OpenAI Realtime
  - **Status:** ✅ **COMPLETED** - Call initiation and conversation creation tested
- [ ] Test RTP audio → OpenAI → RTP audio loop (requires real Asterisk setup)
- [ ] Test response generation with real audio (requires real call)
- [ ] Test conversation item creation with real transcripts (requires real call)

#### Step 3.3: Staging Environment Testing 🚀 IN PROGRESS
- [ ] Deploy to staging with GA API
- [ ] Run full test suite
- [ ] Test with real phone calls
- [ ] Monitor for any errors or unexpected behavior
- [ ] Compare audio quality with beta version
- [ ] Verify session.update structure works correctly
- [ ] Check logs for API version indicators (GA vs Beta)
- [ ] Test reconnection behavior if connection drops

#### Step 3.4: Performance Testing
- [ ] Measure latency (should be same or better)
- [ ] Test reconnection behavior
- [ ] Test error handling
- [ ] Verify audio quality

### Phase 4: Rollout (Week 4)

#### Step 4.1: Gradual Rollout
- [ ] Enable GA for 10% of calls (via feature flag)
- [ ] Monitor for 24 hours
- [ ] If successful, increase to 50%
- [ ] Monitor for 24 hours
- [ ] If successful, increase to 100%

#### Step 4.2: Production Deployment
- [ ] Deploy to production
- [ ] Enable GA for all calls
- [ ] Monitor closely for first 48 hours
- [ ] Keep beta code available for rollback if needed

#### Step 4.3: Cleanup
- [ ] Remove feature flag after 1 week of stable operation
- [ ] Remove beta-specific code paths
- [ ] Update documentation

---

## Testing Strategy

### Test Cases

#### 1. Connection Tests
- [ ] WebSocket connects successfully without beta header
- [ ] Session is created correctly
- [ ] Session update works

#### 2. Audio Flow Tests
- [ ] RTP audio received from Asterisk
- [ ] Audio sent to OpenAI via `input_audio_buffer.append`
- [ ] Audio committed via `input_audio_buffer.commit`
- [ ] AI response audio received via `response.audio.delta`
- [ ] Audio sent back to Asterisk via RTP

#### 3. Event Handler Tests
- [ ] `session.created` - Session initialization
- [ ] `session.updated` - Session ready
- [ ] `input_audio_buffer.speech_started` - User speech detection
- [ ] `input_audio_buffer.speech_stopped` - User speech end
- [ ] `response.audio.delta` - AI audio chunks
- [ ] `response.done` - AI response complete
- [ ] `conversation.item.created` - Conversation items
- [ ] `conversation.item.input_audio_transcription.completed` - User transcription

#### 4. Error Handling Tests
- [ ] Connection failures
- [ ] Reconnection behavior
- [ ] Invalid audio format handling
- [ ] Timeout handling

#### 5. Edge Cases
- [ ] Rapid user interruptions
- [ ] Long pauses
- [ ] Network interruptions
- [ ] Multiple concurrent calls

### Test Environment Setup

```bash
# Set environment variable for testing
export OPENAI_REALTIME_USE_GA=true
export OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2025-01-12

# Run tests
cd packages/backend
yarn test tests/unit/services/openai.realtime.service.test.js
```

---

## Rollback Plan

### If Issues Detected

1. **Immediate Rollback:**
   - Revert code changes (git revert)
   - Restore beta header
   - Redeploy

2. **Feature Flag Rollback:**
   - Set `OPENAI_REALTIME_USE_GA=false`
   - Restart services
   - No code deployment needed

3. **Partial Rollback:**
   - Keep GA for some calls, beta for others
   - Use feature flag to control percentage

### Rollback Triggers

Rollback if:
- Connection failure rate > 1%
- Audio quality degradation
- Unexpected event structures
- Increased latency > 10%
- Any critical errors

---

## Risk Assessment

### Low Risk
- ✅ Removing beta header (simple change)
- ✅ Event names likely unchanged
- ✅ RTP flow unaffected (we don't use WebRTC)

### Medium Risk
- ⚠️ Event structure changes (may need payload updates)
- ⚠️ Model compatibility (verify model name works with GA)
- ⚠️ Session configuration changes

### High Risk
- ❌ None identified (GA is backward compatible)

---

## Timeline

| Phase | Duration | Target Date | Status |
|-------|----------|-------------|--------|
| Preparation | 1 week | Jan 1-7, 2026 | ✅ **COMPLETED** (Dec 21, 2025) |
| Implementation | 1 week | Jan 8-14, 2026 | ✅ **COMPLETED** (Dec 21, 2025) |
| Testing | 1 week | Jan 15-21, 2026 | ✅ **MOSTLY COMPLETE** (Dec 21, 2025) |
| Rollout | 1 week | Jan 22-28, 2026 | Not Started |
| **Total** | **4 weeks** | **Jan 31, 2026** | **Ahead of Schedule** |

**Buffer:** 4 weeks before beta deprecation (Feb 27, 2026)

---

## Success Criteria

Migration is successful when:
- [ ] All calls use GA API (no beta header)
- [ ] Zero increase in error rate
- [ ] Audio quality maintained or improved
- [ ] Latency maintained or improved
- [ ] All tests passing
- [ ] 7 days of stable production operation

---

## Resources

### Documentation
- [OpenAI Realtime API GA Docs](https://platform.openai.com/docs/guides/realtime)
- [Migration Guide](https://platform.openai.com/docs/guides/realtime#beta-to-ga-migration)
- [Deprecation Notice](https://platform.openai.com/docs/deprecations/overview)

### Internal Documentation
- `packages/backend/src/services/openai.realtime.service.js` - Main service
- `packages/backend/src/services/ai/realtime/connection.manager.js` - Connection management
- `packages/backend/src/services/ai/realtime/message.handler.js` - Message handling

### Related Documents

- [Local Testing Guide](./LOCAL_TESTING_GUIDE.md) - How to test Beta/GA migration locally without staging
- `OPENAI_COST_ANALYSIS.md` - Model cost information
- `CALL_QUALITY_IMPROVEMENT_STRATEGY.md` - Audio quality improvements

---

## Notes

### RTP-Specific Considerations

Since we use RTP (not WebRTC), we don't need to worry about:
- WebRTC SDP data URL changes
- WebRTC-specific migration steps
- Client-side WebRTC code changes

Our migration is simpler - just remove the beta header and verify events work.

### Model Names

We've already updated to:
- Realtime: `gpt-4o-realtime-preview-2025-01-12`
- Standard (chat / LangChain): `gpt-4o` (see `OPENAI_MODEL` in config)

Verify these work with GA API.

### Temperature Parameter

We don't currently set temperature, so the removal of this parameter in GA has no impact on us.

---

## Questions to Resolve

1. [x] What is the exact GA model name? (Verify `gpt-4o-realtime-preview-2025-01-12` works)
   - **Status:** Model names updated, will verify during testing
2. [x] Do event structures change in GA? (Test all events)
   - **Status:** ✅ **FOUND** - `session.update` structure changed (audio settings nested)
   - **Action:** Code updated to support both formats
3. [ ] Is `OpenAI-API-Version` header required? (Test without it first)
   - **Status:** Will test during Phase 3
4. [ ] Are there any new features we should adopt? (Image input, async function calling)
   - **Status:** Not needed for initial migration, can evaluate later

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-21 | Auto | Initial migration plan created |
| 2025-12-21 | Auto | Phase 1 completed: Feature flag added, event documentation created |
| 2025-12-21 | Auto | **CRITICAL:** Found session.update structure change - updated code to support both Beta and GA formats |
| 2025-12-21 | Auto | Updated transcription model from whisper-1 to gpt-4o-mini-transcribe (latest, faster for real-time) |
| 2025-12-21 | Auto | Phase 2 completed: Beta header conditionally removed, configuration updated, comprehensive logging added |
| 2025-12-21 | Auto | Local testing tools created: `scripts/test-openai-realtime-local.js` and `POST /v1/test/openai-connection` endpoint (see LOCAL_TESTING_GUIDE.md) |
| 2025-12-21 | Auto | **CRITICAL:** GA uses different model name `gpt-realtime` (not `gpt-4o-realtime-preview-2025-01-12`). Updated code to auto-select model based on `useGA` flag |
| 2025-12-21 | Auto | Phase 3.1 completed: Comprehensive event handler testing script created and tested with both Beta and GA APIs |
| 2025-12-21 | Auto | Phase 3.2 completed: Integration tests created and passing for both Beta and GA APIs. Tests verify session configuration, model selection, and call workflow |

---

**Next Steps:**
1. Review and approve this migration plan
2. Begin Phase 1: Preparation
3. Set up feature flag for gradual rollout
4. Schedule testing window

