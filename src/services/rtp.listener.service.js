// src/services/rtp.listener.service.js

const dgram = require('dgram');
const { Buffer } = require('buffer');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
const channelTracker = require('./channel.tracker');
const AudioUtils = require('../api/audio.utils');
const config = require('../config/config');

// Configuration constants
const RTP_LISTEN_HOST = '0.0.0.0';
const RTP_LISTEN_PORT = config.asterisk.rtpBiancaReceivePort || config.asterisk.rtpBiancaPort;
const RTP_HEADER_MIN_LENGTH = 12;
const MAX_PACKET_SIZE = 65507; // Maximum UDP packet size
const STATS_LOG_INTERVAL = 10000; // Log stats every 10 seconds

// Global state
let udpServer = null;
let isShuttingDown = false;
const ssrcToCallIdMap = new Map();
const packetStats = {
    totalPackets: 0,
    validRtpPackets: 0,
    invalidPackets: 0,
    packetsWithUnknownSsrc: 0,
    packetsSent: 0,
    audioProcessingErrors: 0,
    lastStatsLog: Date.now()
};

/**
 * Enhanced RTP packet parser with better validation
 */
function parseRtpPacket(rtpPacketBuffer) {
    if (!rtpPacketBuffer || rtpPacketBuffer.length < RTP_HEADER_MIN_LENGTH) {
        return null;
    }

    try {
        const version = (rtpPacketBuffer[0] >> 6) & 0x03;
        if (version !== 2) {
            return null; // Only RTP v2 supported
        }

        const padding = (rtpPacketBuffer[0] >> 5) & 0x01;
        const extension = (rtpPacketBuffer[0] >> 4) & 0x01;
        const csrcCount = rtpPacketBuffer[0] & 0x0F;
        
        const marker = (rtpPacketBuffer[1] >> 7) & 0x01;
        const payloadType = rtpPacketBuffer[1] & 0x7F;
        
        const sequenceNumber = rtpPacketBuffer.readUInt16BE(2);
        const timestamp = rtpPacketBuffer.readUInt32BE(4);
        const ssrc = rtpPacketBuffer.readUInt32BE(8);

        // Calculate header length
        let headerLength = 12 + (csrcCount * 4);
        
        // Account for extension
        if (extension && rtpPacketBuffer.length >= headerLength + 4) {
            const extensionLength = rtpPacketBuffer.readUInt16BE(headerLength + 2) * 4;
            headerLength += 4 + extensionLength;
        }

        if (rtpPacketBuffer.length < headerLength) {
            return null;
        }

        let payload = rtpPacketBuffer.slice(headerLength);

        // Handle padding
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
        logger.debug(`[RTP Listener] Error parsing RTP packet: ${err.message}`);
        return null;
    }
}

/**
 * Enhanced call finder with better error handling
 */
function findCallAwaitingSsrc() {
    try {
        for (const [asteriskId, callData] of channelTracker.calls.entries()) {
            if (callData.awaitingSsrcForRtp === true && !callData.rtp_ssrc) {
                logger.info(`[RTP Listener] Found call ${asteriskId} awaiting SSRC (TwilioSID: ${callData.twilioCallSid})`);
                return {
                    callId: callData.twilioCallSid || asteriskId,
                    asteriskId: asteriskId
                };
            }
        }
        return null;
    } catch (err) {
        logger.error(`[RTP Listener] Error finding call awaiting SSRC: ${err.message}`);
        return null;
    }
}

/**
 * Add SSRC mapping with validation
 */
function addSsrcMapping(ssrc, callId) {
    if (!ssrc || !callId) {
        logger.warn(`[RTP Listener] Invalid SSRC mapping attempt: ssrc=${ssrc}, callId=${callId}`);
        return false;
    }
    
    if (ssrcToCallIdMap.has(ssrc)) {
        const existingCallId = ssrcToCallIdMap.get(ssrc);
        if (existingCallId !== callId) {
            logger.warn(`[RTP Listener] SSRC ${ssrc} already mapped to ${existingCallId}, overwriting with ${callId}`);
        }
    }
    
    ssrcToCallIdMap.set(ssrc, callId);
    logger.info(`[RTP Listener] Mapped SSRC ${ssrc} to callId ${callId}`);
    return true;
}

