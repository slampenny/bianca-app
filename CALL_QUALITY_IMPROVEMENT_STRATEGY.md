# Call Quality Improvement Strategy

> **Related Documents**: See `OPENAI_COST_ANALYSIS.md` for model cost comparison and potential savings.

## Problem Statement

1. **Predictable Audio Gaps**: Occasional gaps in audio at predictable periods
2. **Noisy Environments**: Poor call quality in very noisy environments
3. **Cost Optimization**: Explore cheaper models that maintain quality (see cost analysis)

## Current Architecture Analysis

### Audio Pipeline
- **RTP Listener**: Receives audio from Asterisk, buffers 40ms minimum (320 bytes), flushes every 100ms
- **OpenAI Realtime Service**: Receives μ-law audio, buffers in `pendingAudio`, sends to OpenAI WebSocket
- **RTP Sender**: Sends audio to Asterisk with 20ms frame intervals, has buffer underrun detection
- **OpenAI VAD**: Server-side Voice Activity Detection enabled with 1200ms silence duration

### Current Buffering Strategy
- RTP Listener: 40ms minimum buffer (320 bytes at 8kHz)
- OpenAI Service: `MAX_PENDING_CHUNKS: 200`, `AUDIO_BATCH_SIZE: 20`
- RTP Sender: 40-160ms buffer range (640-2560 bytes)

### Current OpenAI Configuration
```javascript
{
  model: 'gpt-4o-realtime-preview-2024-12-17',
  voice: 'alloy',
  input_audio_format: 'g711_ulaw',
  output_audio_format: 'g711_ulaw',
  turn_detection: {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 1200
  },
  input_audio_transcription: {
    model: 'whisper-1'
  }
}
```

### Known Issues
- Buffer underruns detected in RTP Sender (logged but may cause gaps)
- Audio quality monitoring at 30-second mark (may miss earlier issues)
- No adaptive buffering based on network conditions
- No noise reduction/preprocessing before sending to OpenAI
- Using `whisper-1` for transcription (may not be latest/best for noisy environments)

---

## Strategy Options

### 1. Fix Predictable Audio Gaps

#### Option 1A: Enhanced Adaptive Buffering (Recommended)
**Approach**: Implement dynamic buffer sizing based on network conditions and packet loss

**Implementation**:
- Monitor RTP packet sequence numbers for gaps
- Track buffer fill rates and adjust target buffer size dynamically
- Increase buffer size when gaps detected, decrease when stable
- Add jitter buffer with configurable depth (50-200ms)

**Pros**:
- Addresses root cause (network jitter/packet loss)
- Self-adjusting, no manual tuning needed
- Works for all call types

**Cons**:
- Adds latency (50-200ms depending on jitter buffer depth)
- More complex to implement and test

**Effort**: Medium (2-3 days)

---

#### Option 1B: Predictive Gap Filling
**Approach**: Detect patterns in gaps and pre-buffer before expected gaps

**Implementation**:
- Track gap timing patterns per call
- Build predictive model for when gaps occur
- Pre-buffer extra audio before predicted gap times
- Use silence insertion as fallback if prediction fails

**Pros**:
- Minimal latency impact
- Can be very effective if gaps are truly predictable

**Cons**:
- Only works if gaps are truly predictable
- Requires pattern detection logic
- May not help with random network issues

**Effort**: Medium-High (3-4 days)

---

#### Option 1C: Increase Static Buffer Sizes
**Approach**: Simply increase all buffer sizes to handle more jitter

**Implementation**:
- Increase RTP Listener `minAudioBytes` from 320 to 640 (80ms)
- Increase RTP Sender buffer sizes (already at 40-160ms, could go to 80-200ms)
- Increase OpenAI `MAX_PENDING_CHUNKS` from 200 to 400

**Pros**:
- Simplest solution
- Quick to implement
- Low risk

**Cons**:
- Adds latency (40-80ms)
- Doesn't address root cause
- May not help if gaps are due to other issues

