// src/services/rtp.sender.service.js - Complete version with timestamp fix

const dgram = require('dgram');
const { Buffer } = require('buffer');
const logger = require('../config/logger');
const AudioUtils = require('../api/audio.utils');
const EventEmitter = require('events');

/**
 * RTP Sender Service - Enhanced version with timestamp continuity fix
 */
class RtpSenderService extends EventEmitter {
    constructor() {
        super();
        this.activeCalls = new Map(); // callId -> call config
        this.udpSockets = new Map(); // callId -> UDP socket
        this.sequenceNumbers = new Map(); // callId -> current sequence number
        this.timestamps = new Map(); // callId -> current timestamp
        this.ssrcs = new Map(); // callId -> SSRC
        this.stats = new Map(); // callId -> statistics
        
        // ADD: Track continuous timestamps and buffer audio
        this.continuousTimestamps = new Map(); // callId -> last sent timestamp
        this.audioBuffers = new Map(); // callId -> buffered audio
        this.packetTimers = new Map(); // callId -> interval timer
        
        // RTP Constants
        this.RTP_VERSION = 2;
        this.RTP_PAYLOAD_TYPE_ULAW = 0;
        this.RTP_PAYLOAD_TYPE_SLIN16_8K = 11;
        this.RTP_SEND_FORMAT = 'ulaw';
        this.SAMPLE_RATE = 8000;
        this.FRAME_SIZE_MS = 5; // Reduced to 5ms for more responsive audio with small chunks
        this.SAMPLES_PER_FRAME = (this.SAMPLE_RATE * this.FRAME_SIZE_MS) / 1000;
        
        // Enhanced error tracking
        this.isShuttingDown = false;
        this.globalStats = {
            totalCalls: 0,
            activeCalls: 0,
            totalPacketsSent: 0,
            totalErrors: 0,
            startTime: Date.now()
        };
        
        logger.info('[RTP Sender] Service initialized with enhanced monitoring and timestamp continuity');
    }

    /**
     * Enhanced initialization with better validation
     */
    async initializeCall(callId, config) {
        if (!callId) {
            throw new Error('CallId is required for RTP sender initialization');
        }

        if (!config || !config.rtpHost || !config.rtpPort) {
            throw new Error('Valid config with rtpHost and rtpPort is required');
        }

        if (this.activeCalls.has(callId)) {
            const existingConfig = this.activeCalls.get(callId);
            if (existingConfig.initialized) {
                logger.warn(`[RTP Sender] Call ${callId} already initialized. Skipping.`);
                return;
            }
        }

        logger.info(`[RTP Sender] Initializing call ${callId}`, {
            asteriskChannelId: config.asteriskChannelId,
            rtpHost: config.rtpHost,
            rtpPort: config.rtpPort,
            format: config.format || this.RTP_SEND_FORMAT
        });
        
        // Add debugging to track initialization
        logger.info(`[RTP Sender] Active calls before init: ${Array.from(this.activeCalls.keys()).join(', ')}`);

        try {
            // Validate RTP endpoint
            if (isNaN(config.rtpPort) || config.rtpPort < 1 || config.rtpPort > 65535) {
                throw new Error(`Invalid RTP port: ${config.rtpPort}`);
            }

            const ssrc = Math.floor(Math.random() * 0xFFFFFFFF);
            const initialSequence = Math.floor(Math.random() * 0xFFFF);
            const initialTimestamp = Math.floor(Math.random() * 0xFFFFFFFF);
            
            this.activeCalls.set(callId, {
                ...config,
                ssrc,
                initialized: true,
                initTime: Date.now()
            });
            
            this.sequenceNumbers.set(callId, initialSequence);
            this.timestamps.set(callId, initialTimestamp);
            this.continuousTimestamps.set(callId, initialTimestamp); // Initialize continuous timestamp
            this.ssrcs.set(callId, ssrc);
            this.stats.set(callId, {
                packetsSent: 0,
                bytesSent: 0,
                errors: 0,
                lastActivity: Date.now()
            });

            // Initialize audio buffer
            this.audioBuffers.set(callId, Buffer.alloc(0));

            // Create socket with enhanced error handling
            const socket = dgram.createSocket('udp4');
            this.udpSockets.set(callId, socket);

            socket.on('error', (err) => {
                logger.error(`[RTP Sender] Socket error for ${callId}: ${err.message}`, err);
                this.updateStats(callId, 'error');
                this.globalStats.totalErrors++;
                
                // Don't auto-cleanup on socket errors, let the calling code handle it
                this.emit('socket_error', { callId, error: err });
            });

            socket.on('close', () => {
                logger.info(`[RTP Sender] Socket closed for ${callId}`);
            });

            // Start packet sender timer for this call
            this.startPacketSender(callId);

            this.globalStats.totalCalls++;
            this.globalStats.activeCalls++;

            logger.info(`[RTP Sender] Call ${callId} initialized successfully. SSRC: ${ssrc}, Target: ${config.rtpHost}:${config.rtpPort}`);
            logger.info(`[RTP Sender] Active calls after init: ${Array.from(this.activeCalls.keys()).join(', ')}`);
            
        } catch (err) {
            logger.error(`[RTP Sender] Failed to initialize call ${callId}: ${err.message}`, err);
            this.cleanupCall(callId);
            throw err;
        }
    }

