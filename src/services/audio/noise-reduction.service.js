/**
 * Audio Noise Reduction Service
 * 
 * Handles audio preprocessing to improve speech recognition in noisy environments.
 * Designed to be isolated and configurable, with stages that can be enabled/disabled.
 * 
 * Current Stage: Stage 1 - Noise Gate
 */

const logger = require('../../config/logger');
const config = require('../../config/config');

class NoiseReductionService {
    constructor() {
        // Stage 1: Noise Gate Configuration
        this.noiseGateEnabled = config.audio?.noiseReduction?.noiseGateEnabled ?? true;
        this.noiseGateThreshold = config.audio?.noiseReduction?.noiseGateThreshold ?? 0.1;
        
        // Stage 2: Primary Speaker Detection (not yet implemented)
        this.primarySpeakerEnabled = config.audio?.noiseReduction?.primarySpeakerEnabled ?? false;
        
        // Stage 3: Adaptive Noise Reduction (not yet implemented)
        this.adaptiveNoiseReductionEnabled = config.audio?.noiseReduction?.adaptiveNoiseReductionEnabled ?? false;
        
        // Statistics for monitoring
        this.stats = {
            totalProcessed: 0,
            noiseGated: 0,
            primarySpeakerFiltered: 0,
            adaptiveReduced: 0
        };
        
        logger.info('[Noise Reduction] Service initialized', {
            noiseGateEnabled: this.noiseGateEnabled,
            noiseGateThreshold: this.noiseGateThreshold,
            primarySpeakerEnabled: this.primarySpeakerEnabled,
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
        
        // Stage 2: Primary Speaker Detection (not yet implemented)
        if (this.primarySpeakerEnabled) {
            // TODO: Implement in Stage 2
            // processed = this.detectPrimarySpeaker(processed, callId);
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
     * Get processing statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            noiseGateRate: this.stats.totalProcessed > 0 
                ? (this.stats.noiseGated / this.stats.totalProcessed * 100).toFixed(2) + '%'
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
            adaptiveReduced: 0
        };
    }
}

// Export singleton instance
module.exports = new NoiseReductionService();