/**
 * Enhanced call data retrieval
 */
function getCallDataByPrimaryId(callId) {
    if (!callId) return null;
    
    try {
        // Check if callId itself is an Asterisk ID first
        let callData = channelTracker.getCall(callId);
        if (callData) return callData;

        // If not found, iterate to find by Twilio SID
        for (const data of channelTracker.calls.values()) {
            if (data.twilioCallSid === callId) {
                return data;
            }
        }
        return null;
    } catch (err) {
        logger.error(`[RTP Listener] Error getting call data for ${callId}: ${err.message}`);
        return null;
    }
}

/**
 * Process audio payload with enhanced error handling
 */
async function processAudioPayload(callId, payload, ssrc) {
    try {
        // Convert payload to base64 for transmission
        // Note: Assuming payload is already in the correct format from Asterisk
        const audioBase64 = payload.toString('base64');

        if (audioBase64 && audioBase64.length > 0) {
            logger.debug(`[RTP Listener] Forwarding ${audioBase64.length} base64 bytes for call ${callId} (SSRC: ${ssrc})`);
            
            // Send to OpenAI service
            await openAIService.sendAudioChunk(callId, audioBase64);
            packetStats.packetsSent++;
        } else {
            logger.warn(`[RTP Listener] Empty audio data for call ${callId} (SSRC: ${ssrc})`);
        }
    } catch (err) {
        logger.error(`[RTP Listener] Error processing audio for call ${callId} (SSRC: ${ssrc}): ${err.message}`);
        packetStats.audioProcessingErrors++;
        throw err;
    }
}

/**
 * Log statistics periodically
 */
function logStats() {
    const now = Date.now();
    if (now - packetStats.lastStatsLog >= STATS_LOG_INTERVAL) {
        logger.info(`[RTP Listener] Stats - Total: ${packetStats.totalPackets}, Valid: ${packetStats.validRtpPackets}, Invalid: ${packetStats.invalidPackets}, Unknown SSRC: ${packetStats.packetsWithUnknownSsrc}, Sent: ${packetStats.packetsSent}, Errors: ${packetStats.audioProcessingErrors}, Active SSRCs: ${ssrcToCallIdMap.size}`);
        packetStats.lastStatsLog = now;
    }
}

/**
 * Enhanced UDP message handler
 */
async function handleUdpMessage(msg, rinfo) {
    if (isShuttingDown) return;

    packetStats.totalPackets++;
    
    // Log stats periodically
    logStats();

    const remoteAddr = `${rinfo.address}:${rinfo.port}`;
    
    // Validate packet size
    if (msg.length > MAX_PACKET_SIZE) {
        logger.warn(`[RTP Listener] Oversized packet from ${remoteAddr}: ${msg.length} bytes`);
        packetStats.invalidPackets++;
        return;
    }

    const rtpPacket = parseRtpPacket(msg);

    if (!rtpPacket) {
        packetStats.invalidPackets++;
        return;
    }

    packetStats.validRtpPackets++;
    const { payloadType, sequenceNumber, timestamp, ssrc, payload } = rtpPacket;

    let callId = ssrcToCallIdMap.get(ssrc);

    // SSRC to CallID Association Logic
    if (!callId) {
        const waitingCall = findCallAwaitingSsrc();
        if (waitingCall) {
            callId = waitingCall.callId;
            const asteriskId = waitingCall.asteriskId;
            
            if (addSsrcMapping(ssrc, callId)) {
                // Update tracker state
                try {
                    channelTracker.updateCall(asteriskId, {
                        state: 'external_media_streaming',
                        rtp_ssrc: ssrc,
                        awaitingSsrcForRtp: false
                    });
                    logger.info(`[RTP Listener] Associated SSRC ${ssrc} from ${remoteAddr} with callId: ${callId} (AsteriskID: ${asteriskId})`);
                } catch (err) {
                    logger.error(`[RTP Listener] Error updating tracker for ${asteriskId}: ${err.message}`);
                }
            }
        } else {
            packetStats.packetsWithUnknownSsrc++;
            // Only log this occasionally to avoid spam
            if (packetStats.packetsWithUnknownSsrc % 100 === 1) {
                logger.warn(`[RTP Listener] Received packet from ${remoteAddr} with unknown SSRC ${ssrc}. No call waiting for SSRC. (${packetStats.packetsWithUnknownSsrc} total unknown)`);
            }
            return;
        }
    }

    // Check if the associated call still exists
    const currentCallData = getCallDataByPrimaryId(callId);
    if (!currentCallData) {
        logger.warn(`[RTP Listener] Call ${callId} no longer tracked (SSRC: ${ssrc}). Cleaning up mapping.`);
        ssrcToCallIdMap.delete(ssrc);
        return;
    }

    // Process audio payload
    try {
        await processAudioPayload(callId, payload, ssrc);
    } catch (err) {
        // Error already logged in processAudioPayload
        return;
    }
}

