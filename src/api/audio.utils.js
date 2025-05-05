/**
 * audio.utils.js
 * Provides utilities for audio processing and conversion
 * Used by the OpenAI Realtime Service for handling audio streams
 */

const stream = require('stream');
const prism = require('prism-media');
const { Buffer } = require('buffer');
const logger = require('../config/logger');

/**
 * Audio processing utility functions
 */
class AudioUtils {
    /**
     * Convert uLaw audio (Base64) to PCM audio (Base64)
     * @param {string} ulawBase64 - Base64 encoded uLaw audio
     * @param {number} sampleRate - Sample rate for the audio (default: 8000)
     * @returns {Promise<string>} - Base64 encoded PCM audio
     */
    static async convertUlawToPcm(ulawBase64, sampleRate = 8000) {
        return new Promise((resolve, reject) => {
            try {
                const inputBuffer = Buffer.from(ulawBase64, 'base64');
                if (inputBuffer.length === 0) {
                    logger.warn("[AudioUtils] convertUlawToPcm received empty buffer.");
                    return resolve('');
                }

                // Check if buffer is too small to be meaningful audio
                if (inputBuffer.length < 10) {
                    logger.warn(`[AudioUtils] Buffer too small (${inputBuffer.length} bytes), skipping conversion`);
                    return resolve('');
                }

                // Create decoder for uLaw to PCM conversion
                const decoder = new prism.Decoder({ 
                    type: 'ulaw', 
                    rate: sampleRate, 
                    channels: 1 
                });
                
                const output = new stream.PassThrough();
                const outputChunks = [];

                // Track if any errors occurred
                let hadError = false;

                // Cleanup function to remove listeners
                const cleanupListeners = () => {
                    output.removeAllListeners();
                    decoder.removeAllListeners();
                    input.removeAllListeners();
                };

                // Handle output stream events
                output.once('error', (err) => {
                    logger.error(`[AudioUtils] Error in output stream: ${err.message}`);
                    hadError = true;
                    cleanupListeners();
                    reject(err);
                });

                output.on('data', (chunk) => outputChunks.push(chunk));
                
                output.once('end', () => {
                    if (hadError) return; // Skip if we already had an error
                    
                    const pcmBuffer = Buffer.concat(outputChunks);
                    logger.debug(`[AudioUtils] Decoded to PCM buffer size: ${pcmBuffer.length}`);
                    cleanupListeners();
                    resolve(pcmBuffer.toString('base64'));
                });

                // Create input stream and pipe through the conversion pipeline
                const input = new stream.PassThrough();
                
                input.once('error', (err) => {
                    logger.error(`[AudioUtils] Error in input stream: ${err.message}`);
                    hadError = true;
                    cleanupListeners();
                    reject(err);
                });
                
                decoder.once('error', (err) => {
                    logger.error(`[AudioUtils] Error in decoder stream: ${err.message}`);
                    hadError = true;
                    cleanupListeners();
                    reject(err);
                });

                // Set up the pipeline
                input.pipe(decoder).pipe(output);
                
                // Send data and end the input stream
                input.end(inputBuffer);

                // Set a safety timeout in case the stream doesn't end properly
                const safetyTimeout = setTimeout(() => {
                    if (!hadError) {
                        logger.warn(`[AudioUtils] Safety timeout triggered during uLaw to PCM conversion`);
                        const pcmBuffer = Buffer.concat(outputChunks);
                        cleanupListeners();
                        resolve(pcmBuffer.toString('base64'));
                    }
                }, 1000); // 1 second timeout should be more than enough for audio conversion
                
                // Clear the timeout when the stream ends properly
                output.on('end', () => clearTimeout(safetyTimeout));

            } catch (err) {
                logger.error(`[AudioUtils] Error in convertUlawToPcm: ${err.message}`);
                reject(err);
            }
        });
    }

    /**
     * Convert PCM audio to uLaw audio
     * @param {Buffer} pcmBuffer - PCM audio buffer
     * @param {number} sampleRate - Sample rate for the audio (default: 8000)
     * @returns {Promise<string>} - Base64 encoded uLaw audio
     */
    static async convertPcmToUlaw(pcmBuffer, sampleRate = 8000) {
        return new Promise((resolve, reject) => {
            try {
                if (!pcmBuffer || pcmBuffer.length === 0) {
                    logger.warn("[AudioUtils] convertPcmToUlaw received empty buffer.");
                    return resolve('');
                }

                // Check if buffer is too small to be meaningful audio
                if (pcmBuffer.length < 20) {
                    logger.warn(`[AudioUtils] PCM buffer too small (${pcmBuffer.length} bytes), skipping conversion`);
                    return resolve('');
                }

                // Create streams for PCM -> uLaw conversion
                const decoder = new prism.Decoder({ 
                    type: 'pcm', 
                    rate: sampleRate, 
                    channels: 1 
                });
                
                const encoder = new prism.Encoder({ 
                    type: 'ulaw', 
                    rate: sampleRate, 
                    channels: 1 
                });
                
                const pcmStream = new stream.PassThrough();
                const ulawChunks = [];

                // Track if any errors occurred
                let hadError = false;

                // Cleanup function to remove listeners
                const cleanupListeners = () => {
                    pcmStream.removeAllListeners();
                    decoder.removeAllListeners();
                    encoder.removeAllListeners();
                };

                // Set up error handlers for each stream in the pipeline
                pcmStream.once('error', (err) => {
                    logger.error(`[AudioUtils] Error in PCM stream: ${err.message}`);
                    hadError = true;
                    cleanupListeners();
                    reject(err);
                });

                decoder.once('error', (err) => {
                    logger.error(`[AudioUtils] Error in PCM decoder: ${err.message}`);
                    hadError = true;
                    cleanupListeners();
                    reject(err);
                });

                encoder.once('error', (err) => {
                    logger.error(`[AudioUtils] Error in uLaw encoder: ${err.message}`);
                    hadError = true;
                    cleanupListeners();
                    reject(err);
                });

                // Collect uLaw chunks
                encoder.on('data', (chunk) => ulawChunks.push(chunk));
                
                encoder.once('end', () => {
                    if (hadError) return; // Skip if we already had an error
                    
                    if (ulawChunks.length > 0) {
                        const ulawBuffer = Buffer.concat(ulawChunks);
                        logger.debug(`[AudioUtils] Transcoded PCM to uLaw, uLaw size: ${ulawBuffer.length}`);
                        cleanupListeners();
                        resolve(ulawBuffer.toString('base64'));
                    } else {
                        logger.warn(`[AudioUtils] No uLaw chunks generated after transcoding`);
                        cleanupListeners();
                        resolve('');
                    }
                });

                // Create the pipeline
                const conversionPipeline = pcmStream.pipe(decoder).pipe(encoder);

                // Set a safety timeout in case the stream doesn't end properly
                const safetyTimeout = setTimeout(() => {
                    if (!hadError && ulawChunks.length > 0) {
                        logger.warn(`[AudioUtils] Safety timeout triggered during PCM to uLaw conversion`);
                        const ulawBuffer = Buffer.concat(ulawChunks);
                        cleanupListeners();
                        resolve(ulawBuffer.toString('base64'));
                    } else if (!hadError) {
                        logger.warn(`[AudioUtils] Safety timeout with no uLaw chunks produced`);
                        cleanupListeners();
                        resolve('');
                    }
                }, 1000); // 1 second timeout
                
                // Clear the timeout when the stream ends properly
                encoder.on('end', () => clearTimeout(safetyTimeout));

                // Start the process
                pcmStream.end(pcmBuffer);

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