**Effort**: Low (1-2 hours)

---

### 2. Handle Noisy Environments

#### Option 2A: Leverage OpenAI's Built-in Noise Reduction (Recommended)
**Approach**: Use OpenAI Realtime API's built-in audio processing capabilities

**OpenAI Features Available**:
1. **Server-side VAD** (already enabled): Better speech detection in noise
2. **Audio Quality Settings**: Configure `input_audio_transcription` with quality hints
3. **Model Selection**: Use `gpt-4o-realtime-preview-2024-10-01` or newer (better noise handling)
4. **Temperature/Moderation**: Adjust response parameters for noisy environments

**Implementation**:
```javascript
// In session configuration
{
  input_audio_transcription: {
    model: "whisper-1",  // Or newer model if available
    // Add quality hints if API supports
  },
  // Enable enhanced noise reduction if available in API
  audio_processing: {
    noise_reduction: true,  // If supported
    echo_cancellation: true  // If supported
  }
}
```

**Pros**:
- Uses OpenAI's advanced ML models (trained on noisy data)
- No additional processing overhead
- Leverages OpenAI's continuous improvements
- HIPAA-compliant (data stays with OpenAI)

**Cons**:
- Depends on OpenAI API features (may not all be available yet)
- May require API updates
- Less control over processing

**Effort**: Low-Medium (1-2 days, depends on API availability)

---

#### Option 2B: Pre-processing Audio with Noise Reduction
**Approach**: Apply noise reduction before sending to OpenAI

**Implementation Options**:

**2B-1: Web Audio API (Browser-side) - Not Applicable**
- Only works in browser, we're server-side

**2B-2: FFmpeg Audio Filters**
- Use FFmpeg's `highpass`, `lowpass`, `noisegate`, `anlmdn` (non-local means denoise)
- Process audio chunks before sending to OpenAI
- Requires FFmpeg binary and additional processing

**2B-3: WebRTC Audio Processing Libraries**
- Use libraries like `@krisp/webrtc-audio-processor` (Node.js port)
- Real-time noise suppression
- Designed for voice calls

**2B-4: Machine Learning Models (TensorFlow.js)**
- Use pre-trained noise reduction models (e.g., DeepNoise, RNNoise)
- Run inference on audio chunks
- More accurate but higher CPU usage

**Pros**:
- Full control over processing
- Can tune for specific noise types
- Works regardless of OpenAI features

**Cons**:
- Adds processing latency (10-50ms)
- Increases CPU usage
- More complex to implement and maintain
- May degrade audio quality if not tuned correctly

**Effort**: High (5-7 days for proper implementation)

---

#### Option 2C: Hybrid Approach - OpenAI + Light Pre-processing
**Approach**: Combine light pre-processing with OpenAI's capabilities

**Implementation**:
- Apply simple audio normalization (gain adjustment)
- Use basic high-pass filter to remove low-frequency noise
- Let OpenAI handle advanced noise reduction
- Monitor audio levels and adjust gain dynamically

**Pros**:
- Best of both worlds
- Minimal latency impact
- Leverages OpenAI while improving input quality

**Cons**:
- More complex than single approach
- Requires tuning

**Effort**: Medium (3-4 days)

---

### 3. OpenAI-Specific Improvements

#### Option 3A: Optimize VAD Settings
**Current**: `silence_duration_ms: 1200`

**Options**:
- **Reduce to 800-1000ms**: Faster response, but may cut off slow speakers
- **Increase to 1500-2000ms**: Better for noisy environments, but slower response
- **Make adaptive**: Adjust based on detected noise levels

**Effort**: Low (1-2 hours)

---

#### Option 3B: Use Latest OpenAI Models
**Current**: `gpt-4o-realtime-preview-2024-12-17`

**Check for**:
- `gpt-4o-realtime-preview-2024-12-XX` or newer (check OpenAI API docs)
- Models specifically optimized for noisy environments
- Better transcription models (e.g., `gpt-4o-transcribe` or `gpt-4o-mini-transcribe` if available for realtime API)