/**
 * Enhanced RTP listener service startup
 */
function startRtpListenerService() {
    if (udpServer) {
        logger.warn('[RTP Listener] UDP Server already running.');
        return udpServer;
    }

    if (!RTP_LISTEN_PORT) {
        logger.error('[RTP Listener] RTP_LISTEN_PORT not configured');
        throw new Error('RTP_LISTEN_PORT not configured');
    }

    logger.info(`[RTP Listener] Starting UDP server on ${RTP_LISTEN_HOST}:${RTP_LISTEN_PORT}`);
    
    udpServer = dgram.createSocket('udp4');

    udpServer.on('listening', () => {
        const address = udpServer.address();
        logger.info(`[RTP Listener] UDP server listening on ${address.address}:${address.port}`);
        isShuttingDown = false;
    });

    udpServer.on('message', async (msg, rinfo) => {
        try {
            await handleUdpMessage(msg, rinfo);
        } catch (err) {
            logger.error(`[RTP Listener] Error handling UDP message: ${err.message}`);
        }
    });

    udpServer.on('error', (err) => {
        logger.error(`[RTP Listener] UDP server error: ${err.message}`, err);
        
        // Attempt to restart if not shutting down
        if (!isShuttingDown) {
            logger.info('[RTP Listener] Attempting to restart UDP server...');
            udpServer = null;
            setTimeout(() => {
                try {
                    startRtpListenerService();
                } catch (restartErr) {
                    logger.error(`[RTP Listener] Failed to restart UDP server: ${restartErr.message}`);
                }
            }, 5000);
        }
    });

    udpServer.on('close', () => {
        logger.info('[RTP Listener] UDP server closed.');
        udpServer = null;
        ssrcToCallIdMap.clear();
        
        // Reset stats
        Object.assign(packetStats, {
            totalPackets: 0,
            validRtpPackets: 0,
            invalidPackets: 0,
            packetsWithUnknownSsrc: 0,
            packetsSent: 0,
            audioProcessingErrors: 0,
            lastStatsLog: Date.now()
        });
    });

    try {
        udpServer.bind(RTP_LISTEN_PORT, RTP_LISTEN_HOST);
    } catch (bindErr) {
        logger.error(`[RTP Listener] Failed to bind UDP server: ${bindErr.message}`);
        udpServer = null;
        throw bindErr;
    }

    return udpServer;
}

/**
 * Enhanced shutdown with cleanup
 */
function stopRtpListenerService() {
    if (udpServer) {
        logger.info('[RTP Listener] Stopping UDP server...');
        isShuttingDown = true;
        
        try {
            udpServer.close(() => {
                logger.info('[RTP Listener] UDP server stopped gracefully');
            });
        } catch (err) {
            logger.error(`[RTP Listener] Error stopping UDP server: ${err.message}`);
        }
    } else {
        logger.info('[RTP Listener] UDP server already stopped.');
    }
}

