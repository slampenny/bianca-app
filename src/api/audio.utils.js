/**
 * audio.utils.js
 * Provides utilities for audio processing and conversion using 'alawmulaw'
 */

const alawmulaw = require('alawmulaw'); // Use the G.711 library
const { Buffer } = require('buffer');
const logger = require('../config/logger'); // Assuming logger is configured

// Check if imports worked (Optional but helpful)
if (typeof alawmulaw?.mulaw?.encode !== 'function' || typeof alawmulaw?.mulaw?.decode !== 'function') {
     logger.error("[AudioUtils] CRITICAL: alawmulaw library or its mulaw functions not imported correctly!");
     // Consider throwing an error here to prevent startup if the library is essential
}

/**
 * Audio processing utility functions
 */
class AudioUtils {
    /**
     * Convert uLaw audio (Base64) to PCM audio (Base64)
     * NOTE: Assumes 8kHz sample rate for uLaw
     * @param {string} ulawBase64 - Base64 encoded uLaw audio
     * @returns {Promise<string>} - Base64 encoded 16-bit PCM audio
     */
    static async convertUlawToPcm(ulawBase64) {
        // This function might be needed if OpenAI output format is changed to g711_ulaw
        return new Promise((resolve, reject) => {
            try {
                if (!ulawBase64) return resolve('');
                const inputBuffer = Buffer.from(ulawBase64, 'base64');
                if (inputBuffer.length === 0) {
                    logger.warn("[AudioUtils] convertUlawToPcm received empty buffer.");
                    return resolve('');
                }

                // alawmulaw expects Uint8Array for decode input
                const ulawInput = new Uint8Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.length);

                // Decode uLaw bytes to Int16 PCM samples
                const pcmSamples = alawmulaw.mulaw.decode(ulawInput); // Returns Int16Array

                // Convert Int16Array back to Node.js Buffer
                const pcmBuffer = Buffer.from(pcmSamples.buffer);

                // logger.debug(`[AudioUtils] Decoded ${inputBuffer.length} uLaw bytes to ${pcmBuffer.length} PCM bytes.`);
                resolve(pcmBuffer.toString('base64'));

            } catch (err) {
                logger.error(`[AudioUtils] Error in convertUlawToPcm: ${err.message}`);
                reject(err);
            }
        });
    }

    /**
     * Convert PCM audio (16-bit LE assumed) to uLaw audio (Base64)
     * NOTE: Assumes 8kHz sample rate for input PCM and uLaw output
     * @param {Buffer} pcmBuffer - 16-bit LE PCM audio buffer (assumed 8kHz)
     * @returns {Promise<string>} - Base64 encoded uLaw audio
     */
    static async convertPcmToUlaw(pcmBuffer) {
        // This function is needed to convert Asterisk PCM -> OpenAI uLaw
        return new Promise((resolve, reject) => {
            try {
                if (!pcmBuffer || pcmBuffer.length === 0) {
                    logger.warn("[AudioUtils] convertPcmToUlaw received empty buffer.");
                    return resolve('');
                }
                 // Ensure even length for Int16Array conversion
                 if (pcmBuffer.length % 2 !== 0) {
                      logger.error(`[AudioUtils] Received PCM buffer with odd length (${pcmBuffer.length}) for uLaw conversion.`);
                      return reject(new Error('Invalid PCM buffer length for 16-bit samples.'));
                 }

                // Convert Node.js Buffer to Int16Array (assuming Little Endian PCM)
                const pcmSamples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);

                // Encode Int16 PCM samples to 8-bit uLaw bytes
                const ulawOutput = alawmulaw.mulaw.encode(pcmSamples); // Returns Uint8Array

                // Convert Uint8Array back to Node.js Buffer
                const ulawBuffer = Buffer.from(ulawOutput.buffer);

                // logger.debug(`[AudioUtils] Encoded ${pcmBuffer.length} PCM bytes to ${ulawBuffer.length} uLaw bytes.`);
                resolve(ulawBuffer.toString('base64'));

            } catch (err) {
                logger.error(`[AudioUtils] Error in convertPcmToUlaw: ${err.message}`);
                reject(err);
            }
        });
    }

    /**
     * Resample PCM audio to a different sample rate (simple linear interpolation)
     * @param {Buffer} pcmBuffer - PCM audio buffer (16-bit LE)
     * @param {number} originalRate - Original sample rate (e.g., 24000 from OpenAI)
     * @param {number} targetRate - Target sample rate (e.g., 8000 for Asterisk)
     * @returns {Buffer} - Resampled PCM buffer
     */
    static resamplePcm(pcmBuffer, originalRate, targetRate) {
        // This function is needed to convert OpenAI 24kHz PCM -> Asterisk 8kHz PCM
        try {
            if (originalRate === targetRate) {
                return pcmBuffer; // No resampling needed
            }
            if (!pcmBuffer || pcmBuffer.length < 2) {
                 logger.warn(`[AudioUtils] Resample input buffer too small (${pcmBuffer?.length})`);
                 return Buffer.alloc(0);
            }
             // Ensure even length
             if (pcmBuffer.length % 2 !== 0) {
                  logger.error(`[AudioUtils] Resample input buffer has odd length (${pcmBuffer.length})`);
                  // Handle error: maybe trim last byte or reject? Returning empty for now.
                  return Buffer.alloc(0);
             }

            // Convert buffer to 16-bit PCM samples
            const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);

            // Calculate new sample count
            const ratio = targetRate / originalRate;
            const newSampleCount = Math.floor(samples.length * ratio);
            if (newSampleCount <= 0) {
                 logger.warn(`[AudioUtils] Resampling resulted in zero samples (original: ${samples.length}, ratio: ${ratio})`);
                 return Buffer.alloc(0);
            }
            const newSamples = new Int16Array(newSampleCount);

            // Simple linear interpolation
            for (let i = 0; i < newSampleCount; i++) {
                const sourceIdx = i / ratio;
                const idx1 = Math.floor(sourceIdx);
                const idx2 = Math.min(idx1 + 1, samples.length - 1); // Ensure idx2 is within bounds
                const frac = sourceIdx - idx1;

                // Linear interpolation between samples
                newSamples[i] = Math.round((1 - frac) * samples[idx1] + frac * samples[idx2]);
            }

            // Convert back to Buffer
            return Buffer.from(newSamples.buffer);
        } catch (err) {
            logger.error(`[AudioUtils] Error in resamplePcm: ${err.message}`);
            return pcmBuffer; // Return original on error as fallback
        }
    }

    // --- hasVoiceActivity function can remain if needed ---
    static hasVoiceActivity(audioBuffer, threshold = 0.02) {
        // ... (implementation from previous version) ...
         try {
             if (!audioBuffer || audioBuffer.length < 100) { return false; }
             let samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);
             let sum = 0;
             for (let i = 0; i < samples.length; i++) { sum += samples[i] * samples[i]; }
             const rms = Math.sqrt(sum / samples.length) / 32768;
             // logger.debug(`[AudioUtils] VAD RMS: ${rms.toFixed(4)}`);
             return rms > threshold;
         } catch (err) { logger.error(`[AudioUtils] Error in VAD: ${err.message}`); return false; }
    }

}

module.exports = AudioUtils;