**Implementation**:
- Update model name in `connection.manager.js` (line 41)
- Update transcription model in `openai.realtime.service.js` (line 702) if newer models available
- Test with noisy audio samples
- Compare accuracy metrics

**Effort**: Low (2-4 hours for testing)

---

#### Option 3C: Configure Audio Input Settings
**Explore OpenAI API for**:
- `input_audio_format` options
- `input_audio_quality` settings
- `input_audio_sample_rate` (currently using 8kHz, could try 16kHz if supported)
- `input_audio_channels` configuration

**Effort**: Low-Medium (1-2 days for research and testing)

---

### 4. Monitoring and Diagnostics

#### Option 4A: Enhanced Audio Quality Metrics
**Add monitoring for**:
- Packet loss rate (RTP sequence gaps)
- Jitter (packet arrival time variance)
- Buffer fill rates (under/overruns)
- Audio level/energy (detect silence vs noise)
- Signal-to-noise ratio (if possible)

**Implementation**:
- Extend existing `monitorAudioQuality()` function
- Add real-time dashboard/metrics
- Alert on quality degradation

**Effort**: Medium (2-3 days)

---

#### Option 4B: Audio Gap Detection and Logging
**Track**:
- Gap frequency and timing patterns
- Gap duration
- Associated network conditions
- Call metadata (patient, time of day, etc.)

**Implementation**:
- Detect gaps in RTP sequence numbers
- Log to structured format (JSON)
- Analyze patterns post-call

**Effort**: Low-Medium (1-2 days)

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (1-2 days)
1. **Option 1C**: Increase static buffer sizes slightly (low risk)
2. **Option 3A**: Tune VAD settings based on testing
3. **Option 3B**: Check for and use latest OpenAI models
4. **Option 4B**: Add gap detection and logging

### Phase 2: OpenAI Optimization (2-3 days)
1. **Option 2A**: Research and implement OpenAI's built-in noise reduction features
2. **Option 3C**: Optimize audio input settings
3. Test with noisy audio samples

### Phase 3: Advanced Solutions (if needed, 5-7 days)
1. **Option 1A**: Implement adaptive buffering
2. **Option 2C**: Add light pre-processing if OpenAI features insufficient
3. **Option 4A**: Enhanced monitoring and metrics

---

## Testing Strategy

### For Audio Gaps:
1. **Controlled Testing**: Simulate network jitter/packet loss
2. **Pattern Analysis**: Review gap logs to identify patterns
3. **A/B Testing**: Compare buffer strategies on staging

### For Noisy Environments:
1. **Test Audio Samples**: Use standard noisy audio test files
2. **Real-world Testing**: Test with actual noisy calls on staging
3. **Metrics**: Compare transcription accuracy, response quality

---

## Questions to Answer Before Implementation

1. **Gap Predictability**: Are gaps truly predictable (same time intervals) or random?
2. **Gap Frequency**: How often do gaps occur? (1 per call? 10 per call?)
3. **Gap Duration**: How long are the gaps? (50ms? 500ms?)
4. **Noise Types**: What types of noise? (background chatter, machinery, static, echo?)
5. **Latency Tolerance**: How much latency can we add? (50ms? 200ms?)
6. **OpenAI API Features**: What noise reduction features are actually available in the current API?

---

## Next Steps

1. **Research**: Check OpenAI Realtime API documentation for latest noise reduction features
2. **Logging**: Implement gap detection to understand patterns
3. **Testing**: Create test cases with noisy audio samples
4. **Prioritize**: Based on user feedback, prioritize gaps vs noise issues
5. **Implement**: Start with Phase 1 quick wins, measure impact, then proceed

---

## References

- OpenAI Realtime API Documentation
- RTP RFC 3550 (Jitter Buffer Guidelines)
- WebRTC Audio Processing Best Practices
- FFmpeg Audio Filter Documentation

