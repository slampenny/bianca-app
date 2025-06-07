// src/services/rtp.sender.service.js - Key compatibility fixes needed

const dgram = require('dgram');
const { Buffer } = require('buffer');
const logger = require('../config/logger');
const AudioUtils = require('../api/audio.utils');

/**
 * RTP Sender Service - Enhanced version with better error handling and monitoring
 */
class RtpSenderService {
    constructor() {
        this.activeCalls = new Map(); // callId -> call config
        this.udpSockets = new Map(); // callId -> UDP socket
        this.sequenceNumbers = new Map(); // callId -> current sequence number
        this.timestamps = new Map(); // callId -> current timestamp
        this.ssrcs = new Map(); // callId -> SSRC
        this.stats = new Map(); // callId -> statistics
        
        // RTP Constants
        this.RTP_VERSION = 2;
        this.RTP_PAYLOAD_TYPE_ULAW = 0;
        this.RTP_PAYLOAD_TYPE_SLIN16_8K = 11;
        this.RTP_SEND_FORMAT = 'ulaw';
        this.SAMPLE_RATE = 8000;
        this.FRAME_SIZE_MS = 20;
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
        
        logger.info('[RTP Sender] Service initialized with enhanced monitoring');
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
            this.ssrcs.set(callId, ssrc);
            this.stats.set(callId, {
                packetsSent: 0,
                bytesSent: 0,
                errors: 0,
                lastActivity: Date.now()
            });

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

            this.globalStats.totalCalls++;
            this.globalStats.activeCalls++;

            logger.info(`[RTP Sender] Call ${callId} initialized successfully. SSRC: ${ssrc}, Target: ${config.rtpHost}:${config.rtpPort}`);
            
        } catch (err) {
            logger.error(`[RTP Sender] Failed to initialize call ${callId}: ${err.message}`, err);
            this.cleanupCall(callId);
            throw err;
        }
    }

    /**
     * Enhanced audio sending with better error handling and validation
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
            return;
        }

        const socket = this.udpSockets.get(callId);
        if (!socket) {
            logger.error(`[RTP Sender] No UDP socket found for call ${callId}`);
            return;
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

            await this.sendAudioFrames(callId, audioPayload, socket, callConfig);
            this.updateStats(callId, 'audio_sent', { bytes: audioPayload.length });
            
        } catch (err) {
            logger.error(`[RTP Sender] Error processing audio for ${callId}: ${err.message}`, err);
            this.updateStats(callId, 'error');
        }
    }

    /**
     * Enhanced frame sending with better timestamp management
     */
    async sendAudioFrames(callId, audioBuffer, socket, callConfig) {
        const bytesPerSample = callConfig.format === 'slin' ? 2 : 1;
        const bytesPerFrame = this.SAMPLES_PER_FRAME * bytesPerSample;
        
        let offset = 0;
        const promises = [];
        let framesSent = 0;

        let currentTimestamp = this.timestamps.get(callId);
        
        // Validate timestamp
        if (typeof currentTimestamp !== 'number' || isNaN(currentTimestamp) || currentTimestamp < 0) {
            logger.warn(`[RTP Sender] Invalid timestamp for ${callId}, reinitializing`);
            currentTimestamp = Math.floor(Math.random() * 0xFFFFFFFF);
            this.timestamps.set(callId, currentTimestamp);
        }

        while (offset < audioBuffer.length && !this.isShuttingDown) {
            const frameSize = Math.min(bytesPerFrame, audioBuffer.length - offset);
            const frameData = audioBuffer.slice(offset, offset + frameSize);
            
            if (frameData.length > 0) {
                try {
                    const rtpPacket = this.createRtpPacket(callId, frameData, callConfig, currentTimestamp);
                    if (rtpPacket) {
                        promises.push(this.sendRtpPacket(socket, rtpPacket, callConfig.rtpHost, callConfig.rtpPort, callId));
                        framesSent++;
                        
                        // Update timestamp for next frame
                        currentTimestamp = (currentTimestamp + this.SAMPLES_PER_FRAME) >>> 0;
                    }
                } catch (frameErr) {
                    logger.error(`[RTP Sender] Error creating frame for ${callId}: ${frameErr.message}`);
                    this.updateStats(callId, 'error');
                }
            }
            offset += frameSize;
        }

        // Update stored timestamp for next batch
        if (framesSent > 0) {
            this.timestamps.set(callId, currentTimestamp);
        }
        
        if (promises.length > 0) {
            try {
                await Promise.allSettled(promises);
                this.updateStats(callId, 'frames_sent', { count: framesSent });
            } catch (err) {
                logger.error(`[RTP Sender] Error sending frames for ${callId}: ${err.message}`);
                this.updateStats(callId, 'error');
            }
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
     * Enhanced packet sending with better error handling
     */
    async sendRtpPacket(socket, rtpPacket, host, port, callId) {
        return new Promise((resolve, reject) => {
            if (this.isShuttingDown) {
                resolve(); // Don't send if shutting down
                return;
            }

            const startTime = Date.now();
            
            socket.send(rtpPacket, 0, rtpPacket.length, port, host, (err, bytes) => {
                const duration = Date.now() - startTime;
                
                if (err) {
                    logger.error(`[RTP Sender] UDP send error to ${host}:${port} for ${callId}: ${err.message}`);
                    this.updateStats(callId, 'error');
                    reject(err);
                } else {
                    if (duration > 100) { // Log slow sends
                        logger.warn(`[RTP Sender] Slow UDP send to ${host}:${port} for ${callId}: ${duration}ms`);
                    }
                    
                    this.updateStats(callId, 'packet_sent', { bytes });
                    this.globalStats.totalPacketsSent++;
                    resolve();
                }
            });
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
            callDetails.push({
                callId,
                rtpHost: config.rtpHost,
                rtpPort: config.rtpPort,
                format: config.format,
                ssrc: this.ssrcs.get(callId),
                initialized: config.initialized,
                currentSequenceNumber: this.sequenceNumbers.get(callId),
                nextTimestamp: this.timestamps.get(callId),
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