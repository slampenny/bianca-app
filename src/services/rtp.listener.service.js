// src/services/rtp.listener.service.js
const dgram = require('dgram');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
const portManager = require('./port.manager.service');

const activeListeners = new Map(); // Maps port -> { socket, callId, ssrc }

function parseRtpPacket(rtpPacketBuffer) {
    if (!rtpPacketBuffer || rtpPacketBuffer.length < 12) return null;
    try {
        const version = (rtpPacketBuffer[0] >> 6) & 0x03;
        if (version !== 2) return null;
        const ssrc = rtpPacketBuffer.readUInt32BE(8);
        const payload = rtpPacketBuffer.slice(12);
        return { ssrc, payload };
    } catch (err) {
        return null;
    }
}

async function handleUdpMessage(msg, port) {
    const listener = activeListeners.get(port);
    if (!listener) {
        logger.warn(`[RTP Listener] Received packet on unmanaged port ${port}.`);
        return;
    }

    const rtpPacket = parseRtpPacket(msg);
    if (!rtpPacket) return;

    const { ssrc, payload } = rtpPacket;
    const { callId } = listener;

    // First packet for this call, store the SSRC
    if (!listener.ssrc) {
        listener.ssrc = ssrc;
        logger.info(`[RTP Listener] Associated SSRC ${ssrc} with call ${callId} on port ${port}`);
    }

    if (payload.length > 0) {
        const audioBase64 = payload.toString('base64');
        await openAIService.sendAudioChunk(callId, audioBase64);
    }
}

/**
 * Creates a dedicated RTP listener for a specific call.
 * @param {string} callId The primary ID for the call (e.g., Twilio Call SID)
 * @returns {Promise<{port: number}>} A promise that resolves with the port number.
 */
function createListenerForCall(callId) {
    return new Promise((resolve, reject) => {
        const port = portManager.acquirePort();
        if (!port) {
            return reject(new Error("No available ports for RTP listener."));
        }

        const socket = dgram.createSocket('udp4');

        socket.on('message', (msg) => {
            handleUdpMessage(msg, port).catch(err => {
                logger.error(`[RTP Listener] Error handling UDP message on port ${port}: ${err.message}`);
            });
        });

        socket.on('error', (err) => {
            logger.error(`[RTP Listener] Socket error on port ${port} for call ${callId}: ${err.message}`, err);
            stopListenerForCall(callId, port); // Clean up on error
        });

        socket.on('listening', () => {
            logger.info(`[RTP Listener] Started dedicated listener for call ${callId} on port ${port}`);
            activeListeners.set(port, { socket, callId, ssrc: null });
            resolve({ port });
        });

        socket.bind(port, '0.0.0.0');
    });
}

/**
 * Stops the dedicated listener for a call and releases the port.
 * @param {string} callId The primary ID for the call.
 * @param {number} port The UDP port used by the call.
 */
function stopListenerForCall(callId, port) {
    if (activeListeners.has(port)) {
        const { socket } = activeListeners.get(port);
        socket.close(() => {
            logger.info(`[RTP Listener] Stopped dedicated listener for call ${callId} on port ${port}`);
            portManager.releasePort(port);
            activeListeners.delete(port);
        });
    }
}

module.exports = {
    createListenerForCall,
    stopListenerForCall,
};