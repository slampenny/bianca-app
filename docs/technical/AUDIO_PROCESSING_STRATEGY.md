# Audio Processing Strategy: Crowded Room & Primary Speaker Focus

## Problem Statement

**Goal**: Enable Bianca to understand people in crowded rooms and focus on the primary speaker, ignoring background noise (TV, other conversations, etc.).

**Current Issues**:
1. Previous normalization approach was per-packet, causing RTP buffer issues
2. No noise reduction before sending to OpenAI
3. No primary speaker detection/focus
4. Server-side VAD may not be sufficient for very noisy environments

---

## Strategy Overview

### Multi-Layer Approach

1. **Pre-processing (Before OpenAI)**: Lightweight noise reduction and filtering
2. **OpenAI Configuration**: Optimize VAD and transcription settings
3. **Post-processing (Optional)**: Confidence scoring and fallback handling

---

## Phase 1: OpenAI Configuration Optimization (Zero Latency, High Impact)

### 1.1 Optimize VAD Settings for Noisy Environments

**Current**: `silence_duration_ms: 800`, `threshold: 0.5`

**Strategy**: Adjust VAD to be more aggressive in detecting speech and less sensitive to background noise.

```javascript
turn_detection: {
  type: 'server_vad',
  threshold: 0.6,              // Increase from 0.5 - more selective (ignores quiet background)
  prefix_padding_ms: 300,     // Keep at 300ms to capture speech start
  silence_duration_ms: 1000    // Increase from 800ms - wait longer to confirm speech end
}
```

**Rationale**:
- Higher threshold (0.6) = ignores quieter background noise
- Longer silence duration = avoids cutting off speech in noisy environments
- More padding = captures speech starts better

**Impact**: 
- ✅ Better speech detection in noise
- ✅ Less false positives from background
- ⚠️ Slightly slower response time (+200ms)

**Effort**: 5 minutes (config change)

---

### 1.2 Use Latest Transcription Model

**Current**: `whisper-1`

**Strategy**: Check for newer models optimized for noisy environments.

```javascript
input_audio_transcription: {
  model: 'whisper-1',  // Or check for 'whisper-large-v3' or newer
  language: null,       // Auto-detect
  // If API supports quality hints:
  // quality: 'high',
  // noise_reduction: true
}
```

**Research Needed**:
- Check OpenAI API docs for latest transcription models
- Test newer models with noisy audio samples
- Compare accuracy vs. latency

**Impact**:
- ✅ Better transcription in noise (if newer models available)
- ✅ Zero latency impact (server-side)
- ✅ No code changes needed (just config)

**Effort**: 1-2 hours (research + testing)

---

### 1.3 Enable Input Audio Quality Hints (If Available)

**Strategy**: If OpenAI API supports it, provide hints about audio quality.

```javascript
input_audio_transcription: {
  model: 'whisper-1',
  // Hypothetical - check if API supports:
  // environment: 'noisy',  // Hint that audio is from noisy environment
  // speaker_focus: true,   // Hint to focus on primary speaker
}
```

**Effort**: 30 minutes (check API docs, test if available)

---

## Phase 2: Pre-Processing Audio (Before OpenAI)

### 2.1 Spectral Noise Gate (Recommended First Step)

**Approach**: Filter out audio below a certain energy threshold.

**Implementation**:
```javascript
// In rtp.listener.service.js, after receiving RTP packet
function applyNoiseGate(audioBuffer, threshold = 0.1) {
  // Calculate RMS (Root Mean Square) energy
  let sumSquares = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    const sample = audioBuffer[i];
    const distanceFromSilence = Math.abs(sample - 127) / 127; // Normalize 0-1
    sumSquares += distanceFromSilence * distanceFromSilence;
  }
  const rms = Math.sqrt(sumSquares / audioBuffer.length);
  
  // If energy is below threshold, return silence
  if (rms < threshold) {
    return Buffer.alloc(audioBuffer.length, 0x7F); // Return silence
  }
  
  return audioBuffer; // Keep original
}
```

**Pros**:
- ✅ Simple, lightweight
- ✅ Filters out constant background noise (TV, fan, etc.)
- ✅ Low CPU usage
- ✅ Can be tuned per environment

**Cons**:
- ⚠️ May filter out quiet speech
- ⚠️ Doesn't help with competing speakers

**Effort**: 2-3 hours (implement + tune threshold)

---

### 2.2 Frequency-Based Filtering

**Approach**: Use high-pass and low-pass filters to focus on human speech frequencies.

**Human Speech Range**: ~300Hz - 3400Hz (telephone quality)

**Implementation Options**:

