# Low-Latency Audio Quality Implementation Plan

## Goals (Prioritized)

1. **Minimize Latency** - Preserve conversational nature (< 200ms total)
2. **No Gaps/Stutters** - Smooth AI audio output
3. **Noise Handling** - Work well in noisy environments
4. **Quality** - Clear, natural-sounding AI voice

## Strategy: Smart, Lightweight Optimizations

### Core Principle
**Use OpenAI's built-in capabilities first** (no latency), then add minimal adaptive buffering only when needed.

---

## Phase 1: OpenAI Optimizations (Zero Latency Impact)

### 1.1 Optimize VAD Settings for Faster Response
**Current**: `silence_duration_ms: 1200` (1.2 seconds)
**Target**: `800-1000ms` for faster turn-taking

**Implementation**:
```javascript
turn_detection: {
  type: 'server_vad',
  threshold: 0.5,
  prefix_padding_ms: 200,  // Reduced from 300ms
  silence_duration_ms: 800  // Reduced from 1200ms (faster response)
}
```

**Impact**:
- ✅ **-400ms latency** (faster AI response)
- ✅ More conversational feel
- ⚠️ May cut off slow speakers (mitigate with adaptive threshold)

**Effort**: 5 minutes

---

### 1.2 Leverage OpenAI's Noise Reduction
**Current**: Using `whisper-1` for transcription
**Target**: Use latest models optimized for noise

**Implementation**:
1. Check for newer transcription models (e.g., `gpt-4o-transcribe`)
2. Enable any noise reduction features in session config
3. Test with noisy audio samples