    /**
     * Start packet sender timer for a specific call
     */
    startPacketSender(callId) {
        // Clear any existing timer
        if (this.packetTimers.has(callId)) {
            clearInterval(this.packetTimers.get(callId));
        }

        // Create new timer for this call
        const timer = setInterval(() => {
            this.sendNextFrame(callId);
        }, this.FRAME_SIZE_MS);

        this.packetTimers.set(callId, timer);
        logger.debug(`[RTP Sender] Started packet sender timer for ${callId}`);
    }

    /**
     * Send the next frame for a call
     */
    sendNextFrame(callId) {
        const buffer = this.audioBuffers.get(callId);
        if (!buffer || buffer.length < this.SAMPLES_PER_FRAME) {
            // Add debugging to see why frames aren't being sent
            if (buffer && buffer.length > 0) {
                logger.debug(`[RTP Sender] Not enough data for frame: ${buffer.length}/${this.SAMPLES_PER_FRAME} bytes for ${callId}`);
            }
            return; // Not enough data to send a frame
        }

        // Log when we actually send frames
        if (!this.framesSentCount) this.framesSentCount = {};
        if (!this.framesSentCount[callId]) this.framesSentCount[callId] = 0;
        this.framesSentCount[callId]++;
        
        if (this.framesSentCount[callId] <= 10 || this.framesSentCount[callId] % 100 === 0) {
            logger.info(`[RTP Sender] Sending frame #${this.framesSentCount[callId]} for ${callId} (buffer: ${buffer.length} bytes)`);
        }

        const callConfig = this.activeCalls.get(callId);
        const socket = this.udpSockets.get(callId);
        
        if (!callConfig || !socket || !callConfig.initialized || this.isShuttingDown) {
            return;
        }

        // Extract one frame worth of data
        const frameData = buffer.slice(0, this.SAMPLES_PER_FRAME);
        
        // Update buffer to remove sent data
        const remaining = buffer.slice(this.SAMPLES_PER_FRAME);
        this.audioBuffers.set(callId, remaining);

        // Use continuous timestamp
        const timestamp = this.continuousTimestamps.get(callId) || this.timestamps.get(callId);

        // Create and send RTP packet
        try {
            const rtpPacket = this.createRtpPacket(callId, frameData, callConfig, timestamp);
            if (rtpPacket) {
                this.sendRtpPacketSync(socket, rtpPacket, callConfig.rtpHost, callConfig.rtpPort, callId);
                
                // Update continuous timestamp for next packet
                const nextTimestamp = (timestamp + this.SAMPLES_PER_FRAME) >>> 0; // Ensure 32-bit unsigned
                this.continuousTimestamps.set(callId, nextTimestamp);
                
                // Also update the regular timestamp for compatibility
                this.timestamps.set(callId, nextTimestamp);
            }
        } catch (err) {
            logger.error(`[RTP Sender] Error sending frame for ${callId}: ${err.message}`);
            this.updateStats(callId, 'error');
        }
    }

