/**
 * Audio Noise Reduction Service
 * 
 * Handles audio preprocessing to improve speech recognition in noisy environments.
 * Designed to be isolated and configurable, with stages that can be enabled/disabled.
 * 
 * Current Stages:
 * - Stage 1: Noise Gate (filters low-energy audio)
 * - Stage 2: Frequency Filtering (band-pass filter 300-3400Hz) - IMPLEMENTED
 * - Stage 3: Primary Speaker Detection (focuses on loudest/most consistent speaker)
 * - Stage 4: Adaptive Noise Reduction - NOT YET IMPLEMENTED
 * 
 * Note: OpenAI Realtime API (gpt-realtime) has built-in noise reduction via audio.input.noise_reduction:
 * - near_field: Optimized for phone calls (speaker close to microphone), reduces far-field ambient noise
 * - far_field: Optimized for speakerphone/conference (speaker farther from mic), handles more ambient noise/reverb
 * This is different from frequency filtering. Frequency filtering removes frequencies outside human speech
 * range (300-3400Hz), while OpenAI's noise reduction focuses on background noise suppression based on
 * microphone distance. Both can be used together for optimal results.
 */

const logger = require('../../config/logger');
const config = require('../../config/config');
const AudioUtils = require('../../api/audio.utils');

class NoiseReductionService {
    constructor() {
        // Stage 1: Noise Gate Configuration
        this.noiseGateEnabled = config.audio?.noiseReduction?.noiseGateEnabled ?? true;
        this.noiseGateThreshold = config.audio?.noiseReduction?.noiseGateThreshold ?? 0.1;
        
        // Stage 2: Frequency Filtering Configuration (band-pass filter 300-3400Hz)
        this.frequencyFilteringEnabled = config.audio?.noiseReduction?.frequencyFilteringEnabled ?? false;
        this.frequencyFilterLowCutoff = config.audio?.noiseReduction?.frequencyFilterLowCutoff ?? 300; // Hz
        this.frequencyFilterHighCutoff = config.audio?.noiseReduction?.frequencyFilterHighCutoff ?? 3400; // Hz
        this.sampleRate = 8000; // 8kHz for μ-law audio
        
        // Initialize band-pass filter state (per-call to maintain filter continuity)
        this.filterState = new Map(); // callId -> { x1, x2, y1, y2 } (biquad filter state)
        
        // Stage 3: Primary Speaker Detection Configuration
        this.primarySpeakerEnabled = config.audio?.noiseReduction?.primarySpeakerEnabled ?? false;
        this.primarySpeakerHistorySize = config.audio?.noiseReduction?.primarySpeakerHistorySize ?? 50; // ~1 second at 20ms packets
        this.primarySpeakerFocusThreshold = config.audio?.noiseReduction?.primarySpeakerFocusThreshold ?? 0.7; // 70% of max energy
        this.primarySpeakerEnergyMultiplier = config.audio?.noiseReduction?.primarySpeakerEnergyMultiplier ?? 1.5; // 1.5x average
        this.primarySpeakerVolumeReduction = config.audio?.noiseReduction?.primarySpeakerVolumeReduction ?? 0.3; // Reduce to 30% if not primary
        
        // Stage 4: Adaptive Noise Reduction (not yet implemented)
        this.adaptiveNoiseReductionEnabled = config.audio?.noiseReduction?.adaptiveNoiseReductionEnabled ?? false;
        
        // Per-call energy history for primary speaker detection
        this.energyHistory = new Map(); // callId -> [energy1, energy2, ...]
        
        // Statistics for monitoring
        this.stats = {
            totalProcessed: 0,
            noiseGated: 0,
            frequencyFiltered: 0,
            primarySpeakerFiltered: 0,
            primarySpeakerPreserved: 0,
            adaptiveReduced: 0
        };
        
        logger.info('[Noise Reduction] Service initialized', {
            noiseGateEnabled: this.noiseGateEnabled,
            noiseGateThreshold: this.noiseGateThreshold,
            frequencyFilteringEnabled: this.frequencyFilteringEnabled,
            primarySpeakerEnabled: this.primarySpeakerEnabled,
            primarySpeakerHistorySize: this.primarySpeakerHistorySize,
            primarySpeakerFocusThreshold: this.primarySpeakerFocusThreshold,
            adaptiveNoiseReductionEnabled: this.adaptiveNoiseReductionEnabled,
            frequencyFilterLowCutoff: this.frequencyFilterLowCutoff,
            frequencyFilterHighCutoff: this.frequencyFilterHighCutoff
        });
    }
    