**Option A: Simple μ-law Filtering (Lightweight)**
```javascript
// Filter out frequencies outside speech range
// Note: This is simplified - proper filtering requires FFT
function filterSpeechFrequencies(audioBuffer) {
  // For μ-law, we can do simple amplitude-based filtering
  // This is a placeholder - proper implementation needs FFT
  // Consider using a library like 'audio-buffer-utils' or 'fft-js'
}
```

**Option B: Use Audio Processing Library**
- `fft-js`: Fast Fourier Transform for frequency analysis
- `audio-buffer-utils`: Audio buffer manipulation
- `web-audio-api`: Full audio processing (may be overkill)

**Pros**:
- ✅ Removes non-speech frequencies (low rumble, high hiss)
- ✅ Focuses on human voice range

**Cons**:
- ⚠️ More complex implementation
- ⚠️ Higher CPU usage (FFT)
- ⚠️ May require converting μ-law → PCM → filter → μ-law

**Effort**: 4-6 hours (research libraries + implement)

---

### 2.3 Adaptive Noise Reduction

**Approach**: Learn background noise profile and subtract it.

**Implementation**:
```javascript
class AdaptiveNoiseReducer {
  constructor() {
    this.noiseProfile = null;
    this.learningRate = 0.01;
    this.minSamples = 100; // Need 100 samples before applying
  }
  
  updateNoiseProfile(audioBuffer) {
    // During "silence" periods, update noise profile
    if (this.isSilence(audioBuffer)) {
      if (!this.noiseProfile) {
        this.noiseProfile = Buffer.from(audioBuffer);
      } else {
        // Exponential moving average
        for (let i = 0; i < audioBuffer.length; i++) {
          this.noiseProfile[i] = Math.round(
            this.noiseProfile[i] * (1 - this.learningRate) + 
            audioBuffer[i] * this.learningRate
          );
        }
      }
    }
  }
  
  reduceNoise(audioBuffer) {
    if (!this.noiseProfile || this.samplesProcessed < this.minSamples) {
      return audioBuffer; // Not ready yet
    }
    
    const reduced = Buffer.alloc(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
      // Subtract noise profile (with clipping protection)
      const diff = audioBuffer[i] - (this.noiseProfile[i] - 127);
      reduced[i] = Math.max(0, Math.min(255, 127 + diff));
    }
    return reduced;
  }
}
```

**Pros**:
- ✅ Adapts to specific noise environment
- ✅ Effective for constant background noise (TV, fan)

**Cons**:
- ⚠️ Requires learning period
- ⚠️ May reduce speech if noise profile is wrong
- ⚠️ More complex

**Effort**: 6-8 hours (implement + test + tune)

---

## Phase 3: Primary Speaker Detection

### 3.1 Energy-Based Speaker Focus

**Approach**: Identify the loudest/most consistent speaker and focus on them.

**Implementation**:
```javascript
class PrimarySpeakerDetector {
  constructor() {
    this.energyHistory = [];
    this.historySize = 50; // Last 50 packets (~1 second)
    this.focusThreshold = 0.7; // 70% of max energy
  }
  
  detectPrimarySpeaker(audioBuffer) {
    // Calculate energy
    const energy = this.calculateEnergy(audioBuffer);
    
    // Add to history
    this.energyHistory.push(energy);
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
    }
    
    // Find average and max
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const maxEnergy = Math.max(...this.energyHistory);
    
    // If current energy is significantly above average, it's likely primary speaker
    if (energy > avgEnergy * 1.5 && energy > maxEnergy * this.focusThreshold) {
      return true; // This is primary speaker
    }
    
    return false; // Background noise or secondary speaker
  }
  
  calculateEnergy(audioBuffer) {
    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      const distanceFromSilence = Math.abs(audioBuffer[i] - 127);
      sum += distanceFromSilence * distanceFromSilence;
    }
    return Math.sqrt(sum / audioBuffer.length);
  }
}
```

**Usage**:
```javascript
// In rtp.listener.service.js
if (this.speakerDetector.detectPrimarySpeaker(rtpPacket.payload)) {
  // Send to OpenAI
  await openAIService.sendAudioChunk(this.callId, audioBase64);
} else {
  // Skip or reduce volume
  // Option: Send with reduced volume, or skip entirely
}
```

**Pros**:
- ✅ Focuses on loudest/most consistent speaker
- ✅ Filters out TV, background conversations
- ✅ Relatively simple

**Cons**:
- ⚠️ May miss quiet primary speaker
- ⚠️ Requires tuning thresholds

**Effort**: 4-6 hours (implement + test + tune)

---

### 3.2 Spectral Centroid Analysis

**Approach**: Human speech has characteristic spectral patterns. Analyze frequency distribution to identify speech vs. non-speech.

