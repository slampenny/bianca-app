/**
 * Audio Noise Reduction Service
 * 
 * Handles audio preprocessing to improve speech recognition in noisy environments.
 * Designed to be isolated and configurable, with stages that can be enabled/disabled.
 * 
 * Current Stages:
 * - Stage 1: Noise Gate (filters low-energy audio)
 * - Stage 3: Primary Speaker Detection (focuses on loudest/most consistent speaker)
 */

const logger = require('../../config/logger');
const config = require('../../config/config');

class NoiseReductionService {
    constructor() {
        // Stage 1: Noise Gate Configuration
        this.noiseGateEnabled = config.audio?.noiseReduction?.noiseGateEnabled ?? true;
        this.noiseGateThreshold = config.audio?.noiseReduction?.noiseGateThreshold ?? 0.1;
        
        // Stage 3: Primary Speaker Detection Configuration
        this.primarySpeakerEnabled = config.audio?.noiseReduction?.primarySpeakerEnabled ?? false;
        this.primarySpeakerHistorySize = config.audio?.noiseReduction?.primarySpeakerHistorySize ?? 50; // ~1 second at 20ms packets
        this.primarySpeakerFocusThreshold = config.audio?.noiseReduction?.primarySpeakerFocusThreshold ?? 0.7; // 70% of max energy
        this.primarySpeakerEnergyMultiplier = config.audio?.noiseReduction?.primarySpeakerEnergyMultiplier ?? 1.5; // 1.5x average
        this.primarySpeakerVolumeReduction = config.audio?.noiseReduction?.primarySpeakerVolumeReduction ?? 0.3; // Reduce to 30% if not primary
        
        // Stage 2: Adaptive Noise Reduction (not yet implemented)
        this.adaptiveNoiseReductionEnabled = config.audio?.noiseReduction?.adaptiveNoiseReductionEnabled ?? false;
        
        // Per-call energy history for primary speaker detection
        this.energyHistory = new Map(); // callId -> [energy1, energy2, ...]
        
        // Statistics for monitoring
        this.stats = {
            totalProcessed: 0,
            noiseGated: 0,
            primarySpeakerFiltered: 0,
            primarySpeakerPreserved: 0,
            adaptiveReduced: 0
        };
        
        logger.info('[Noise Reduction] Service initialized', {
            noiseGateEnabled: this.noiseGateEnabled,
            noiseGateThreshold: this.noiseGateThreshold,
            primarySpeakerEnabled: this.primarySpeakerEnabled,
            primarySpeakerHistorySize: this.primarySpeakerHistorySize,
            primarySpeakerFocusThreshold: this.primarySpeakerFocusThreshold,
            adaptiveNoiseReductionEnabled: this.adaptiveNoiseReductionEnabled
        });
    }
    
    /**
     * Main processing function - applies all enabled stages
     * @param {Buffer} audioBuffer - Raw μ-law audio buffer
     * @param {string} callId - Call identifier for logging
     * @returns {Buffer} - Processed audio buffer
     */
    processAudio(audioBuffer, callId) {
        if (!audioBuffer || audioBuffer.length === 0) {
            return audioBuffer;
        }
        
        this.stats.totalProcessed++;
        let processed = Buffer.from(audioBuffer); // Create a copy
        
        // Stage 1: Noise Gate
        if (this.noiseGateEnabled) {
            processed = this.applyNoiseGate(processed, callId);
        }
        
        // Stage 3: Primary Speaker Detection
        if (this.primarySpeakerEnabled) {
            processed = this.applyPrimarySpeakerDetection(processed, callId);
        }
        
        // Stage 3: Adaptive Noise Reduction (not yet implemented)
        if (this.adaptiveNoiseReductionEnabled) {
            // TODO: Implement in Stage 3
            // processed = this.applyAdaptiveNoiseReduction(processed, callId);
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
     * Clean up energy history for a call (call when call ends)
     * @param {string} callId - Call identifier
     */
    cleanupCall(callId) {
        this.energyHistory.delete(callId);
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
            primarySpeakerFiltered: 0,
            primarySpeakerPreserved: 0,
            adaptiveReduced: 0
        };
        // Optionally clear energy history too
        // this.energyHistory.clear();
    }
}

// Export singleton instance
module.exports = new NoiseReductionService();

