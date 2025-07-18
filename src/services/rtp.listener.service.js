// src/services/rtp.listener.service.js
const dgram = require('dgram');
const { Buffer } = require('buffer');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');

const RTP_HEADER_MIN_LENGTH = 12;
const MAX_PACKET_SIZE = 65507;
const STATS_LOG_INTERVAL = 10000;

class RtpListener {
    
    constructor(port, callId, asteriskChannelId) {
        this.port = port;
        this.callId = callId;
        this.asteriskChannelId = asteriskChannelId;
        this.udpServer = null;
        this.stats = {
            packetsReceived: 0,
            packetsSent: 0,
            invalidPackets: 0,
            errors: 0,
            startTime: Date.now(),
            lastStatsLog: Date.now()
        };
        this.isActive = false;
        this.isShuttingDown = false;
    }

    async start() {
        if (this.udpServer) {
            logger.warn(`[RTP Listener] Already running for call ${this.callId} on port ${this.port}`);
            return;
        }

        logger.info(`[RTP Listener] Starting for call ${this.callId} on port ${this.port}`);
        
        this.udpServer = dgram.createSocket('udp4');

        this.udpServer.on('message', async (msg, rinfo) => {
            if (this.isShuttingDown) return;
            
            try {
                await this.handleMessage(msg, rinfo);
            } catch (err) {
                logger.error(`[RTP Listener ${this.port}] Error handling message: ${err.message}`);
                this.stats.errors++;
            }
        });

        this.udpServer.on('error', (err) => {
            logger.error(`[RTP Listener ${this.port}] UDP error: ${err.message}`);
            this.stats.errors++;
            
            if (!this.isShuttingDown) {
                this.stop();
            }
        });

        this.udpServer.on('listening', () => {
            const address = this.udpServer.address();
            logger.info(`[RTP Listener ${this.port}] Listening on ${address.address}:${address.port} for call ${this.callId}`);
            this.isActive = true;
        });

        this.udpServer.on('close', () => {
            logger.info(`[RTP Listener ${this.port}] UDP server closed for call ${this.callId}`);
            this.isActive = false;
            this.udpServer = null;
        });

        return new Promise((resolve, reject) => {
            this.udpServer.bind(this.port, '0.0.0.0', (err) => {
                if (err) {
                    logger.error(`[RTP Listener ${this.port}] Failed to bind: ${err.message}`);
                    this.udpServer = null;
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async handleMessage(msg, rinfo) {
        this.stats.packetsReceived++;
        this.logStatsIfNeeded();
        
        if (msg.length > MAX_PACKET_SIZE) {
            logger.warn(`[RTP Listener ${this.port}] Oversized packet from ${rinfo.address}:${rinfo.port}: ${msg.length} bytes`);
            this.stats.invalidPackets++;
            return;
        }

        const rtpPacket = this.parseRtpPacket(msg);
        if (!rtpPacket) {
            this.stats.invalidPackets++;
            return;
        }

        // Process the audio payload
        try {
            const audioBase64 = rtpPacket.payload.toString('base64');
            
            if (audioBase64 && audioBase64.length > 0) {
                logger.debug(`[RTP Listener ${this.port}] Forwarding ${audioBase64.length} base64 bytes for call ${this.callId}`);
                await openAIService.sendAudioChunk(this.callId, audioBase64); // Let it buffer until OpenAI is ready
                this.stats.packetsSent++;
            } else {
                logger.warn(`[RTP Listener ${this.port}] Empty audio data for call ${this.callId}`);
            }
        } catch (err) {
            logger.error(`[RTP Listener ${this.port}] Error processing audio: ${err.message}`);
            this.stats.errors++;
        }
    }

    parseRtpPacket(buffer) {
        if (!buffer || buffer.length < RTP_HEADER_MIN_LENGTH) {
            return null;
        }

        try {
            const version = (buffer[0] >> 6) & 0x03;
            if (version !== 2) {
                return null;
            }

            const padding = (buffer[0] >> 5) & 0x01;
            const extension = (buffer[0] >> 4) & 0x01;
            const csrcCount = buffer[0] & 0x0F;
            
            const marker = (buffer[1] >> 7) & 0x01;
            const payloadType = buffer[1] & 0x7F;
            
            const sequenceNumber = buffer.readUInt16BE(2);
            const timestamp = buffer.readUInt32BE(4);
            const ssrc = buffer.readUInt32BE(8);

            let headerLength = 12 + (csrcCount * 4);
            
            if (extension && buffer.length >= headerLength + 4) {
                const extensionLength = buffer.readUInt16BE(headerLength + 2) * 4;
                headerLength += 4 + extensionLength;
            }

            if (buffer.length < headerLength) {
                return null;
            }

            let payload = buffer.slice(headerLength);

            if (padding && payload.length > 0) {
                const paddingLength = payload[payload.length - 1];
                if (paddingLength > 0 && paddingLength <= payload.length) {
                    payload = payload.slice(0, -paddingLength);
                }
            }

            if (payload.length === 0) {
                return null;
            }

            return {
                version,
                padding,
                extension,
                csrcCount,
                marker,
                payloadType,
                sequenceNumber,
                timestamp,
                ssrc,
                payload,
                headerLength
            };
        } catch (err) {
            logger.debug(`[RTP Listener ${this.port}] Error parsing RTP packet: ${err.message}`);
            return null;
        }
    }

    logStatsIfNeeded() {
        const now = Date.now();
        if (now - this.stats.lastStatsLog >= STATS_LOG_INTERVAL) {
            logger.info(`[RTP Listener ${this.port}] Stats for call ${this.callId} - Received: ${this.stats.packetsReceived}, Sent: ${this.stats.packetsSent}, Invalid: ${this.stats.invalidPackets}, Errors: ${this.stats.errors}`);
            this.stats.lastStatsLog = now;
        }
    }

    stop() {
        if (this.udpServer && !this.isShuttingDown) {
            logger.info(`[RTP Listener ${this.port}] Stopping for call ${this.callId}`);
            this.isShuttingDown = true;
            
            try {
                this.udpServer.close();
            } catch (err) {
                logger.error(`[RTP Listener ${this.port}] Error closing UDP server: ${err.message}`);
            }
        }
    }

    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            active: this.isActive,
            isListening: this.isActive && this.udpServer && !this.isShuttingDown,
            port: this.port,
            callId: this.callId
        };
    }
}

// Module-level registry of active listeners
const activeListeners = new Map();

async function startRtpListenerForCall(port, callId, asteriskChannelId) {
    if (!port || !callId) {
        throw new Error('Port and callId are required to start RTP listener');
    }

    // Check if listener already exists
    if (activeListeners.has(callId)) {
        logger.warn(`[RTP Listener] Listener already exists for call ${callId}`);
        return activeListeners.get(callId);
    }

    const listener = new RtpListener(port, callId, asteriskChannelId);
    
    try {
        await listener.start();
        activeListeners.set(callId, listener);
        logger.info(`[RTP Listener] Successfully started listener for call ${callId} on port ${port}`);
        return listener;
    } catch (err) {
        logger.error(`[RTP Listener] Failed to start listener for call ${callId}: ${err.message}`);
        throw err;
    }
}

function stopRtpListenerForCall(callId) {
    const listener = activeListeners.get(callId);
    if (listener) {
        listener.stop();
        activeListeners.delete(callId);
        logger.info(`[RTP Listener] Stopped and removed listener for call ${callId}`);
        return true;
    }
    return false;
}

function getListenerForCall(callId) {
    return activeListeners.get(callId);
}

function getAllActiveListeners() {
    const listeners = {};
    for (const [callId, listener] of activeListeners.entries()) {
        listeners[callId] = listener.getStats();
    }
    return listeners;
}

function getListeners() {
    const listeners = [];
    for (const [callId, listener] of activeListeners.entries()) {
        listeners.push({
            callId,
            port: listener.port,
            asteriskChannelId: listener.asteriskChannelId,
            isListening: listener.isActive && listener.udpServer && !listener.isShuttingDown,
            stats: listener.getStats()
        });
    }
    return listeners;
}

function stopAllListeners() {
    logger.info(`[RTP Listener] Stopping all ${activeListeners.size} active listeners`);
    for (const [callId, listener] of activeListeners.entries()) {
        listener.stop();
    }
    activeListeners.clear();
}

// Health check
function healthCheck() {
    const activeCount = activeListeners.size;
    const stats = getAllActiveListeners();
    
    return {
        healthy: true,
        activeListeners: activeCount,
        listeners: stats
    };
}

// Get listener status by port
function getListenerStatus(port) {
    for (const [callId, listener] of activeListeners.entries()) {
        if (listener.port === port) {
            return {
                found: true,
                callId,
                port: listener.port,
                active: listener.isActive,
                stats: listener.getStats()
            };
        }
    }
    return {
        found: false,
        port,
        message: `No RTP listener found on port ${port}`
    };
}

// Get full status with all listeners
function getFullStatus() {
    const listeners = [];
    for (const [callId, listener] of activeListeners.entries()) {
        const stats = listener.getStats();
        listeners.push({
            callId,
            port: listener.port,
            active: listener.isActive,
            packetsReceived: stats.packetsReceived,
            packetsSent: stats.packetsSent,
            invalidPackets: stats.invalidPackets,
            errors: stats.errors,
            uptime: stats.uptime,
            source: `${callId} (${listener.port})`
        });
    }
    
    return {
        totalListeners: activeListeners.size,
        listeners
    };
}

// Graceful shutdown
process.once('SIGTERM', () => {
    logger.info('[RTP Listener] Received SIGTERM, stopping all listeners...');
    stopAllListeners();
});

process.once('SIGINT', () => {
    logger.info('[RTP Listener] Received SIGINT, stopping all listeners...');
    stopAllListeners();
});

module.exports = {
    startRtpListenerForCall,
    stopRtpListenerForCall,
    getListenerForCall,
    getAllActiveListeners,
    getListeners,
    stopAllListeners,
    healthCheck,
    getListenerStatus,
    getFullStatus
};