    /**
     * Main processing function - applies all enabled stages
     * @param {Buffer} audioBuffer - Raw μ-law audio buffer
     * @param {string} callId - Call identifier for logging
     * @returns {Promise<Buffer>} - Processed audio buffer
     */
    async processAudio(audioBuffer, callId) {
        if (!audioBuffer || audioBuffer.length === 0) {
            return audioBuffer;
        }
        
        this.stats.totalProcessed++;
        let processed = Buffer.from(audioBuffer); // Create a copy
        
        // Stage 1: Noise Gate
        if (this.noiseGateEnabled) {
            processed = this.applyNoiseGate(processed, callId);
        }
        
        // Stage 2: Frequency Filtering (band-pass filter 300-3400Hz)
        if (this.frequencyFilteringEnabled) {
            processed = await this.applyFrequencyFiltering(processed, callId);
        }
        
        // Stage 3: Primary Speaker Detection
        if (this.primarySpeakerEnabled) {
            processed = this.applyPrimarySpeakerDetection(processed, callId);
        }
        
        // Stage 4: Adaptive Noise Reduction (not yet implemented)
        if (this.adaptiveNoiseReductionEnabled) {
            // TODO: Implement adaptive noise reduction
            // processed = await this.applyAdaptiveNoiseReduction(processed, callId);
        }
        
        return processed;
    }
    
    /**
     * Stage 1: Noise Gate
     * Filters out audio below a certain energy threshold.
     * This removes constant background noise (TV, fan, etc.) while preserving speech.
     * 
     * @param {Buffer} audioBuffer - μ-law audio buffer
     * @param {string} callId - Call identifier for logging
     * @returns {Buffer} - Processed audio (silence if below threshold, original if above)
     */
    applyNoiseGate(audioBuffer, callId) {
        // Calculate RMS (Root Mean Square) energy
        // μ-law values: 0-255, with 127 being silence
        let sumSquares = 0;
        let sampleCount = 0;
        
        for (let i = 0; i < audioBuffer.length; i++) {
            const sample = audioBuffer[i];
            // Distance from silence (127), normalized to 0-1 range
            const distanceFromSilence = Math.abs(sample - 127) / 127;
            sumSquares += distanceFromSilence * distanceFromSilence;
            sampleCount++;
        }
        
        const rms = Math.sqrt(sumSquares / sampleCount);
        
        // If energy is below threshold, return silence
        if (rms < this.noiseGateThreshold) {
            this.stats.noiseGated++;
            
            // Log periodically to avoid spam
            if (this.stats.noiseGated % 100 === 0) {
                logger.debug(`[Noise Reduction] Noise gate applied for ${callId} (RMS: ${rms.toFixed(3)}, threshold: ${this.noiseGateThreshold})`);
            }
            
            // Return silence buffer (μ-law silence is 0x7F)
            return Buffer.alloc(audioBuffer.length, 0x7F);
        }
        
        // Energy is above threshold, keep original audio
        return audioBuffer;
    }
    
    /**
     * Stage 2: Frequency Filtering
     * Applies a band-pass filter (300-3400Hz) to remove frequencies outside human speech range.
     * This helps filter out TV/music background noise while preserving speech.
     * 
     * @param {Buffer} audioBuffer - μ-law audio buffer
     * @param {string} callId - Call identifier for maintaining filter state
     * @returns {Promise<Buffer>} - Filtered audio buffer (μ-law)
     */
    async applyFrequencyFiltering(audioBuffer, callId) {
        try {
            // Convert μ-law to PCM for filtering
            const pcmBuffer = await AudioUtils.convertUlawToPcm(audioBuffer);
            
            if (!pcmBuffer || pcmBuffer.length === 0) {
                return audioBuffer; // Return original if conversion fails
            }
            
            // Extract PCM samples (16-bit signed integers)
            const samples = [];
            for (let i = 0; i < pcmBuffer.length - 1; i += 2) {
                samples.push(pcmBuffer.readInt16LE(i));
            }
            
            if (samples.length === 0) {
                return audioBuffer;
            }
            
            // Apply band-pass filter
            const filteredSamples = this.applyBandPassFilter(samples, callId);
            
            // Convert filtered PCM back to μ-law
            const filteredPcmBuffer = Buffer.alloc(filteredSamples.length * 2);
            for (let i = 0; i < filteredSamples.length; i++) {
                const sample = Math.max(-32768, Math.min(32767, Math.round(filteredSamples[i])));
                filteredPcmBuffer.writeInt16LE(sample, i * 2);
            }
            
            const filteredUlawBase64 = await AudioUtils.convertPcmToUlaw(filteredPcmBuffer);
            const filteredUlawBuffer = Buffer.from(filteredUlawBase64, 'base64');
            
            this.stats.frequencyFiltered++;
            
            // Log periodically
            if (this.stats.frequencyFiltered % 100 === 0) {
                logger.debug(`[Noise Reduction] Frequency filtering applied for ${callId} (${samples.length} samples)`);
            }
            
            // Return filtered audio (same length as input)
            return filteredUlawBuffer.length === audioBuffer.length 
                ? filteredUlawBuffer 
                : audioBuffer; // Fallback to original if length mismatch
                
        } catch (err) {
            logger.error(`[Noise Reduction] Error in frequency filtering for ${callId}: ${err.message}`);
            // Return original audio on error
            return audioBuffer;
        }
    }
    