    /**
     * Enhanced audio sending with buffering
     */
    async sendAudio(callId, audioBase64Ulaw) {
        if (this.isShuttingDown) {
            logger.debug(`[RTP Sender] Service shutting down, ignoring audio for ${callId}`);
            return;
        }

        if (!audioBase64Ulaw || audioBase64Ulaw.length === 0) {
            logger.debug(`[RTP Sender] Empty audio data for ${callId}, skipping`);
            return;
        }

        const callConfig = this.activeCalls.get(callId);
        if (!callConfig || !callConfig.initialized) {
            logger.warn(`[RTP Sender] Call ${callId} not initialized or missing config`);
            // Add debugging to see what calls are available
            const availableCalls = Array.from(this.activeCalls.keys());
            logger.warn(`[RTP Sender] Available calls: ${availableCalls.join(', ')}`);
            return;
        }

        const socket = this.udpSockets.get(callId);
        if (!socket) {
            logger.error(`[RTP Sender] No UDP socket found for call ${callId}`);
            return;
        }

        // ADD DEBUGGING
        if (!this.audioChunkCount) this.audioChunkCount = {};
        if (!this.audioChunkCount[callId]) this.audioChunkCount[callId] = 0;
        this.audioChunkCount[callId]++;
        
        if (this.audioChunkCount[callId] <= 20 || this.audioChunkCount[callId] % 50 === 0) {
            logger.info(`[RTP Sender] Processing audio chunk #${this.audioChunkCount[callId]} for ${callId} (size: ${audioBase64Ulaw.length})`);
        }

        try {
            const ulawBuffer = Buffer.from(audioBase64Ulaw, 'base64');
            if (ulawBuffer.length === 0) {
                logger.warn(`[RTP Sender] Decoded audio buffer is empty for ${callId}`);
                return;
            }
            
            let audioPayload;
            const targetFormat = callConfig.format || this.RTP_SEND_FORMAT;
            
            if (targetFormat === 'slin') {
                audioPayload = await AudioUtils.convertUlawToPcm(ulawBuffer);
                if (!audioPayload || audioPayload.length === 0) {
                    throw new Error('uLaw to PCM conversion failed');
                }
            } else if (targetFormat === 'ulaw') {
                audioPayload = ulawBuffer;
            } else {
                logger.warn(`[RTP Sender] Unsupported format '${targetFormat}' for ${callId}, using uLaw`);
                audioPayload = ulawBuffer;
            }

            // Add to buffer instead of sending immediately
            let existingBuffer = this.audioBuffers.get(callId) || Buffer.alloc(0);
            existingBuffer = Buffer.concat([existingBuffer, audioPayload]);
            this.audioBuffers.set(callId, existingBuffer);

            // Log buffer status more frequently for debugging
            if (this.audioChunkCount[callId] <= 10 || this.audioChunkCount[callId] % 20 === 0) {
                logger.info(`[RTP Sender] Buffer status for ${callId}: ${existingBuffer.length} bytes buffered (chunk: ${audioPayload.length} bytes, need: ${this.SAMPLES_PER_FRAME} bytes for frame)`);
            }

            this.updateStats(callId, 'audio_sent', { bytes: audioPayload.length });
            
        } catch (err) {
            logger.error(`[RTP Sender] Error processing audio for ${callId}: ${err.message}`, err);
            this.updateStats(callId, 'error');
        }
    }