**Implementation**:
- Requires FFT to analyze frequency spectrum
- Speech has energy concentrated in 300-3400Hz range
- TV/music has broader frequency distribution

**Pros**:
- ✅ More accurate than energy-based
- ✅ Can distinguish speech from music/TV

**Cons**:
- ⚠️ Requires FFT (higher CPU)
- ⚠️ More complex implementation

**Effort**: 8-12 hours (research + implement FFT + test)

---

## Phase 4: Hybrid Approach (Recommended)

### 4.1 Multi-Stage Pipeline

**Recommended Implementation Order**:

1. **Stage 1: Noise Gate** (Quick win, low risk)
   - Filter out very quiet audio
   - Removes constant background noise
   - Effort: 2-3 hours

2. **Stage 2: Energy-Based Primary Speaker Detection** (Medium effort, good results)
   - Focus on loudest/most consistent speaker
   - Skip or reduce background speakers
   - Effort: 4-6 hours

3. **Stage 3: OpenAI VAD Optimization** (Zero effort, config change)
   - Adjust threshold and silence duration
   - Effort: 5 minutes

4. **Stage 4: Adaptive Noise Reduction** (Advanced, if needed)
   - Learn noise profile and subtract
   - Effort: 6-8 hours

---

## Implementation Plan

### Step 1: Create Audio Processing Module

Create `src/services/audio/noise-reduction.service.js`:

```javascript
class NoiseReductionService {
  constructor() {
    this.noiseGateThreshold = 0.1; // Configurable
    this.speakerDetector = new PrimarySpeakerDetector();
    this.adaptiveReducer = new AdaptiveNoiseReducer();
  }
  
  processAudio(audioBuffer, callId) {
    // Stage 1: Noise gate
    let processed = this.applyNoiseGate(audioBuffer);
    
    // Stage 2: Primary speaker detection
    if (!this.speakerDetector.detectPrimarySpeaker(processed)) {
      // Not primary speaker - reduce volume or skip
      processed = this.reduceVolume(processed, 0.3); // Reduce to 30%
    }
    
    // Stage 3: Adaptive noise reduction (optional)
    // processed = this.adaptiveReducer.reduceNoise(processed);
    
    return processed;
  }
  
  applyNoiseGate(audioBuffer) { /* ... */ }
  reduceVolume(audioBuffer, factor) { /* ... */ }
}
```

### Step 2: Integrate into RTP Listener

```javascript
// In rtp.listener.service.js
const noiseReduction = require('../audio/noise-reduction.service');

// In handleMessage():
const processedPayload = noiseReduction.processAudio(rtpPacket.payload, this.callId);
this.audioBuffer = Buffer.concat([this.audioBuffer, processedPayload]);
```

### Step 3: Make Configurable

Add to config:
```javascript
audio: {
  noiseReduction: {
    enabled: true,
    noiseGateThreshold: 0.1,
    primarySpeakerFocus: true,
    adaptiveNoiseReduction: false // Start disabled
  }
}
```

---

## Testing Strategy

### Test Cases

1. **Quiet Room**: Should work normally (no degradation)
2. **TV in Background**: Should ignore TV, focus on speaker
3. **Multiple Speakers**: Should focus on primary/loudest speaker
4. **Crowded Room**: Should filter background conversations
5. **Quiet Primary Speaker**: Should still capture (threshold tuning)

### Test Audio Samples

- Record test calls with various noise scenarios
- Compare transcription accuracy before/after
- Measure latency impact
- Check for false positives/negatives

---

## Risk Mitigation

1. **Feature Flags**: Make all processing optional via config
2. **Gradual Rollout**: Enable one stage at a time
3. **Fallback**: If processing fails, send raw audio
4. **Monitoring**: Log processing decisions for debugging
5. **Performance**: Monitor CPU usage, add timeouts

---

## Success Metrics

- **Transcription Accuracy**: Measure WER (Word Error Rate) in noisy environments
- **False Positives**: Count of times TV/background was interpreted as speech
- **Latency**: Ensure processing doesn't add >50ms
- **CPU Usage**: Monitor processing overhead

---

## Next Steps

1. ✅ Create `fix/audio` branch (done)
2. Implement Stage 1: Noise Gate (2-3 hours)
3. Test with noisy audio samples
4. Implement Stage 2: Primary Speaker Detection (4-6 hours)
5. Optimize OpenAI VAD settings (5 minutes)
6. Test end-to-end in staging
7. Monitor and tune thresholds

---

## References

- OpenAI Realtime API Docs: VAD configuration
- μ-law audio format specifications
- Speech frequency range: 300-3400Hz (telephone quality)
- Noise reduction algorithms: Spectral subtraction, Wiener filtering

