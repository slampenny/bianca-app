# Staging Test Checklist - OpenAI Realtime API GA Migration

**Date:** December 21, 2025  
**Purpose:** Verify GA API works correctly with real phone calls in staging environment

## Pre-Deployment Checklist

- [ ] Code pushed to staging branch
- [ ] Environment variable `OPENAI_REALTIME_USE_GA` set appropriately
  - For initial testing: `false` (use Beta) to establish baseline
  - For GA testing: `true` (use GA)
- [ ] Verify API key is set correctly in staging environment
- [ ] Check that model names are correct:
  - Beta: `gpt-4o-realtime-preview-2025-01-12`
  - GA: `gpt-realtime` (auto-selected when `OPENAI_REALTIME_USE_GA=true`)

## During Call Testing

### Basic Functionality
- [ ] Call connects successfully
- [ ] Session is created (`session.created` event)
- [ ] Session configuration is accepted (`session.updated` event)
- [ ] AI responds to user speech
- [ ] Audio flows in both directions (user → AI, AI → user)
- [ ] Transcription works correctly
- [ ] Conversation items are created

### Log Monitoring
Check logs for:
- [ ] API version indicators: `(GA)` or `(Beta)` in log messages
- [ ] Model name in connection logs matches expected API version
- [ ] No errors about unknown parameters
- [ ] No errors about invalid session structure
- [ ] Session.update structure matches API version (GA vs Beta)

### Audio Quality
- [ ] Audio quality is acceptable (no degradation vs Beta)
- [ ] Latency is acceptable (should be same or better than Beta)
- [ ] No audio dropouts or glitches
- [ ] Turn detection works correctly (AI stops when user speaks)

### Error Handling
- [ ] Reconnection works if connection drops
- [ ] Errors are logged with API version information
- [ ] No unexpected disconnections
- [ ] Error messages are clear and actionable

## Specific GA Differences to Verify

### Session Structure
- [ ] GA uses `session.type: 'realtime'` ✅
- [ ] GA uses `session.audio.input.format.type: 'audio/pcmu'` ✅
- [ ] GA uses `session.audio.output.format.type: 'audio/pcmu'` ✅
- [ ] GA uses `session.audio.output.voice` (not `session.voice`) ✅
- [ ] GA uses `session.audio.input.turn_detection` (not `session.turn_detection`) ✅
- [ ] GA does NOT use `session.modalities` ✅
- [ ] GA does NOT use `session.input_audio_format` ✅

### Event Names
- [ ] GA uses `response.output_audio.delta` (not `response.audio.delta`)
- [ ] GA uses `response.output_audio_transcript.delta` (not `response.audio_transcript.delta`)
- [ ] Other event names should be the same

### Headers
- [ ] GA does NOT send `OpenAI-Beta: realtime=v1` header ✅
- [ ] Beta DOES send `OpenAI-Beta: realtime=v1` header ✅

## Comparison Testing

### Test Sequence
1. **Baseline Test (Beta)**
   - Set `OPENAI_REALTIME_USE_GA=false`
   - Make test call
   - Note: Audio quality, latency, any issues

2. **GA Test**
   - Set `OPENAI_REALTIME_USE_GA=true`
   - Make test call
   - Compare: Audio quality, latency, behavior

3. **Side-by-Side Comparison**
   - Make calls with both APIs
   - Compare audio quality
   - Compare response times
   - Compare transcription accuracy

## Rollback Plan

If issues are found:
1. Set `OPENAI_REALTIME_USE_GA=false` to revert to Beta
2. Document issues found
3. Review logs for error patterns
4. Fix issues and retest

## Success Criteria

- [ ] All calls complete successfully with GA API
- [ ] Audio quality matches or exceeds Beta
- [ ] No new errors or warnings
- [ ] All event handlers work correctly
- [ ] Logs show correct API version usage
- [ ] Ready for gradual production rollout

## Notes Section

_Use this space to document any issues, observations, or deviations from expected behavior:_

---

**Tested By:** _______________  
**Date:** _______________  
**Result:** [ ] Pass [ ] Fail [ ] Needs Review

