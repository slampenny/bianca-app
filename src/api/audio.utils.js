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
            return '';
        }

        try {
            const samples = [];
            // Fixed: ensure we don't read past buffer end
            for (let i = 0; i < pcmBuffer.length - 1; i += 2) {
                let sample = pcmBuffer.readInt16LE(i);
                // Added: clamp samples to prevent overflow
                sample = Math.max(-32768, Math.min(32767, sample));
                samples.push(sample);
            }

            if (samples.length === 0 && pcmBuffer.length > 0) {
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
            return Buffer.alloc(0);
        }

        try {
            const ulawArray = Array.from(ulawBuffer);
            const pcmSamples = alawmulaw.mulaw.decode(ulawArray);

            if (!pcmSamples) {
                throw new Error('alawmulaw.mulaw.decode returned null or undefined.');
            }

            const pcmBuffer = Buffer.alloc(pcmSamples.length * 2);
            for (let i = 0; i < pcmSamples.length; i++) {
                // Added: clamp samples during conversion
                const sample = Math.max(-32768, Math.min(32767, Math.round(pcmSamples[i])));
                pcmBuffer.writeInt16LE(sample, i * 2);
            }

            return pcmBuffer;
        } catch (err) {
            console.error('Error converting uLaw to PCM:', err.message, err.stack);
            throw new Error(`uLaw to PCM conversion failed: ${err.message}`);
        }
    }

    /**
     * Resample PCM audio from one sample rate to another using better interpolation
     * @param {Buffer} inputBuffer - Input PCM buffer
     * @param {number} inputRate - Input sample rate (Hz)
     * @param {number} outputRate - Output sample rate (Hz)
     * @returns {Buffer} Resampled PCM buffer
     * @throws {Error} If resampling fails
     */
    static resamplePcm(inputBuffer, inputRate, outputRate) {
        if (!inputBuffer || inputBuffer.length === 0) {
            return Buffer.alloc(0);
        }

        if (inputBuffer.length % 2 !== 0) {
            console.warn(`Resampling: Input buffer has odd length (${inputBuffer.length} bytes). Trimming last byte.`);
            inputBuffer = inputBuffer.slice(0, inputBuffer.length - 1);
        }

        if (inputRate === outputRate) {
            return inputBuffer;
        }

        try {
            // Extract samples
            const inputSamples = [];
            for (let i = 0; i < inputBuffer.length; i += 2) {
                inputSamples.push(inputBuffer.readInt16LE(i));
            }

            if (inputSamples.length === 0) {
                return Buffer.alloc(0);
            }

            // Use cubic interpolation for good quality/performance balance
            const outputSamples = this.resampleWithCubic(inputSamples, inputRate, outputRate);

            // Convert back to buffer
            const outputBuffer = Buffer.alloc(outputSamples.length * 2);
            for (let i = 0; i < outputSamples.length; i++) {
                // Clamp values to prevent overflow
                const sample = Math.max(-32768, Math.min(32767, Math.round(outputSamples[i])));
                outputBuffer.writeInt16LE(sample, i * 2);
            }

            return outputBuffer;
        } catch (err) {
            console.error(`Error resampling PCM from ${inputRate}Hz to ${outputRate}Hz: ${err.message}`, err.stack);
            throw new Error(`PCM resampling failed: ${err.message}`);
        }
    }

    /**
     * Resample using windowed sinc interpolation for better quality
     * @private
     */
    static resampleWithSinc(inputSamples, inputRate, outputRate) {
        const ratio = inputRate / outputRate;
        const outputLength = Math.ceil(inputSamples.length / ratio);
        const outputSamples = new Float32Array(outputLength);
        
        // Use a Kaiser window for the sinc function
        const filterSize = 16; // Number of input samples to consider for each output sample
        const halfFilter = filterSize / 2;
        
        for (let i = 0; i < outputLength; i++) {
            const srcPos = i * ratio;
            const srcIndex = Math.floor(srcPos);
            const fracPos = srcPos - srcIndex;
            
            let sum = 0;
            let weightSum = 0;
            
            // Apply windowed sinc interpolation
            for (let j = -halfFilter; j <= halfFilter; j++) {
                const sampleIndex = srcIndex + j;
                
                if (sampleIndex >= 0 && sampleIndex < inputSamples.length) {
                    const sincArg = (j - fracPos);
                    let weight;
                    
                    if (Math.abs(sincArg) < 0.001) {
                        weight = 1.0;
                    } else {
                        // Sinc function
                        const x = Math.PI * sincArg;
                        weight = Math.sin(x) / x;
                        
                        // Apply Kaiser window
                        const windowArg = (j - fracPos) / halfFilter;
                        const beta = 5.0; // Kaiser window parameter
                        weight *= this.kaiserWindow(windowArg, beta);
                    }
                    
                    sum += inputSamples[sampleIndex] * weight;
                    weightSum += weight;
                }
            }
            
            outputSamples[i] = weightSum > 0 ? sum / weightSum : 0;
        }
        
        return outputSamples;
    }

    /**
     * Kaiser window function for sinc interpolation
     * @private
     */
    static kaiserWindow(x, beta) {
        if (Math.abs(x) > 1) return 0;
        
        const xSq = 1 - x * x;
        const arg = beta * Math.sqrt(xSq);
        
        return this.besselI0(arg) / this.besselI0(beta);
    }

    /**
     * Modified Bessel function of the first kind, order 0
     * Used for Kaiser window calculation
     * @private
     */
    static besselI0(x) {
        let sum = 1.0;
        let term = 1.0;
        
        for (let k = 1; k < 50; k++) {
            term *= (x * x) / (4 * k * k);
            sum += term;
            
            if (term < 1e-10 * sum) break;
        }
        
        return sum;
    }

    /**
     * Cubic interpolation resampling for better quality than linear
     * @private
     */
    static resampleWithCubic(inputSamples, inputRate, outputRate) {
        const ratio = inputRate / outputRate;
        const outputLength = Math.ceil(inputSamples.length / ratio);
        const outputSamples = new Float32Array(outputLength);
        
        for (let i = 0; i < outputLength; i++) {
            const srcPos = i * ratio;
            const srcIndex = Math.floor(srcPos);
            const frac = srcPos - srcIndex;
            
            // Get four points for cubic interpolation
            const p0 = inputSamples[Math.max(0, srcIndex - 1)] || 0;
            const p1 = inputSamples[srcIndex] || 0;
            const p2 = inputSamples[Math.min(inputSamples.length - 1, srcIndex + 1)] || 0;
            const p3 = inputSamples[Math.min(inputSamples.length - 1, srcIndex + 2)] || 0;
            
            // Catmull-Rom cubic interpolation
            const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
            const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
            const c = -0.5 * p0 + 0.5 * p2;
            const d = p1;
            
            outputSamples[i] = a * frac * frac * frac + b * frac * frac + c * frac + d;
        }
        
        return outputSamples;
    }

    /**
     * Convert base64 uLaw to base64 PCM (convenience method)
     * @param {string} ulawBase64 - Base64 encoded uLaw
     * @returns {Promise<string>} Base64 encoded PCM
     * @throws {Error} If conversion fails
     */
    static async convertBase64UlawToPcm(ulawBase64) {
        if (!ulawBase64) {
            throw new Error('Input base64 uLaw string is empty');
        }
        
        const ulawBuffer = Buffer.from(ulawBase64, 'base64');
        const pcmBuffer = await this.convertUlawToPcm(ulawBuffer);
        return pcmBuffer.toString('base64');
    }

    /**
     * Convert base64 PCM to base64 uLaw (convenience method)
     * @param {string} pcmBase64 - Base64 encoded PCM
     * @returns {Promise<string>} Base64 encoded uLaw
     * @throws {Error} If conversion fails
     */
    static async convertBase64PcmToUlaw(pcmBase64) {
        if (!pcmBase64) {
            throw new Error('Input base64 PCM string is empty');
        }
        
        const pcmBuffer = Buffer.from(pcmBase64, 'base64');
        return await this.convertPcmToUlaw(pcmBuffer);
    }

    /**
     * Validate audio buffer format
     * @param {Buffer} buffer - Audio buffer to validate
     * @param {string} expectedFormat - Expected format ('pcm16', 'ulaw', etc.)
     * @param {boolean} allowEmpty - Whether to consider empty buffers valid
     * @returns {boolean} True if valid
     */
    static validateAudioBuffer(buffer, expectedFormat = 'pcm16', allowEmpty = false) {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            return false;
        }
        
        if (buffer.length === 0) {
            return allowEmpty;
        }
        
        switch (expectedFormat.toLowerCase()) {
            case 'pcm16':
                // PCM16 must have even number of bytes
                return buffer.length % 2 === 0;
            case 'ulaw':
            case 'mulaw':
            case 'alaw':
                // These are 8-bit formats, any length is valid
                return true;
            default:
                console.warn(`Unknown audio format: ${expectedFormat}`);
                return false;
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
        
        if (format.toLowerCase() === 'pcm16' && buffer.length % 2 !== 0) {
            console.warn(`getAudioInfo: PCM16 buffer has odd length ${buffer.length}`);
        }
        
        const samples = Math.floor(buffer.length / bytesPerSample);
        const durationMs = samples > 0 && sampleRate > 0 ? (samples / sampleRate) * 1000 : 0;
        
        return {
            valid: this.validateAudioBuffer(buffer, format, false),
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
     * @param {number} durationMs - Duration in milliseconds
     * @param {string} format - Audio format ('pcm16', 'ulaw', etc.)
     * @param {number} sampleRate - Sample rate in Hz
     * @returns {Buffer} Silence buffer
     */
    static createSilence(durationMs, format = 'pcm16', sampleRate = 8000) {
        if (durationMs <= 0 || sampleRate <= 0) {
            throw new Error('Duration and sample rate must be positive');
        }

        const samples = Math.floor((durationMs / 1000) * sampleRate);
        if (samples <= 0) return Buffer.alloc(0);

        const bytesPerSample = format.toLowerCase() === 'pcm16' ? 2 : 1;
        const bufferSize = samples * bytesPerSample;
        
        switch (format.toLowerCase()) {
            case 'ulaw':
            case 'mulaw':
                // Fixed: μ-law silence is 0x7F (not 0xFF)
                return Buffer.alloc(bufferSize, 0x7F);
            case 'alaw':
                // A-law silence is 0xD5
                return Buffer.alloc(bufferSize, 0xD5);
            case 'pcm16':
            default:
                // PCM silence is all zeros
                return Buffer.alloc(bufferSize, 0x00);
        }
    }

    /**
     * Mix multiple PCM buffers together
     * @param {Buffer[]} buffers - Array of PCM buffers to mix
     * @param {number[]} gains - Optional array of gain values (0-1) for each buffer
     * @returns {Buffer} Mixed PCM buffer
     */
    static mixPcmBuffers(buffers, gains = null) {
        if (!buffers || buffers.length === 0) {
            return Buffer.alloc(0);
        }
        
        // Find the longest buffer
        const maxLength = Math.max(...buffers.map(b => b.length));
        const outputBuffer = Buffer.alloc(maxLength);
        const numBuffers = buffers.length;
        
        // Default gains to equal mixing
        if (!gains) {
            gains = new Array(numBuffers).fill(1.0 / numBuffers);
        }
        
        // Mix samples
        for (let i = 0; i < maxLength - 1; i += 2) {
            let mixedSample = 0;
            
            for (let j = 0; j < numBuffers; j++) {
                if (i < buffers[j].length - 1) {
                    const sample = buffers[j].readInt16LE(i);
                    mixedSample += sample * gains[j];
                }
            }
            
            // Clamp and write
            mixedSample = Math.max(-32768, Math.min(32767, Math.round(mixedSample)));
            outputBuffer.writeInt16LE(mixedSample, i);
        }
        
        return outputBuffer;
    }

    /**
     * Apply gain to PCM buffer
     * @param {Buffer} buffer - Input PCM buffer
     * @param {number} gain - Gain factor (1.0 = no change, 2.0 = double volume, etc.)
     * @returns {Buffer} Gained PCM buffer
     */
    static applyGain(buffer, gain) {
        if (!buffer || buffer.length === 0 || gain === 1.0) {
            return buffer;
        }
        
        const outputBuffer = Buffer.alloc(buffer.length);
        
        for (let i = 0; i < buffer.length - 1; i += 2) {
            let sample = buffer.readInt16LE(i);
            sample = Math.max(-32768, Math.min(32767, Math.round(sample * gain)));
            outputBuffer.writeInt16LE(sample, i);
        }
        
        return outputBuffer;
    }

    /**
     * Detect if audio buffer contains silence
     * @param {Buffer} buffer - Audio buffer to check
     * @param {string} format - Audio format
     * @param {number} threshold - Silence threshold (0-1, default 0.01 = 1% of max amplitude)
     * @returns {boolean} True if buffer is silent
     */
    static isSilent(buffer, format = 'pcm16', threshold = 0.01) {
        if (!buffer || buffer.length === 0) {
            return true;
        }
        
        const maxAmplitude = format.toLowerCase() === 'pcm16' ? 32768 : 128;
        const silenceThreshold = maxAmplitude * threshold;
        
        if (format.toLowerCase() === 'pcm16') {
            for (let i = 0; i < buffer.length - 1; i += 2) {
                const sample = Math.abs(buffer.readInt16LE(i));
                if (sample > silenceThreshold) {
                    return false;
                }
            }
        } else if (format.toLowerCase() === 'ulaw' || format.toLowerCase() === 'mulaw') {
            const silenceValue = 0x7F;
            const tolerance = Math.round(silenceThreshold);
            
            for (let i = 0; i < buffer.length; i++) {
                if (Math.abs(buffer[i] - silenceValue) > tolerance) {
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * Trim silence from beginning and end of audio buffer
     * @param {Buffer} buffer - Input audio buffer
     * @param {string} format - Audio format
     * @param {number} threshold - Silence threshold (0-1)
     * @returns {Buffer} Trimmed audio buffer
     */
    static trimSilence(buffer, format = 'pcm16', threshold = 0.01) {
        if (!buffer || buffer.length === 0 || this.isSilent(buffer, format, threshold)) {
            return Buffer.alloc(0);
        }

        const bytesPerSample = format.toLowerCase() === 'pcm16' ? 2 : 1;
        let startIndex = 0;
        let endIndex = buffer.length;

        // Find start of non-silence
        for (let i = 0; i < buffer.length; i += bytesPerSample) {
            const sampleBuffer = buffer.slice(i, i + bytesPerSample);
            if (!this.isSilent(sampleBuffer, format, threshold)) {
                startIndex = i;
                break;
            }
        }

        // Find end of non-silence
        for (let i = buffer.length - bytesPerSample; i >= 0; i -= bytesPerSample) {
            const sampleBuffer = buffer.slice(i, i + bytesPerSample);
            if (!this.isSilent(sampleBuffer, format, threshold)) {
                endIndex = i + bytesPerSample;
                break;
            }
        }

        return buffer.slice(startIndex, endIndex);
    }

    /**
     * Concatenate multiple audio buffers
     * @param {Buffer[]} buffers - Array of buffers to concatenate
     * @returns {Buffer} Concatenated buffer
     */
    static concatenateBuffers(buffers) {
        if (!buffers || buffers.length === 0) {
            return Buffer.alloc(0);
        }

        return Buffer.concat(buffers.filter(b => b && b.length > 0));
    }
}

module.exports = AudioUtils;