    /**
     * Apply band-pass filter to PCM samples using a biquad IIR filter
     * Filters frequencies outside the 300-3400Hz range (human speech range)
     * 
     * @param {number[]} samples - PCM samples (16-bit signed integers)
     * @param {string} callId - Call identifier for maintaining filter state
     * @returns {number[]} - Filtered samples
     */
    applyBandPassFilter(samples, callId) {
        // Initialize or get filter state for this call
        if (!this.filterState.has(callId)) {
            this.filterState.set(callId, {
                x1: 0, x2: 0, // Input history
                y1: 0, y2: 0  // Output history
            });
        }
        
        const state = this.filterState.get(callId);
        const filtered = new Array(samples.length);
        
        // Calculate filter coefficients for band-pass filter
        // Using a second-order biquad band-pass filter
        const { a1, a2, b0, b1, b2 } = this.calculateBandPassCoefficients(
            this.frequencyFilterLowCutoff,
            this.frequencyFilterHighCutoff,
            this.sampleRate
        );
        
        // Apply filter to each sample
        // Biquad filter equation: y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
        for (let i = 0; i < samples.length; i++) {
            const x = samples[i];
            
            const y = b0 * x + b1 * state.x1 + b2 * state.x2 - a1 * state.y1 - a2 * state.y2;
            
            // Clamp output to prevent overflow
            filtered[i] = Math.max(-32768, Math.min(32767, Math.round(y)));
            
            // Update state for next iteration
            state.x2 = state.x1;
            state.x1 = x;
            state.y2 = state.y1;
            state.y1 = filtered[i];
        }
        
        return filtered;
    }
    
    /**
     * Calculate biquad filter coefficients for a band-pass filter
     * Uses standard biquad band-pass filter design
     * 
     * @param {number} lowFreq - Low cutoff frequency (Hz)
     * @param {number} highFreq - High cutoff frequency (Hz)
     * @param {number} sampleRate - Sample rate (Hz)
     * @returns {Object} - Filter coefficients { a0, a1, a2, b1, b2 }
     */
    calculateBandPassCoefficients(lowFreq, highFreq, sampleRate) {
        // Normalize frequencies to 0-1 range (Nyquist = 0.5)
        const nyquist = sampleRate / 2;
        const lowNorm = Math.min(lowFreq / nyquist, 0.45);
        const highNorm = Math.min(highFreq / nyquist, 0.45);
        
        // Center frequency and bandwidth
        const centerFreq = Math.sqrt(lowNorm * highNorm); // Geometric mean for center
        const bandwidth = highNorm - lowNorm;
        
        // Convert to angular frequency
        const w0 = 2 * Math.PI * centerFreq;
        const cosW0 = Math.cos(w0);
        const sinW0 = Math.sin(w0);
        
        // Q factor (quality factor) - controls bandwidth sharpness
        const Q = centerFreq / bandwidth;
        const alpha = sinW0 / (2 * Q);
        
        // Band-pass filter coefficients (standard biquad form)
        // y[n] = (b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]) / a0
        const a0 = 1 + alpha;
        const a1 = -2 * cosW0;
        const a2 = 1 - alpha;
        const b0 = alpha;
        const b1 = 0;
        const b2 = -alpha;
        
        // Return normalized coefficients (divide by a0)
        return {
            a0: 1, // Normalized
            a1: a1 / a0,
            a2: a2 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            b0: b0 / a0 // Also need b0 for proper filter
        };
    }
    