    /**
     * Enhanced RTP packet creation with better validation
     */
    createRtpPacket(callId, audioData, callConfig, frameTimestamp) {
        let sequenceNumber = this.sequenceNumbers.get(callId);
        const ssrc = this.ssrcs.get(callId);

        // Validate all parameters
        if (typeof sequenceNumber !== 'number' || isNaN(sequenceNumber)) {
            logger.error(`[RTP Sender] Invalid sequence number for ${callId}: ${sequenceNumber}`);
            return null;
        }
        
        if (typeof frameTimestamp !== 'number' || isNaN(frameTimestamp)) {
            logger.error(`[RTP Sender] Invalid timestamp for ${callId}: ${frameTimestamp}`);
            return null;
        }
        
        if (typeof ssrc !== 'number' || isNaN(ssrc)) {
            logger.error(`[RTP Sender] Invalid SSRC for ${callId}: ${ssrc}`);
            return null;
        }

        // Ensure values are in valid ranges
        sequenceNumber = sequenceNumber & 0xFFFF;
        const timestamp = frameTimestamp >>> 0;
        const validSsrc = ssrc >>> 0;

        try {
            const header = Buffer.alloc(12);
            
            header[0] = (this.RTP_VERSION << 6);
            
            const payloadType = callConfig.format === 'slin' ? this.RTP_PAYLOAD_TYPE_SLIN16_8K : this.RTP_PAYLOAD_TYPE_ULAW;
            header[1] = payloadType;
            
            header.writeUInt16BE(sequenceNumber, 2);
            header.writeUInt32BE(timestamp, 4);
            header.writeUInt32BE(validSsrc, 8);

            // Update sequence number for next packet
            this.sequenceNumbers.set(callId, (sequenceNumber + 1) & 0xFFFF);

            return Buffer.concat([header, audioData]);
            
        } catch (err) {
            logger.error(`[RTP Sender] Error creating RTP packet for ${callId}: ${err.message}`);
            return null;
        }
    }

    /**
     * Synchronous packet send
     */
    sendRtpPacketSync(socket, rtpPacket, host, port, callId) {
        // ADD THIS DEBUG LOG
        if (!this.packetsSentCount) this.packetsSentCount = {};
        if (!this.packetsSentCount[callId]) this.packetsSentCount[callId] = 0;
        this.packetsSentCount[callId]++;
        
        if (this.packetsSentCount[callId] <= 10 || this.packetsSentCount[callId] % 100 === 0) {
            const seq = rtpPacket.readUInt16BE(2);
            const ts = rtpPacket.readUInt32BE(4);
            logger.info(`[RTP Sender] Sending RTP packet #${this.packetsSentCount[callId]} to ${host}:${port} for ${callId} (seq: ${seq}, ts: ${ts}, size: ${rtpPacket.length})`);
        }
        
        socket.send(rtpPacket, 0, rtpPacket.length, port, host, (err) => {
            if (err) {
                logger.error(`[RTP Sender] UDP send error to ${host}:${port} for ${callId}: ${err.message}`);
                this.updateStats(callId, 'error');
                this.globalStats.totalErrors++;
            } else {
                this.updateStats(callId, 'packet_sent', { bytes: rtpPacket.length });
                this.globalStats.totalPacketsSent++;
            }
        });
    }

    /**
     * Update statistics for a call
     */
    updateStats(callId, event, data = {}) {
        const stats = this.stats.get(callId);
        if (!stats) return;

        stats.lastActivity = Date.now();
        
        switch (event) {
            case 'packet_sent':
                stats.packetsSent++;
                stats.bytesSent += data.bytes || 0;
                break;
            case 'error':
                stats.errors++;
                break;
            case 'audio_sent':
                stats.lastAudioSize = data.bytes || 0;
                break;
            case 'frames_sent':
                stats.framesSent = (stats.framesSent || 0) + (data.count || 0);
                break;
        }
    }

