// src/services/rtp.sender.service.js

const dgram = require('dgram');
const { Buffer } = require('buffer');
const logger = require('../config/logger');
const AudioUtils = require('./audio.utils');

/**
 * RTP Sender Service - Sends audio TO Asterisk via ExternalMedia
 * This handles the "write" direction: App → Asterisk
 */
class RtpSenderService {
    constructor() {
        this.activeCalls = new Map(); // callId -> call config
        this.udpSockets = new Map(); // callId -> UDP socket
        this.sequenceNumbers = new Map(); // callId -> current sequence number
        this.timestamps = new Map(); // callId -> current timestamp
        this.ssrcs = new Map(); // callId -> SSRC
        
        // RTP Constants
        this.RTP_VERSION = 2;
        this.RTP_PAYLOAD_TYPE = 0; // PCMU (uLaw) - but we'll convert to SLIN if needed
        this.SAMPLE_RATE = 8000; // 8kHz for telephone quality
        this.FRAME_SIZE_MS = 20; // 20ms frames
        this.SAMPLES_PER_FRAME = (this.SAMPLE_RATE * this.FRAME_SIZE_MS) / 1000; // 160 samples
        
        logger.info('[RTP Sender] Service initialized');
    }

    /**
     * Initialize a call for RTP sending
     */
    async initializeCall(callId, config) {
        if (this.activeCalls.has(callId)) {
            logger.warn(`[RTP Sender] Call ${callId} already initialized`);
            return;
        }

        logger.info(`[RTP Sender] Initializing call ${callId} with config:`, {
            asteriskChannelId: config.asteriskChannelId,
            rtpHost: config.rtpHost,
            rtpPort: config.rtpPort,
            format: config.format
        });

        // Generate a unique SSRC for this call
        const ssrc = Math.floor(Math.random() * 0xFFFFFFFF);
        
        this.activeCalls.set(callId, {
            ...config,
            ssrc,
            initialized: true
        });
        
        this.sequenceNumbers.set(callId, Math.floor(Math.random() * 65536));
        this.timestamps.set(callId, Math.floor(Math.random() * 0xFFFFFFFF));
        this.ssrcs.set(callId, ssrc);

        // Create UDP socket for this call
        const socket = dgram.createSocket('udp4');
        this.udpSockets.set(callId, socket);

        socket.on('error', (err) => {
            logger.error(`[RTP Sender] Socket error for ${callId}: ${err.message}`);
            this.cleanupCall(callId);
        });

        logger.info(`[RTP Sender] Call ${callId} initialized with SSRC ${ssrc}`);
    }

    /**
     * Send audio data to Asterisk for a specific call
     */
    async sendAudio(callId, audioBase64Ulaw) {
        if (!audioBase64Ulaw || audioBase64Ulaw.length === 0) {
            logger.debug(`[RTP Sender] Empty audio data for ${callId}`);
            return;
        }

        const callConfig = this.activeCalls.get(callId);
        if (!callConfig) {
            logger.warn(`[RTP Sender] Call ${callId} not initialized for audio sending`);
            return;
        }

        const socket = this.udpSockets.get(callId);
        if (!socket) {
            logger.error(`[RTP Sender] No UDP socket for call ${callId}`);
            return;
        }

        try {
            // Convert base64 uLaw to buffer
            const ulawBuffer = Buffer.from(audioBase64Ulaw, 'base64');
            
            // Convert uLaw to the format expected by Asterisk (SLIN if that's what's configured)
            let audioPayload;
            if (callConfig.format === 'slin') {
                // Convert uLaw to 16-bit PCM (SLIN)
                audioPayload = await AudioUtils.convertUlawToPcm(ulawBuffer);
            } else if (callConfig.format === 'ulaw') {
                // Use uLaw directly
                audioPayload = ulawBuffer;
            } else {
                logger.warn(`[RTP Sender] Unsupported format ${callConfig.format} for ${callId}, using uLaw`);
                audioPayload = ulawBuffer;
            }

            if (!audioPayload || audioPayload.length === 0) {
                logger.warn(`[RTP Sender] Audio conversion resulted in empty payload for ${callId}`);
                return;
            }

            // Split audio into RTP frames and send
            await this.sendAudioFrames(callId, audioPayload, socket, callConfig);
            
        } catch (err) {
            logger.error(`[RTP Sender] Error sending audio for ${callId}: ${err.message}`, err);
        }
    }