**Impact**:
- ✅ Better noise handling (OpenAI's ML models)
- ✅ Zero latency (server-side processing)
- ✅ No code changes needed (just config)

**Effort**: 1-2 hours (research + testing)

---

### 1.3 Optimize Model Selection
**Current**: `gpt-4o-realtime-preview-2024-12-17`
**Target**: Check for newer models with better noise handling

**Impact**:
- ✅ Potential quality improvements
- ✅ Zero latency impact
- ✅ May reduce costs (if mini model works)

**Effort**: 1 hour (test with `scripts/test-realtime-models.js`)

---

## Phase 2: Lightweight Adaptive Buffering (Minimal Latency)

### 2.1 Smart Gap Detection (Not Static Buffers)
**Approach**: Detect gaps in real-time, add small buffer only when needed

**Current Issues**:
- RTP Sender has adaptive buffering (40-160ms) ✅
- RTP Listener: 40ms min buffer, 100ms flush interval
- OpenAI Service: 200 chunk buffer

**Implementation**:
1. **Monitor RTP sequence gaps** in real-time
2. **Detect pattern**: If gap detected, temporarily increase buffer by 20-40ms
3. **Auto-reduce**: When stable for 5 seconds, reduce buffer back to minimum

**Code Location**: `rtp.listener.service.js` and `rtp.sender.service.js`

**Impact**:
- ✅ **+20-40ms latency only when gaps detected** (vs +100ms static)
- ✅ Prevents gaps without constant latency penalty
- ✅ Self-adjusting

**Effort**: 2-3 hours

---

### 2.2 Optimize Buffer Flush Intervals
**Current**: RTP Listener flushes every 100ms
**Target**: Reduce to 50ms for lower latency (if stable)

**Implementation**:
```javascript
// rtp.listener.service.js
this.flushInterval = 50; // Reduced from 100ms
this.minAudioBytes = 160; // Reduced from 320 (20ms instead of 40ms)
```

**Impact**:
- ✅ **-50ms latency** (faster audio to OpenAI)
- ✅ More responsive transcription
- ⚠️ More frequent network calls (test for stability)

**Effort**: 30 minutes + testing

---

### 2.3 Reduce OpenAI Service Buffer Sizes
**Current**: `MAX_PENDING_CHUNKS: 200`, `AUDIO_BATCH_SIZE: 20`
**Target**: Reduce if stable (test first)

**Implementation**:
```javascript
// constants.js
MAX_PENDING_CHUNKS: 100,  // Reduced from 200
AUDIO_BATCH_SIZE: 10,     // Reduced from 20
MIN_AUDIO_DURATION_MS: 20, // Reduced from 40ms
```

**Impact**:
- ✅ **-20-40ms latency** (faster processing)
- ⚠️ May cause issues if network is unstable (test first)

**Effort**: 1 hour (testing required)

---

## Phase 3: Noise-Specific Optimizations

### 3.1 Audio Level Normalization
**Approach**: Lightweight gain adjustment (no heavy processing)

**Implementation**:
- Monitor audio levels in `audio.processor.js`
- Apply simple gain adjustment if audio is too quiet/loud
- Only for input audio (before sending to OpenAI)

**Impact**:
- ✅ Better transcription in noisy environments
- ✅ **~5ms latency** (minimal processing)
- ✅ Helps OpenAI's VAD work better

**Effort**: 2-3 hours

---

### 3.2 High-Pass Filter (Optional)
**Approach**: Remove low-frequency noise (machinery, rumble)

**Implementation**:
- Use simple high-pass filter (FFmpeg or lightweight library)
- Only if OpenAI's noise reduction insufficient
- Process in small chunks to minimize latency

**Impact**:
- ✅ Reduces low-frequency noise
- ⚠️ **+10-20ms latency** (processing overhead)
- ⚠️ Only if needed (test OpenAI first)

**Effort**: 4-5 hours (if needed)

---

## Implementation Priority

### Quick Wins (Do First - 2-3 hours)
1. ✅ Optimize VAD settings (800ms silence, 200ms padding)
2. ✅ Test newer OpenAI models
3. ✅ Reduce RTP Listener flush interval (50ms)
4. ✅ Reduce min audio bytes (20ms instead of 40ms)

**Expected Latency Reduction**: ~450ms
**Expected Quality Improvement**: Better noise handling

---

### Medium Priority (If Quick Wins Insufficient - 4-6 hours)
1. Smart gap detection (adaptive buffering)
2. Audio level normalization
3. Reduce OpenAI service buffer sizes (if stable)

**Expected Latency Impact**: +20-40ms only when gaps detected
**Expected Quality Improvement**: No gaps, better audio levels

---

### Advanced (Only If Needed - 8-10 hours)
1. High-pass filter for noise
2. Predictive gap filling
3. Advanced adaptive buffering

**Expected Latency Impact**: +10-20ms
**Expected Quality Improvement**: Handles extreme noise cases

---

## Testing Strategy

### Latency Testing
1. Measure end-to-end latency (user speaks → AI responds)
2. Target: < 200ms for conversational feel
3. Test with and without optimizations

### Quality Testing
1. Test in quiet environment (baseline)
2. Test in noisy environment (background chatter)
3. Test with machinery noise
4. Test with echo/reverb

### Gap Testing
1. Simulate network jitter
2. Monitor for gaps in AI audio
3. Verify adaptive buffering activates

---

## Configuration Changes Summary

### OpenAI Session Config
```javascript
{
  turn_detection: {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 200,      // Reduced from 300
    silence_duration_ms: 800     // Reduced from 1200
  },
  input_audio_transcription: {
    model: 'gpt-4o-transcribe'  // If available, or latest
  }
}
```

### Constants (constants.js)
```javascript
{
  MIN_AUDIO_DURATION_MS: 20,     // Reduced from 40
  MIN_AUDIO_BYTES: 160,          // Reduced from 320
  AUDIO_BATCH_SIZE: 10,          // Reduced from 20 (test first)
  MAX_PENDING_CHUNKS: 100,       // Reduced from 200 (test first)
}
```

### RTP Listener (rtp.listener.service.js)
```javascript
this.flushInterval = 50;         // Reduced from 100ms
this.minAudioBytes = 160;        // Reduced from 320 (20ms)
```

---

## Expected Results

### Latency
- **Current**: ~500-700ms (estimated)
- **After Quick Wins**: ~200-300ms
- **After All Optimizations**: ~200-250ms (with quality)

### Quality
- **Noise Handling**: Better (OpenAI models + normalization)
- **Gaps**: Eliminated (adaptive buffering)
- **Conversational**: Improved (faster VAD)

### Trade-offs
- ⚠️ Slightly more aggressive VAD (may cut off slow speakers)
- ⚠️ Smaller buffers (may need adjustment if network unstable)
- ✅ Overall: Much better balance of latency and quality

---

## Next Steps

1. **Start with Quick Wins** (2-3 hours)
   - Update VAD settings
   - Test newer models
   - Reduce buffer sizes
   - Test on staging

2. **Measure Results** (1 hour)
   - Latency measurements
   - Quality assessment
   - Gap detection

3. **Iterate** (as needed)
   - Add adaptive buffering if gaps persist
   - Add normalization if noise still an issue
   - Fine-tune based on real-world testing

---

## Notes

- **Always test on staging first** before production
- **Monitor metrics** after each change
- **Have rollback plan** ready
- **User feedback** is critical - test with real calls

