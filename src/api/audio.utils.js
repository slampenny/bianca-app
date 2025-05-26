// src/services/audio.utils.js - Enhanced with bidirectional uLaw/PCM conversion

const alawmulaw = require('alawmulaw');

/**
 * Audio utility functions for format conversion and resampling
 */
class AudioUtils {
    
    /**
     * Convert 16-bit PCM to uLaw and return as base64
     * @param {Buffer} pcmBuffer - Input PCM buffer (16-bit samples)
     * @returns {string} Base64 encoded uLaw audio
     */
    static async convertPcmToUlaw(pcmBuffer) {
        if (!pcmBuffer || pcmBuffer.length === 0) {
            return '';
        }
        
        try {
            // Convert buffer to 16-bit samples array
            const samples = [];
            for (let i = 0; i < pcmBuffer.length; i += 2) {
                if (i + 1 < pcmBuffer.length) {
                    // Read little-endian 16-bit signed integer
                    const sample = pcmBuffer.readInt16LE(i);
                    samples.push(sample);
                }
            }
            
            // Convert PCM samples to uLaw using the correct API
            const ulawSamples = alawmulaw.mulaw.encode(samples);
            const ulawBuffer = Buffer.from(ulawSamples);
            
            return ulawBuffer.toString('base64');
        } catch (err) {
            console.error('Error converting PCM to uLaw:', err);
            return '';
        }
    }

    /**
     * Convert uLaw to 16-bit PCM
     * @param {Buffer} ulawBuffer - Input uLaw buffer
     * @returns {Buffer} PCM buffer (16-bit samples)
     */
    static async convertUlawToPcm(ulawBuffer) {
        if (!ulawBuffer || ulawBuffer.length === 0) {
            return Buffer.alloc(0);
        }
        
        try {
            // Convert uLaw buffer to array
            const ulawArray = Array.from(ulawBuffer);
            
            // Convert uLaw to 16-bit PCM samples using the correct API
            const pcmSamples = alawmulaw.mulaw.decode(ulawArray);
            
            // Convert samples array back to buffer
            const pcmBuffer = Buffer.alloc(pcmSamples.length * 2);
            for (let i = 0; i < pcmSamples.length; i++) {
                pcmBuffer.writeInt16LE(pcmSamples[i], i * 2);
            }
            
            return pcmBuffer;
        } catch (err) {
            console.error('Error converting uLaw to PCM:', err);
            return Buffer.alloc(0);
        }
    }

    /**
     * Resample PCM audio from one sample rate to another
     * @param {Buffer} inputBuffer - Input PCM buffer
     * @param {number} inputRate - Input sample rate (Hz)
     * @param {number} outputRate - Output sample rate (Hz)
     * @returns {Buffer} Resampled PCM buffer
     */
    static resamplePcm(inputBuffer, inputRate, outputRate) {
        if (!inputBuffer || inputBuffer.length === 0) {
            return Buffer.alloc(0);
        }
        
        if (inputRate === outputRate) {
            return inputBuffer; // No resampling needed
        }
        
        try {
            // Simple linear interpolation resampling
            const inputSamples = [];
            for (let i = 0; i < inputBuffer.length; i += 2) {
                if (i + 1 < inputBuffer.length) {
                    inputSamples.push(inputBuffer.readInt16LE(i));
                }
            }
            
            const ratio = outputRate / inputRate;
            const outputLength = Math.floor(inputSamples.length * ratio);
            const outputSamples = new Array(outputLength);
            
            for (let i = 0; i < outputLength; i++) {
                const sourceIndex = i / ratio;
                const leftIndex = Math.floor(sourceIndex);
                const rightIndex = Math.min(leftIndex + 1, inputSamples.length - 1);
                const fraction = sourceIndex - leftIndex;
                
                const leftSample = inputSamples[leftIndex] || 0;
                const rightSample = inputSamples[rightIndex] || 0;
                
                // Linear interpolation
                outputSamples[i] = Math.round(leftSample + fraction * (rightSample - leftSample));
            }
            
            // Convert back to buffer
            const outputBuffer = Buffer.alloc(outputSamples.length * 2);
            for (let i = 0; i < outputSamples.length; i++) {
                outputBuffer.writeInt16LE(outputSamples[i], i * 2);
            }
            
            return outputBuffer;
        } catch (err) {
            console.error('Error resampling PCM:', err);
            return inputBuffer; // Return original on error
        }
    }