    /**
     * Stage 3: Primary Speaker Detection
     * Identifies the loudest/most consistent speaker and focuses on them.
     * Reduces volume of background speakers/TV while preserving primary speaker.
     * 
     * @param {Buffer} audioBuffer - μ-law audio buffer (already noise-gated)
     * @param {string} callId - Call identifier for tracking energy history
     * @returns {Buffer} - Processed audio (reduced volume if not primary speaker)
     */
    applyPrimarySpeakerDetection(audioBuffer, callId) {
        // Calculate current energy
        const currentEnergy = this.calculateEnergy(audioBuffer);
        
        // Get or create energy history for this call
        if (!this.energyHistory.has(callId)) {
            this.energyHistory.set(callId, []);
        }
        const history = this.energyHistory.get(callId);
        
        // Add current energy to history
        history.push(currentEnergy);
        
        // Keep history size limited
        if (history.length > this.primarySpeakerHistorySize) {
            history.shift();
        }
        
        // Need at least a few samples to make a decision
        if (history.length < 5) {
            // Too early to detect, preserve audio
            return audioBuffer;
        }
        
        // Calculate statistics
        const avgEnergy = history.reduce((a, b) => a + b, 0) / history.length;
        const maxEnergy = Math.max(...history);
        
        // Determine if this is primary speaker
        // Primary speaker if:
        // 1. Current energy is significantly above average (1.5x), OR
        // 2. Current energy is consistently high (above 70% of max AND above average)
        // This handles both cases: sudden loud speaker OR consistent high-energy speaker
        const isPrimarySpeaker = (currentEnergy > avgEnergy * this.primarySpeakerEnergyMultiplier) ||
                                 (currentEnergy > maxEnergy * this.primarySpeakerFocusThreshold && 
                                  currentEnergy >= avgEnergy * 0.9); // At least 90% of average (consistent)
        
        if (isPrimarySpeaker) {
            this.stats.primarySpeakerPreserved++;
            
            // Log periodically
            if (this.stats.primarySpeakerPreserved % 100 === 0) {
                logger.debug(`[Noise Reduction] Primary speaker detected for ${callId} (energy: ${currentEnergy.toFixed(3)}, avg: ${avgEnergy.toFixed(3)}, max: ${maxEnergy.toFixed(3)})`);
            }
            
            // Preserve processed audio (already noise-gated)
            return audioBuffer;
        } else {
            this.stats.primarySpeakerFiltered++;
            
            // Log periodically
            if (this.stats.primarySpeakerFiltered % 100 === 0) {
                logger.debug(`[Noise Reduction] Background audio reduced for ${callId} (energy: ${currentEnergy.toFixed(3)}, avg: ${avgEnergy.toFixed(3)})`);
            }
            
            // Reduce volume (not primary speaker)
            return this.reduceVolume(audioBuffer, this.primarySpeakerVolumeReduction);
        }
    }
    
    /**
     * Calculate RMS energy of audio buffer
     * @param {Buffer} audioBuffer - μ-law audio buffer
     * @returns {number} - RMS energy (0-1 normalized)
     */
    calculateEnergy(audioBuffer) {
        let sumSquares = 0;
        let sampleCount = 0;
        
        for (let i = 0; i < audioBuffer.length; i++) {
            const sample = audioBuffer[i];
            const distanceFromSilence = Math.abs(sample - 127) / 127;
            sumSquares += distanceFromSilence * distanceFromSilence;
            sampleCount++;
        }
        
        return Math.sqrt(sumSquares / sampleCount);
    }
    
    /**
     * Reduce volume of audio buffer
     * @param {Buffer} audioBuffer - μ-law audio buffer
     * @param {number} factor - Volume reduction factor (0.0-1.0, where 0.3 = 30% volume)
     * @returns {Buffer} - Volume-reduced audio buffer
     */
    reduceVolume(audioBuffer, factor) {
        const reduced = Buffer.alloc(audioBuffer.length);
        
        for (let i = 0; i < audioBuffer.length; i++) {
            const sample = audioBuffer[i];
            // μ-law silence is 127, so we scale around that
            const distanceFromSilence = sample - 127;
            const scaledDistance = Math.round(distanceFromSilence * factor);
            const reducedSample = Math.max(0, Math.min(255, 127 + scaledDistance));
            reduced[i] = reducedSample;
        }
        
        return reduced;
    }
    
    /**
     * Clean up energy history and filter state for a call (call when call ends)
     * @param {string} callId - Call identifier
     */
    cleanupCall(callId) {
        this.energyHistory.delete(callId);
        this.filterState.delete(callId);
    }
    
    /**
     * Get processing statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            noiseGateRate: this.stats.totalProcessed > 0 
                ? (this.stats.noiseGated / this.stats.totalProcessed * 100).toFixed(2) + '%'
                : '0%',
            primarySpeakerPreservedRate: this.stats.totalProcessed > 0
                ? (this.stats.primarySpeakerPreserved / this.stats.totalProcessed * 100).toFixed(2) + '%'
                : '0%',
            primarySpeakerFilteredRate: this.stats.totalProcessed > 0
                ? (this.stats.primarySpeakerFiltered / this.stats.totalProcessed * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalProcessed: 0,
            noiseGated: 0,
            frequencyFiltered: 0,
            primarySpeakerFiltered: 0,
            primarySpeakerPreserved: 0,
            adaptiveReduced: 0
        };
        // Optionally clear energy history and filter state too
        // this.energyHistory.clear();
        // this.filterState.clear();
    }
}

// Export singleton instance
module.exports = new NoiseReductionService();
