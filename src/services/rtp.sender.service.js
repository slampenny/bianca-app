// src/services/rtp.sender.service.js - FIXED VERSION

const dgram = require('dgram');
const { Buffer } = require('buffer');
const logger = require('../config/logger');
const AudioUtils = require('../api/audio.utils');
const EventEmitter = require('events');

/**
 * RTP Sender Service - FIXED VERSION
 * Main issues fixed:
 * 1. Audio was being sent immediately instead of using the packet timer
 * 2. Packet timer was never started
 * 3. Buffering mechanism wasn't working properly
 * 4. No proper audio chunking for consistent timing
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
        
        // Audio buffering and timing
        this.audioBuffers = new Map(); // callId -> buffered audio
        this.packetTimers = new Map(); // callId -> interval timer
        
        // RTP Constants
        this.RTP_VERSION = 2;
        this.RTP_PAYLOAD_TYPE_ULAW = 0;
        this.RTP_PAYLOAD_TYPE_SLIN16_8K = 11;
        this.RTP_SEND_FORMAT = 'ulaw';
        this.SAMPLE_RATE = 8000;
        this.FRAME_SIZE_MS = 20; // Keep at 20ms for standard RTP timing
        this.SAMPLES_PER_FRAME = 160; // 8000 * 0.02 = 160 samples for uLaw
        this.PACKET_INTERVAL_MS = 20; // Keep at 20ms - this is correct
        
        // CRITICAL FIX: Reduce audio buffer sizes for lower latency
        this.MAX_BUFFER_SIZE_BYTES = 1600; // Max 100ms of audio (160 * 10 frames)
        this.TARGET_BUFFER_SIZE_BYTES = 480; // Target 30ms of audio (160 * 3 frames)
        
        // Enhanced error tracking
        this.isShuttingDown = false;
        this.globalStats = {
            totalCalls: 0,
            activeCalls: 0,
            totalPacketsSent: 0,
            totalErrors: 0,
            startTime: Date.now()
        };
        
        // Debug counters
        this.debugCounters = new Map(); // callId -> { audioChunks, packetsSent }
        
        logger.info('[RTP Sender] Service initialized with fixed timing and buffering');
    }

    /**
     * Initialize call and START the packet timer immediately
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
                audioChunksReceived: 0,
                lastActivity: Date.now()
            });

            // Initialize audio buffer and debug counters
            this.audioBuffers.set(callId, Buffer.alloc(0));
            this.debugCounters.set(callId, { audioChunks: 0, packetsSent: 0 });

            // Create socket with enhanced error handling
            const socket = dgram.createSocket('udp4');
            this.udpSockets.set(callId, socket);

            socket.on('error', (err) => {
                logger.error(`[RTP Sender] Socket error for ${callId}: ${err.message}`, err);
                this.updateStats(callId, 'error');
                this.globalStats.totalErrors++;
                this.emit('socket_error', { callId, error: err });
            });

            socket.on('close', () => {
                logger.info(`[RTP Sender] Socket closed for ${callId}`);
            });

            // CRITICAL FIX: Start the packet timer immediately
            this.startPacketSender(callId);

            this.globalStats.totalCalls++;
            this.globalStats.activeCalls++;

            logger.info(`[RTP Sender] Call ${callId} initialized successfully. SSRC: ${ssrc}, Target: ${config.rtpHost}:${config.rtpPort}, Timer started`);
            
        } catch (err) {
            logger.error(`[RTP Sender] Failed to initialize call ${callId}: ${err.message}`, err);
            this.cleanupCall(callId);
            throw err;
        }
    }

    /**
     * Start packet sender timer - FIXED to actually send packets
     */
    startPacketSender(callId) {
        // Clear any existing timer
        if (this.packetTimers.has(callId)) {
            clearInterval(this.packetTimers.get(callId));
        }

        // Create new timer for this call with consistent timing
        const timer = setInterval(() => {
            this.sendNextFrame(callId);
        }, this.PACKET_INTERVAL_MS);

        this.packetTimers.set(callId, timer);
        logger.info(`[RTP Sender] Started packet sender timer for ${callId} (${this.PACKET_INTERVAL_MS}ms intervals)`);
    }

    /**
     * Send the next frame - FIXED to properly handle buffered audio
     */
    sendNextFrame(callId) {
        const buffer = this.audioBuffers.get(callId);
        const callConfig = this.activeCalls.get(callId);
        const socket = this.udpSockets.get(callId);
        
        if (!callConfig || !socket || !callConfig.initialized || this.isShuttingDown) {
            return;
        }

        // CRITICAL: Check if we have enough data for a frame
        if (!buffer || buffer.length < this.SAMPLES_PER_FRAME) {
            // Not enough data - but don't wait too long
            // If buffer is getting old, send what we have
            const bufferAge = Date.now() - (callConfig.lastAudioReceived || 0);
            if (buffer && buffer.length > 0 && bufferAge > 40) { // 40ms max buffer age
                // Send partial frame padded with silence
                const frameData = Buffer.alloc(this.SAMPLES_PER_FRAME, 0x7F); // uLaw silence
                buffer.copy(frameData, 0, 0, Math.min(buffer.length, this.SAMPLES_PER_FRAME));
                
                // Clear the buffer
                this.audioBuffers.set(callId, Buffer.alloc(0));
                
                this.sendFrameData(callId, frameData, callConfig, socket);
            }
            return;
        }

        // Extract one frame worth of data
        const frameData = buffer.slice(0, this.SAMPLES_PER_FRAME);
        
        // Update buffer to remove sent data
        const remaining = buffer.slice(this.SAMPLES_PER_FRAME);
        this.audioBuffers.set(callId, remaining);

        this.sendFrameData(callId, frameData, callConfig, socket);
    }

    sendFrameData(callId, frameData, callConfig, socket) {
        try {
            const timestamp = this.timestamps.get(callId);
            const rtpPacket = this.createRtpPacket(callId, frameData, callConfig, timestamp);
            
            if (rtpPacket) {
                this.sendRtpPacketSync(socket, rtpPacket, callConfig.rtpHost, callConfig.rtpPort, callId);
                
                // Update timestamp for next packet
                const nextTimestamp = (timestamp + this.SAMPLES_PER_FRAME) >>> 0;
                this.timestamps.set(callId, nextTimestamp);
                
                // Update debug counter
                const debug = this.debugCounters.get(callId);
                if (debug) {
                    debug.packetsSent++;
                    if (debug.packetsSent <= 10 || debug.packetsSent % 100 === 0) {
                        const remaining = this.audioBuffers.get(callId)?.length || 0;
                        logger.info(`[RTP Sender] Sent packet #${debug.packetsSent} for ${callId} (buffer: ${remaining} bytes remaining)`);
                    }
                }
            }
        } catch (err) {
            logger.error(`[RTP Sender] Error sending frame for ${callId}: ${err.message}`);
            this.updateStats(callId, 'error');
        }
    }


    /**
     * FIXED: Buffer audio instead of sending immediately
     */
    async sendAudio(callId, audioBase64Ulaw) {
        if (this.isShuttingDown || !audioBase64Ulaw || audioBase64Ulaw.length === 0) {
            return;
        }

        const callConfig = this.activeCalls.get(callId);
        if (!callConfig || !callConfig.initialized) {
            logger.warn(`[RTP Sender] Call ${callId} not initialized`);
            return;
        }

        try {
            const ulawBuffer = Buffer.from(audioBase64Ulaw, 'base64');
            if (ulawBuffer.length === 0) {
                return;
            }
            
            // Track when audio was received
            callConfig.lastAudioReceived = Date.now();
            
            let audioPayload;
            const targetFormat = callConfig.format || this.RTP_SEND_FORMAT;
            
            if (targetFormat === 'slin') {
                audioPayload = await AudioUtils.convertUlawToPcm(ulawBuffer);
            } else {
                audioPayload = ulawBuffer;
            }

            // CRITICAL: Smart buffer management to prevent latency buildup
            const currentBuffer = this.audioBuffers.get(callId) || Buffer.alloc(0);
            
            // If buffer is getting too large, drop oldest data to prevent latency
            let bufferToUse = currentBuffer;
            if (currentBuffer.length > this.MAX_BUFFER_SIZE_BYTES) {
                logger.warn(`[RTP Sender] Buffer overflow for ${callId}, dropping ${currentBuffer.length - this.TARGET_BUFFER_SIZE_BYTES} bytes`);
                bufferToUse = currentBuffer.slice(currentBuffer.length - this.TARGET_BUFFER_SIZE_BYTES);
            }
            
            const newBuffer = Buffer.concat([bufferToUse, audioPayload]);
            this.audioBuffers.set(callId, newBuffer);

            // Update debug counter
            const debug = this.debugCounters.get(callId);
            if (debug) {
                debug.audioChunks++;
                if (debug.audioChunks % 200 === 0) { // Reduced logging frequency
                    logger.info(`[RTP Sender] Buffered ${audioPayload.length} bytes for ${callId}. Total buffer: ${newBuffer.length} bytes`);
                }
            }

            this.updateStats(callId, 'audio_received', { bytes: audioPayload.length });
            
        } catch (err) {
            logger.error(`[RTP Sender] Error processing audio for ${callId}: ${err.message}`);
            this.updateStats(callId, 'error');
        }
    }

    /**
     * Create RTP packet - same as before but with better logging
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
     * Send RTP packet with better logging
     */
    sendRtpPacketSync(socket, rtpPacket, host, port, callId) {
        const debug = this.debugCounters.get(callId);
        
        // Enhanced logging for first few packets
        if (debug && (debug.packetsSent < 5 || debug.packetsSent % 100 === 0)) {
            const seq = rtpPacket.readUInt16BE(2);
            const ts = rtpPacket.readUInt32BE(4);
            const ssrc = rtpPacket.readUInt32BE(8);
            logger.info(`[RTP Sender] Sending RTP packet #${debug.packetsSent + 1} to ${host}:${port} for ${callId} (seq: ${seq}, ts: ${ts}, ssrc: ${ssrc}, size: ${rtpPacket.length})`);
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
     * Update statistics
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
            case 'audio_received':
                stats.audioChunksReceived++;
                stats.lastAudioSize = data.bytes || 0;
                break;
        }
    }

    /**
     * Enhanced cleanup with timer stopping
     */
    cleanupCall(callId) {
        logger.info(`[RTP Sender] Cleaning up call ${callId}`);
        
        // CRITICAL: Stop packet timer
        if (this.packetTimers.has(callId)) {
            clearInterval(this.packetTimers.get(callId));
            this.packetTimers.delete(callId);
            logger.info(`[RTP Sender] Stopped packet timer for ${callId}`);
        }

        // Clear audio buffer
        this.audioBuffers.delete(callId);
        this.debugCounters.delete(callId);
        
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
     * Enhanced cleanup all
     */
    cleanupAll() {
        logger.info(`[RTP Sender] Cleaning up all calls (${this.activeCalls.size} active)`);
        this.isShuttingDown = true;
        
        const callIds = [...this.activeCalls.keys()];
        callIds.forEach(callId => {
            try {
                this.cleanupCall(callId);
            } catch (err) {
                logger.error(`[RTP Sender] Error cleaning up ${callId}: ${err.message}`);
            }
        });
        
        this.globalStats.activeCalls = 0;
        logger.info('[RTP Sender] All calls cleaned up');
    }

    /**
     * Enhanced status with buffer information
     */
    getStatus() {
        const callDetails = [];
        for (const [callId, config] of this.activeCalls.entries()) {
            const stats = this.stats.get(callId) || {};
            const bufferSize = this.audioBuffers.get(callId)?.length || 0;
            const debug = this.debugCounters.get(callId) || {};
            const hasTimer = this.packetTimers.has(callId);
            
            callDetails.push({
                callId,
                rtpHost: config.rtpHost,
                rtpPort: config.rtpPort,
                format: config.format,
                ssrc: this.ssrcs.get(callId),
                initialized: config.initialized,
                hasTimer,
                currentSequenceNumber: this.sequenceNumbers.get(callId),
                currentTimestamp: this.timestamps.get(callId),
                bufferSize,
                debugCounters: debug,
                stats: {
                    packetsSent: stats.packetsSent || 0,
                    bytesSent: stats.bytesSent || 0,
                    errors: stats.errors || 0,
                    audioChunksReceived: stats.audioChunksReceived || 0,
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