    /**
     * Convert base64 uLaw to base64 PCM (convenience method)
     * @param {string} ulawBase64 - Base64 encoded uLaw
     * @returns {string} Base64 encoded PCM
     */
    static async convertBase64UlawToPcm(ulawBase64) {
        if (!ulawBase64) return '';
        
        try {
            const ulawBuffer = Buffer.from(ulawBase64, 'base64');
            const pcmBuffer = await this.convertUlawToPcm(ulawBuffer);
            return pcmBuffer.toString('base64');
        } catch (err) {
            console.error('Error converting base64 uLaw to PCM:', err);
            return '';
        }
    }

    /**
     * Convert base64 PCM to base64 uLaw (convenience method)
     * @param {string} pcmBase64 - Base64 encoded PCM
     * @returns {string} Base64 encoded uLaw
     */
    static async convertBase64PcmToUlaw(pcmBase64) {
        if (!pcmBase64) return '';
        
        try {
            const pcmBuffer = Buffer.from(pcmBase64, 'base64');
            return await this.convertPcmToUlaw(pcmBuffer);
        } catch (err) {
            console.error('Error converting base64 PCM to uLaw:', err);
            return '';
        }
    }

    /**
     * Validate audio buffer format
     * @param {Buffer} buffer - Audio buffer to validate
     * @param {string} expectedFormat - Expected format ('pcm16', 'ulaw', etc.)
     * @returns {boolean} True if valid
     */
    static validateAudioBuffer(buffer, expectedFormat = 'pcm16') {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            return false;
        }
        
        if (buffer.length === 0) {
            return false;
        }
        
        // Basic validation based on format
        switch (expectedFormat.toLowerCase()) {
            case 'pcm16':
                // PCM16 should have even number of bytes (2 bytes per sample)
                return buffer.length % 2 === 0;
            case 'ulaw':
            case 'alaw':
                // uLaw/aLaw is 1 byte per sample, any length is valid
                return true;
            default:
                return true; // Unknown format, assume valid
        }
    }

    /**
     * Get audio buffer info
     * @param {Buffer} buffer - Audio buffer
     * @param {string} format - Audio format
     * @param {number} sampleRate - Sample rate in Hz
     * @returns {Object} Audio info
     */
    static getAudioInfo(buffer, format = 'pcm16', sampleRate = 8000) {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            return { valid: false };
        }
        
        const bytesPerSample = format.toLowerCase() === 'pcm16' ? 2 : 1;
        const samples = Math.floor(buffer.length / bytesPerSample);
        const durationMs = samples > 0 ? (samples / sampleRate) * 1000 : 0;
        
        return {
            valid: true,
            bytes: buffer.length,
            samples: samples,
            durationMs: Math.round(durationMs * 100) / 100, // Round to 2 decimal places
            format: format,
            sampleRate: sampleRate,
            bytesPerSample: bytesPerSample
        };
    }

    /**
     * Create silence buffer
     * @param {number} durationMs - Duration in milliseconds
     * @param {string} format - Audio format ('pcm16' or 'ulaw')
     * @param {number} sampleRate - Sample rate in Hz
     * @returns {Buffer} Silence buffer
     */
    static createSilence(durationMs, format = 'pcm16', sampleRate = 8000) {
        const samples = Math.floor((durationMs / 1000) * sampleRate);
        const bytesPerSample = format.toLowerCase() === 'pcm16' ? 2 : 1;
        const bufferSize = samples * bytesPerSample;
        
        if (format.toLowerCase() === 'ulaw') {
            // uLaw silence is 0xFF (not 0x00)
            return Buffer.alloc(bufferSize, 0xFF);
        } else {
            // PCM silence is all zeros
            return Buffer.alloc(bufferSize, 0x00);
        }
    }
}

module.exports = AudioUtils;