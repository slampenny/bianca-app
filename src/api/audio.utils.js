const alawmulaw = require('alawmulaw'); // Use the new library
const { Buffer } = require('buffer');
const logger = require('../config/logger');

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

                logger.debug(`[AudioUtils] Decoded ${inputBuffer.length} uLaw bytes to ${pcmBuffer.length} PCM bytes.`);
                resolve(pcmBuffer.toString('base64'));

            } catch (err) {
                logger.error(`[AudioUtils] Error in convertUlawToPcm: ${err.message}`);
                reject(err);
            }
        });
    }

    /**
     * Convert PCM audio (16-bit LE assumed) to uLaw audio (Base64)
     * NOTE: Assumes 8kHz sample rate for uLaw output
     * @param {Buffer} pcmBuffer - 16-bit LE PCM audio buffer
     * @returns {Promise<string>} - Base64 encoded uLaw audio
     */
    static async convertPcmToUlaw(pcmBuffer) {
        return new Promise((resolve, reject) => {
            try {
                if (!pcmBuffer || pcmBuffer.length === 0) {
                    logger.warn("[AudioUtils] convertPcmToUlaw received empty buffer.");
                    return resolve('');
                }
                 // Ensure even length for Int16Array conversion
                 if (pcmBuffer.length % 2 !== 0) {
                      logger.error(`[AudioUtils] Received PCM buffer with odd length (${pcmBuffer.length}) for uLaw conversion.`);
                      // Handle error appropriately - reject or resolve with empty? Reject is safer.
                      return reject(new Error('Invalid PCM buffer length for 16-bit samples.'));
                 }


                // Convert Node.js Buffer to Int16Array (assuming Little Endian PCM)
                const pcmSamples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);

                // Encode Int16 PCM samples to 8-bit uLaw bytes
                const ulawOutput = alawmulaw.mulaw.encode(pcmSamples); // Returns Uint8Array

                // Convert Uint8Array back to Node.js Buffer
                const ulawBuffer = Buffer.from(ulawOutput.buffer);

                logger.debug(`[AudioUtils] Encoded ${pcmBuffer.length} PCM bytes to ${ulawBuffer.length} uLaw bytes.`);
                resolve(ulawBuffer.toString('base64'));

            } catch (err) {
                logger.error(`[AudioUtils] Error in convertPcmToUlaw: ${err.message}`);
                reject(err);
            }
        });
    }

    /**
     * Check if the audio data is likely to contain speech/voice
     * Simple energy-based voice activity detection
     * @param {Buffer} audioBuffer - Audio buffer (PCM format)
     * @param {number} threshold - Energy threshold (0-1)
     * @returns {boolean} - True if likely contains speech
     */
    static hasVoiceActivity(audioBuffer, threshold = 0.02) {
        try {
            if (!audioBuffer || audioBuffer.length < 100) {
                return false;
            }

            // Convert buffer to 16-bit PCM samples if needed
            let samples;
            if (audioBuffer[0] === 0 && audioBuffer[1] === 0) {
                // Likely PCM data
                samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);
            } else {
                // Try to interpret as 8-bit uLaw (rough approximation)
                samples = new Int16Array(audioBuffer.length);
                for (let i = 0; i < audioBuffer.length; i++) {
                    // Simplified uLaw to linear conversion (approximation)
                    samples[i] = ((audioBuffer[i] & 0x7F) << 8) * (audioBuffer[i] & 0x80 ? -1 : 1);
                }
            }

            // Calculate RMS energy
            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
                sum += samples[i] * samples[i];
            }
            const rms = Math.sqrt(sum / samples.length) / 32768; // Normalize to 0-1

            logger.debug(`[AudioUtils] Voice activity detection: RMS=${rms.toFixed(4)}, threshold=${threshold}`);
            return rms > threshold;
        } catch (err) {
            logger.error(`[AudioUtils] Error in hasVoiceActivity: ${err.message}`);
            return false; // Default to no voice if error
        }
    }

    /**
     * Resample PCM audio to a different sample rate (simple implementation)
     * For production use, consider using a proper resampling library
     * @param {Buffer} pcmBuffer - PCM audio buffer (16-bit)
     * @param {number} originalRate - Original sample rate
     * @param {number} targetRate - Target sample rate
     * @returns {Buffer} - Resampled PCM buffer
     */
    static resamplePcm(pcmBuffer, originalRate, targetRate) {
        try {
            if (originalRate === targetRate) {
                return pcmBuffer; // No resampling needed
            }

            // Convert buffer to 16-bit PCM samples
            const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
            
            // Calculate new sample count
            const ratio = targetRate / originalRate;
            const newSampleCount = Math.floor(samples.length * ratio);
            const newSamples = new Int16Array(newSampleCount);

            // Simple linear interpolation
            for (let i = 0; i < newSampleCount; i++) {
                const sourceIdx = i / ratio;
                const idx1 = Math.floor(sourceIdx);
                const idx2 = Math.min(idx1 + 1, samples.length - 1);
                const frac = sourceIdx - idx1;
                
                // Linear interpolation between samples
                newSamples[i] = Math.round((1 - frac) * samples[idx1] + frac * samples[idx2]);
            }

            // Convert back to Buffer
            return Buffer.from(newSamples.buffer);
        } catch (err) {
            logger.error(`[AudioUtils] Error in resamplePcm: ${err.message}`);
            return pcmBuffer; // Return original on error
        }
    }
}

module.exports = AudioUtils;