    /**
     * Split audio into RTP packets and send them
     */
    async sendAudioFrames(callId, audioBuffer, socket, callConfig) {
        const bytesPerSample = callConfig.format === 'slin' ? 2 : 1; // 16-bit vs 8-bit
        const bytesPerFrame = this.SAMPLES_PER_FRAME * bytesPerSample;
        
        let offset = 0;
        const promises = [];

        while (offset < audioBuffer.length) {
            const frameSize = Math.min(bytesPerFrame, audioBuffer.length - offset);
            const frameData = audioBuffer.slice(offset, offset + frameSize);
            
            if (frameData.length > 0) {
                const rtpPacket = this.createRtpPacket(callId, frameData, callConfig);
                const sendPromise = this.sendRtpPacket(socket, rtpPacket, callConfig.rtpHost, callConfig.rtpPort);
                promises.push(sendPromise);
            }
            
            offset += frameSize;
            
            // Update timestamp for next frame
            const currentTimestamp = this.timestamps.get(callId);
            this.timestamps.set(callId, (currentTimestamp + this.SAMPLES_PER_FRAME) & 0xFFFFFFFF);
        }

        // Wait for all packets to be sent
        await Promise.all(promises);
        
        logger.debug(`[RTP Sender] Sent ${promises.length} RTP frames for ${callId}`);
    }

    /**
     * Create an RTP packet
     */
    createRtpPacket(callId, audioData, callConfig) {
        const sequenceNumber = this.sequenceNumbers.get(callId);
        const timestamp = this.timestamps.get(callId);
        const ssrc = this.ssrcs.get(callId);

        // RTP Header (12 bytes minimum)
        const header = Buffer.alloc(12);
        
        // Byte 0: Version (2 bits) + Padding (1 bit) + Extension (1 bit) + CSRC count (4 bits)
        header[0] = (this.RTP_VERSION << 6); // Version 2, no padding, no extension, no CSRC
        
        // Byte 1: Marker (1 bit) + Payload Type (7 bits)
        const payloadType = callConfig.format === 'slin' ? 11 : 0; // 11 = L16, 0 = PCMU
        header[1] = payloadType; // No marker bit for continuous audio
        
        // Bytes 2-3: Sequence Number
        header.writeUInt16BE(sequenceNumber, 2);
        
        // Bytes 4-7: Timestamp
        header.writeUInt32BE(timestamp, 4);
        
        // Bytes 8-11: SSRC
        header.writeUInt32BE(ssrc, 8);

        // Update sequence number for next packet
        this.sequenceNumbers.set(callId, (sequenceNumber + 1) & 0xFFFF);

        // Combine header and payload
        return Buffer.concat([header, audioData]);
    }

    /**
     * Send RTP packet via UDP
     */
    async sendRtpPacket(socket, rtpPacket, host, port) {
        return new Promise((resolve, reject) => {
            socket.send(rtpPacket, port, host, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Cleanup resources for a call
     */
    cleanupCall(callId) {
        logger.info(`[RTP Sender] Cleaning up call ${callId}`);

        // Close UDP socket
        const socket = this.udpSockets.get(callId);
        if (socket) {
            try {
                socket.close();
            } catch (err) {
                logger.warn(`[RTP Sender] Error closing socket for ${callId}: ${err.message}`);
            }
            this.udpSockets.delete(callId);
        }

        // Remove call state
        this.activeCalls.delete(callId);
        this.sequenceNumbers.delete(callId);
        this.timestamps.delete(callId);
        this.ssrcs.delete(callId);

        logger.info(`[RTP Sender] Cleanup completed for ${callId}`);
    }

    /**
     * Cleanup all active calls
     */
    cleanupAll() {
        logger.info(`[RTP Sender] Cleaning up all calls (${this.activeCalls.size} active)`);
        
        const callIds = [...this.activeCalls.keys()];
        for (const callId of callIds) {
            this.cleanupCall(callId);
        }
        
        logger.info('[RTP Sender] All calls cleaned up');
    }

    /**
     * Get status of active calls
     */
    getStatus() {
        return {
            activeCalls: this.activeCalls.size,
            callIds: [...this.activeCalls.keys()]
        };
    }
}

// Create singleton instance
const rtpSenderService = new RtpSenderService();

// Graceful shutdown
process.on('SIGTERM', () => rtpSenderService.cleanupAll());
process.on('SIGINT', () => rtpSenderService.cleanupAll());

module.exports = rtpSenderService;