/**
 * Remove SSRC mapping with validation
 */
function removeSsrcMapping(ssrc) {
    if (!ssrc) {
        logger.warn('[RTP Listener] Attempted to remove mapping for null/undefined SSRC');
        return false;
    }

    if (ssrcToCallIdMap.has(ssrc)) {
        const callId = ssrcToCallIdMap.get(ssrc);
        ssrcToCallIdMap.delete(ssrc);
        logger.info(`[RTP Listener] Removed SSRC mapping for ${ssrc} (was callId: ${callId})`);
        return true;
    } else {
        logger.debug(`[RTP Listener] Attempted to remove mapping for SSRC ${ssrc}, but it was not found.`);
        return false;
    }
}

/**
 * Enhanced ready check with validation and retry logic
 */
async function ensureReady() {
    if (!udpServer) {
        logger.warn('[RTP Listener] UDP server not running, starting it...');
        try {
            startRtpListenerService();
            // Give it more time to bind properly
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            logger.error(`[RTP Listener] Failed to start UDP server: ${err.message}`);
            return false;
        }
    }

    // Verify server is actually listening with retry logic
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
        try {
            if (udpServer && udpServer.address()) {
                const address = udpServer.address();
                logger.info(`[RTP Listener] UDP server verified listening on ${address.address}:${address.port}`);
                return true;
            }
        } catch (err) {
            logger.warn(`[RTP Listener] Address check failed (attempt ${retries + 1}): ${err.message}`);
        }
        
        retries++;
        if (retries < maxRetries) {
            logger.info(`[RTP Listener] Retrying address check in 200ms...`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    logger.error('[RTP Listener] UDP server not properly initialized after retries');
    return false;
}

/**
 * Get service statistics
 */
function getStats() {
    return {
        ...packetStats,
        activeSsrcMappings: ssrcToCallIdMap.size,
        serverRunning: !!udpServer,
        serverAddress: udpServer ? udpServer.address() : null,
        uptime: udpServer ? Date.now() - packetStats.lastStatsLog : 0
    };
}

/**
 * Health check for the service
 */
function healthCheck() {
    const stats = getStats();
    const isHealthy = stats.serverRunning && !isShuttingDown;
    
    return {
        healthy: isHealthy,
        status: isHealthy ? 'running' : 'stopped',
        ...stats
    };
}

/**
 * Clean up all SSRC mappings (useful for testing or emergency cleanup)
 */
function clearAllSsrcMappings() {
    const count = ssrcToCallIdMap.size;
    ssrcToCallIdMap.clear();
    logger.info(`[RTP Listener] Cleared ${count} SSRC mappings`);
    return count;
}

/**
 * Get all current SSRC mappings (for debugging)
 */
function getAllSsrcMappings() {
    return new Map(ssrcToCallIdMap);
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
    logger.info('[RTP Listener] Received SIGTERM, shutting down gracefully...');
    stopRtpListenerService();
});

process.on('SIGINT', () => {
    logger.info('[RTP Listener] Received SIGINT, shutting down gracefully...');
    stopRtpListenerService();
});

// Handle uncaught exceptions to prevent crashes
process.on('uncaughtException', (err) => {
    logger.error(`[RTP Listener] Uncaught exception: ${err.message}`, err);
    // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`[RTP Listener] Unhandled rejection at:`, promise, 'reason:', reason);
    // Don't exit, just log the error
});

module.exports = {
    startRtpListenerService,
    stopRtpListenerService,
    ensureReady,
    addSsrcMapping,
    removeSsrcMapping,
    getStats,
    healthCheck,
    clearAllSsrcMappings,
    getAllSsrcMappings,
    
    // For testing purposes
    _internal: {
        parseRtpPacket,
        handleUdpMessage,
        processAudioPayload,
        getCallDataByPrimaryId,
        findCallAwaitingSsrc
    }
};