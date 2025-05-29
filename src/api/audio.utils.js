// src/services/audio.utils.js

const alawmulaw = require('alawmulaw');

class AudioUtils {

    /**
     * Convert 16-bit PCM to uLaw and return as base64
     * @param {Buffer} pcmBuffer - Input PCM buffer (16-bit samples)
     * @returns {Promise<string>} Base64 encoded uLaw audio
     * @throws {Error} If conversion fails
     */
    static async convertPcmToUlaw(pcmBuffer) {
        if (!pcmBuffer || pcmBuffer.length === 0) {
            // Returning empty for empty input is acceptable if the caller expects it.
            // Or, throw new Error('PCM to uLaw conversion: Input buffer is empty.');
            return '';
        }

        try {
            const samples = [];
            for (let i = 0; i < pcmBuffer.length; i += 2) {
                if (i + 1 < pcmBuffer.length) {
                    samples.push(pcmBuffer.readInt16LE(i));
                } else {
                    // Handle potential odd-length buffer if necessary, though pcm16 should be even
                    // For now, we'll assume valid PCM16 input.
                }
            }

            if (samples.length === 0 && pcmBuffer.length > 0) {
                 // This case should ideally not happen if pcmBuffer.length > 0 and is even
                console.warn('PCM to uLaw conversion: No samples extracted from non-empty PCM buffer.');
                throw new Error('PCM to uLaw conversion: Failed to extract samples from PCM buffer.');
            }

            const ulawSamples = alawmulaw.mulaw.encode(samples);
            const ulawBuffer = Buffer.from(ulawSamples);

            return ulawBuffer.toString('base64');
        } catch (err) {
            console.error('Error converting PCM to uLaw:', err.message, err.stack);
            throw new Error(`PCM to uLaw conversion failed: ${err.message}`);
        }
    }

    /**
     * Convert uLaw to 16-bit PCM
     * @param {Buffer} ulawBuffer - Input uLaw buffer
     * @returns {Promise<Buffer>} PCM buffer (16-bit samples)
     * @throws {Error} If conversion fails
     */
    static async convertUlawToPcm(ulawBuffer) {
        if (!ulawBuffer || ulawBuffer.length === 0) {
            // Returning empty for empty input is acceptable if the caller expects it.
            // Or, throw new Error('uLaw to PCM conversion: Input buffer is empty.');
            return Buffer.alloc(0);
        }

        try {
            const ulawArray = Array.from(ulawBuffer);
            const pcmSamples = alawmulaw.mulaw.decode(ulawArray);

            if (!pcmSamples) { // alawmulaw might return null/undefined on error
                throw new Error('alawmulaw.mulaw.decode returned null or undefined.');
            }

            const pcmBuffer = Buffer.alloc(pcmSamples.length * 2);
            for (let i = 0; i < pcmSamples.length; i++) {
                pcmBuffer.writeInt16LE(pcmSamples[i], i * 2);
            }

            return pcmBuffer;
        } catch (err) {
            console.error('Error converting uLaw to PCM:', err.message, err.stack);
            throw new Error(`uLaw to PCM conversion failed: ${err.message}`);
        }
    }

    /**
     * Resample PCM audio from one sample rate to another
     * @param {Buffer} inputBuffer - Input PCM buffer
     * @param {number} inputRate - Input sample rate (Hz)
     * @param {number} outputRate - Output sample rate (Hz)
     * @returns {Buffer} Resampled PCM buffer
     * @throws {Error} If resampling fails
     */
    static resamplePcm(inputBuffer, inputRate, outputRate) {
        if (!inputBuffer || inputBuffer.length === 0) {
            // Returning empty for empty input is acceptable if the caller expects it.
            // Or, throw new Error('Resampling: Input buffer is empty.');
            return Buffer.alloc(0);
        }

        if (inputBuffer.length % 2 !== 0) {
            // PCM16 data should have an even number of bytes.
            console.warn(`Resampling: Input buffer has odd length (${inputBuffer.length} bytes). May indicate corrupted PCM data.`);
            // Decide how to handle: throw, trim, or attempt processing. For now, we'll attempt.
        }

        if (inputRate === outputRate) {
            return inputBuffer;
        }

        try {
            const inputSamples = [];
            for (let i = 0; i < inputBuffer.length; i += 2) {
                if (i + 1 < inputBuffer.length) { // Ensure there are enough bytes for a full sample
                    inputSamples.push(inputBuffer.readInt16LE(i));
                }
            }

            if (inputSamples.length === 0 && inputBuffer.length > 0) {
                // This indicates an issue, possibly an odd-length buffer that resulted in no full samples.
                throw new Error('Resampling: No samples extracted from non-empty input buffer. Check buffer integrity.');
            }
            if (inputSamples.length === 0 && inputBuffer.length === 0) {
                // This case is handled by the initial check, but as a safeguard:
                return Buffer.alloc(0);
            }


            const ratio = outputRate / inputRate;
            const outputLength = Math.floor(inputSamples.length * ratio);
            if (outputLength === 0 && inputSamples.length > 0) {
                // This could happen if outputRate is drastically lower than inputRate,
                // or if inputSamples.length is very small.
                console.warn(`Resampling: Calculated outputLength is 0 for ${inputSamples.length} input samples (ratio: ${ratio}).`);
                return Buffer.alloc(0); // Return empty if no output samples can be formed
            }
            const outputSamples = new Array(outputLength);

            for (let i = 0; i < outputLength; i++) {
                const sourceIndex = i / ratio;
                const leftIndex = Math.floor(sourceIndex);
                const rightIndex = Math.min(leftIndex + 1, inputSamples.length - 1); // Ensure rightIndex is valid
                const fraction = sourceIndex - leftIndex;

                // Ensure leftIndex is valid before accessing inputSamples
                const leftSample = (leftIndex >= 0 && leftIndex < inputSamples.length) ? inputSamples[leftIndex] : 0;
                const rightSample = (rightIndex >= 0 && rightIndex < inputSamples.length) ? inputSamples[rightIndex] : 0;
                
                outputSamples[i] = Math.round(leftSample + fraction * (rightSample - leftSample));
            }

            const outputBuffer = Buffer.alloc(outputSamples.length * 2);
            for (let i = 0; i < outputSamples.length; i++) {
                outputBuffer.writeInt16LE(outputSamples[i], i * 2);
            }

            return outputBuffer;
        } catch (err) {
            console.error(`Error resampling PCM from ${inputRate}Hz to ${outputRate}Hz: ${err.message}`, err.stack);
            throw new Error(`PCM resampling failed: ${err.message}`);
        }
    }