    /**
     * Enhanced cleanup with better error handling
     */
    cleanupCall(callId) {
        logger.info(`[RTP Sender] Cleaning up call ${callId}`);
        
        // Stop packet timer
        if (this.packetTimers.has(callId)) {
            clearInterval(this.packetTimers.get(callId));
            this.packetTimers.delete(callId);
        }

        // Clear audio buffer
        this.audioBuffers.delete(callId);
        this.continuousTimestamps.delete(callId);
        
        const socket = this.udpSockets.get(callId);
        if (socket) {
            try {
                socket.removeAllListeners();
                socket.close(() => {
                    logger.debug(`[RTP Sender] Socket closed for ${callId}`);
                });
            } catch (err) {
                logger.warn(`[RTP Sender] Error closing socket for ${callId}: ${err.message}`);
            }
            this.udpSockets.delete(callId);
        }

        // Clean up all tracking data
        this.activeCalls.delete(callId);
        this.sequenceNumbers.delete(callId);
        this.timestamps.delete(callId);
        this.ssrcs.delete(callId);
        this.stats.delete(callId);
        
        // Clean up debugging data
        if (this.audioChunkCount) delete this.audioChunkCount[callId];
        if (this.packetsSentCount) delete this.packetsSentCount[callId];
        
        this.globalStats.activeCalls = Math.max(0, this.globalStats.activeCalls - 1);
        
        logger.info(`[RTP Sender] Cleanup completed for ${callId}`);
    }

    /**
     * Enhanced cleanup all with proper shutdown
     */
    cleanupAll() {
        logger.info(`[RTP Sender] Cleaning up all calls (${this.activeCalls.size} active)`);
        this.isShuttingDown = true;
        
        const callIds = [...this.activeCalls.keys()];
        const cleanupPromises = callIds.map(callId => {
            return new Promise(resolve => {
                try {
                    this.cleanupCall(callId);
                    resolve();
                } catch (err) {
                    logger.error(`[RTP Sender] Error cleaning up ${callId}: ${err.message}`);
                    resolve(); // Continue cleanup even if one fails
                }
            });
        });
        
        Promise.allSettled(cleanupPromises).then(() => {
            this.globalStats.activeCalls = 0;
            logger.info('[RTP Sender] All calls cleaned up');
        });
    }

    /**
     * Enhanced status with detailed information
     */
    getStatus() {
        const callDetails = [];
        for (const [callId, config] of this.activeCalls.entries()) {
            const stats = this.stats.get(callId) || {};
            const bufferSize = this.audioBuffers.get(callId)?.length || 0;
            callDetails.push({
                callId,
                rtpHost: config.rtpHost,
                rtpPort: config.rtpPort,
                format: config.format,
                ssrc: this.ssrcs.get(callId),
                initialized: config.initialized,
                currentSequenceNumber: this.sequenceNumbers.get(callId),
                currentTimestamp: this.timestamps.get(callId),
                continuousTimestamp: this.continuousTimestamps.get(callId),
                bufferSize,
                stats: {
                    packetsSent: stats.packetsSent || 0,
                    bytesSent: stats.bytesSent || 0,
                    errors: stats.errors || 0,
                    lastActivity: stats.lastActivity
                }
            });
        }
        
        return {
            activeCallsCount: this.activeCalls.size,
            globalStats: {
                ...this.globalStats,
                uptime: Date.now() - this.globalStats.startTime
            },
            calls: callDetails,
            isShuttingDown: this.isShuttingDown
        };
    }

    /**
     * Health check
     */
    healthCheck() {
        const status = this.getStatus();
        const isHealthy = !this.isShuttingDown && status.globalStats.totalErrors < 100;
        
        return {
            healthy: isHealthy,
            status: isHealthy ? 'running' : (this.isShuttingDown ? 'shutting_down' : 'degraded'),
            ...status
        };
    }
}

// Create singleton instance
const rtpSenderService = new RtpSenderService();

// Graceful shutdown handling
function gracefulShutdown(signal) {
    logger.info(`[RTP Sender] Received ${signal}, initiating graceful shutdown`);
    rtpSenderService.cleanupAll();
    setTimeout(() => {
        process.exit(0);
    }, 2000); // Give 2 seconds for cleanup
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = rtpSenderService;