    // --- Other utility methods like convertBase64UlawToPcm, validateAudioBuffer, etc. can remain as they are ---
    // Ensure their internal calls to the above static methods are awaited if they become async due to other changes,
    // though the core conversion/resampling methods themselves aren't directly async unless they use an async library.
    // The `async` keyword on `convertPcmToUlaw` and `convertUlawToPcm` was there, so I've kept it,
    // but `alawmulaw` itself is synchronous. If there are no other `await` calls, `async` might not be strictly needed for them.

    /**
     * Convert base64 uLaw to base64 PCM (convenience method)
     * @param {string} ulawBase64 - Base64 encoded uLaw
     * @returns {Promise<string>} Base64 encoded PCM
     */
    static async convertBase64UlawToPcm(ulawBase64) {
        if (!ulawBase64) return '';
        try {
            const ulawBuffer = Buffer.from(ulawBase64, 'base64');
            const pcmBuffer = await this.convertUlawToPcm(ulawBuffer); // `await` is correct as convertUlawToPcm is async
            return pcmBuffer.toString('base64');
        } catch (err) {
            console.error('Error converting base64 uLaw to PCM:', err.message); // Keep simple log for convenience method
            return ''; // Or rethrow if strict error propagation is needed here too
        }
    }

    /**
     * Convert base64 PCM to base64 uLaw (convenience method)
     * @param {string} pcmBase64 - Base64 encoded PCM
     * @returns {Promise<string>} Base64 encoded uLaw
     */
    static async convertBase64PcmToUlaw(pcmBase64) {
        if (!pcmBase64) return '';
        try {
            const pcmBuffer = Buffer.from(pcmBase64, 'base64');
            return await this.convertPcmToUlaw(pcmBuffer); // `await` is correct
        } catch (err) {
            console.error('Error converting base64 PCM to uLaw:', err.message);
            return '';
        }
    }

    // ... (validateAudioBuffer, getAudioInfo, createSilence - these seem fine as they were)
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
            // An empty buffer might be considered "valid" in some contexts but not processable.
            // For processability, it's often invalid. Let's say false if truly empty.
            return false; 
        }
        
        switch (expectedFormat.toLowerCase()) {
            case 'pcm16':
                return buffer.length % 2 === 0;
            case 'ulaw':
            case 'alaw':
                return true;
            default:
                return true; 
        }
    }

    /**
     * Get audio buffer info
     */
    static getAudioInfo(buffer, format = 'pcm16', sampleRate = 8000) {
        if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
            return { valid: false, bytes: 0, samples: 0, durationMs: 0, format, sampleRate, bytesPerSample: 0 };
        }
        
        const bytesPerSample = format.toLowerCase() === 'pcm16' ? 2 : 1;
        // Ensure buffer length is valid for bytesPerSample before division
        if (format.toLowerCase() === 'pcm16' && buffer.length % 2 !== 0) {
             console.warn(`getAudioInfo: PCM16 buffer has odd length ${buffer.length}`);
             // Decide how to calculate samples: floor, or mark as invalid for duration purposes
        }
        const samples = Math.floor(buffer.length / bytesPerSample);
        const durationMs = samples > 0 && sampleRate > 0 ? (samples / sampleRate) * 1000 : 0;
        
        return {
            valid: true, // Or more nuanced validation based on content if needed
            bytes: buffer.length,
            samples: samples,
            durationMs: Math.round(durationMs * 100) / 100,
            format: format,
            sampleRate: sampleRate,
            bytesPerSample: bytesPerSample
        };
    }

    /**
     * Create silence buffer
     */
    static createSilence(durationMs, format = 'pcm16', sampleRate = 8000) {
        if (durationMs <=0 || sampleRate <=0) return Buffer.alloc(0);

        const samples = Math.floor((durationMs / 1000) * sampleRate);
        if (samples <= 0) return Buffer.alloc(0);

        const bytesPerSample = format.toLowerCase() === 'pcm16' ? 2 : 1;
        const bufferSize = samples * bytesPerSample;
        
        if (format.toLowerCase() === 'ulaw') {
            return Buffer.alloc(bufferSize, 0xFF);
        } else {
            return Buffer.alloc(bufferSize, 0x00);
        }
    }
}

module.exports = AudioUtils;