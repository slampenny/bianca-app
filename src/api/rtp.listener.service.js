// src/services/rtp.listener.service.js

const dgram = require('dgram');
const { Buffer } = require('buffer');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service'); // Assumes refactored for callId
const channelTracker = require('./channel.tracker'); // Shared tracker instance
const AudioUtils = require('./audio.utils'); // For PCM -> uLaw conversion
const config = require('../config/config'); // Configuration file

const RTP_LISTEN_HOST = '0.0.0.0';
const RTP_LISTEN_PORT = config.asterisk.rtpListenerPort; // Ensure this matches ari.client.js

const RTP_HEADER_MIN_LENGTH = 12;

let udpServer = null;
// --- Map SSRC (from RTP Header) to callId (e.g., Twilio SID) ---
const ssrcToCallIdMap = new Map();

/**
 * Parses basic RTP header. Returns null if invalid.
 */
function parseRtpPacket(rtpPacketBuffer) {
    if (rtpPacketBuffer.length < RTP_HEADER_MIN_LENGTH) return null;
    const version = (rtpPacketBuffer[0] >> 6) & 0x03;
    if (version !== 2) return null; // Only RTP v2 supported

    // Basic parsing - ignores extensions, CSRC, padding for simplicity
    const payloadType = rtpPacketBuffer[1] & 0x7F;
    const sequenceNumber = rtpPacketBuffer.readUInt16BE(2);
    const timestamp = rtpPacketBuffer.readUInt32BE(4);
    const ssrc = rtpPacketBuffer.readUInt32BE(8); // Synchronization Source Identifier
    const payload = rtpPacketBuffer.slice(RTP_HEADER_MIN_LENGTH);

    if (payload.length === 0) return null; // Ignore packets with no payload

    return { payloadType, sequenceNumber, timestamp, ssrc, payload };
}

/**
 * Finds the first call in the tracker that is awaiting an SSRC association.
 * NOTE: Potential race condition if multiple calls start ExternalMedia almost simultaneously.
 */
function findCallAwaitingSsrc() {
    for (const [asteriskId, callData] of channelTracker.calls.entries()) {
        if (callData.state === 'external_media_active_awaiting_ssrc' && !callData.rtp_ssrc) {
            return {
                callId: callData.twilioCallSid || asteriskId,  // This is correct - Twilio SID preferred
                asteriskId: asteriskId  // Still need this to update the tracker
            };
        }
    }
    return null;
}

function addSsrcMapping(ssrc, callId) {
    if (!ssrc || !callId) {
        logger.warn(`[RTP Listener] Invalid SSRC mapping attempt: ssrc=${ssrc}, callId=${callId}`);
        return;
    }
    
    if (ssrcToCallIdMap.has(ssrc)) {
        logger.warn(`[RTP Listener] SSRC ${ssrc} already mapped to ${ssrcToCallIdMap.get(ssrc)}, overwriting with ${callId}`);
    }
    
    ssrcToCallIdMap.set(ssrc, callId);
    logger.info(`[RTP Listener] Manually mapped SSRC ${ssrc} to callId ${callId}`);
}

/**
 * Helper function to get call data by primary ID (Twilio SID or Asterisk ID)
 * Note: Implementing this directly in tracker might be cleaner.
 */
function getCallDataByPrimaryId(callId) {
    if (!callId) return null;
    // Check if callId itself is an Asterisk ID first
    let callData = channelTracker.getCall(callId);
    if (callData) return callData;

    // If not found, iterate to find by Twilio SID
    for (const data of channelTracker.calls.values()) {
        if (data.twilioCallSid === callId) {
            return data;
        }
    }
    return null; // Not found by either ID
}


function startRtpListenerService() {
    if (udpServer) {
        logger.warn('[RTP Listener] UDP Server already running.');
        return;
    }

    udpServer = dgram.createSocket('udp4');

    udpServer.on('listening', () => {
        const address = udpServer.address();
        logger.info(`[RTP Listener] UDP server listening on ${address.address}:${address.port}`);
    });

    udpServer.on('message', async (msg, rinfo) => { // Make handler async for AudioUtils
       // logger.info(`[RTP Listener] RAW PACKET RECEIVED from <span class="math-inline">\{rinfo\.address\}\:</span>{rinfo.port}, size: ${msg.length}`); // Crucial log
        
        const remoteAddr = `${rinfo.address}:${rinfo.port}`;
        const rtpPacket = parseRtpPacket(msg);

        if (!rtpPacket) {
            // logger.warn(`[RTP Listener] Invalid RTP packet received from ${remoteAddr}.`);
            return; // Invalid packet
        }

        const { payloadType, sequenceNumber, timestamp, ssrc, payload } = rtpPacket;

        let callId = ssrcToCallIdMap.get(ssrc);

        // --- SSRC to CallID Association Logic ---
        if (!callId) {
            const waitingCall = findCallAwaitingSsrc();
            if (waitingCall) {
                callId = waitingCall.callId;
                const asteriskId = waitingCall.asteriskId;
                ssrcToCallIdMap.set(ssrc, callId);
                // Update tracker state and store SSRC
                channelTracker.updateCall(asteriskId, {
                    state: 'external_media_streaming', // Update state
                    rtp_ssrc: ssrc // Store the learned SSRC
                });
                logger.info(`[RTP Listener] Mapped SSRC ${ssrc} from ${remoteAddr} to callId: ${callId} (AsteriskID: ${asteriskId})`);
            } else {
                logger.warn(`[RTP Listener] Received packet from ${remoteAddr} with unknown SSRC ${ssrc}. No call waiting for SSRC. Discarding.`);
                return; // Discard packet if no call association found
            }
        }

        // --- Check if the associated call still exists ---
        const currentCallData = getCallDataByPrimaryId(callId); // Find by Twilio SID or Asterisk ID
        if (!currentCallData) {
             logger.warn(`[RTP Listener] Received packet for SSRC ${ssrc} mapped to callId ${callId}, but call no longer tracked. Discarding & cleaning map.`);
             ssrcToCallIdMap.delete(ssrc); // Clean up stale mapping
             return;
        }

        // --- Process Audio Payload ---
        // Assuming payload is SLIN8 (as requested by externalMedia format: 'slin')
        // Convert SLIN8 -> uLaw8 for OpenAI (which expects g711_ulaw)
        try {
            const pcm16Slin8Buffer = payload;
            // *** Convert 8kHz PCM -> 8kHz uLaw using AudioUtils ***
            const ulawBase64 = await AudioUtils.convertPcmToUlaw(pcm16Slin8Buffer);

            if (ulawBase64 && ulawBase64.length > 0) {
                 logger.debug(`[RTP Listener] Forwarding ${ulawBase64.length} base64 uLaw bytes for call ${callId} (SSRC: ${ssrc})`);
                 // Send to OpenAI service using the mapped callId (Twilio SID)
                 openAIService.sendAudioChunk(callId, ulawBase64);
            } else {
                 logger.warn(`[RTP Listener] uLaw conversion resulted in empty data for call ${callId} (SSRC: ${ssrc})`);
            }
        } catch (err) {
            logger.error(`[RTP Listener] Error transcoding/sending audio for call ${callId} (SSRC: ${ssrc}): ${err.message}`);
        }
    }); // End udpServer.on('message')

    udpServer.on('error', (err) => {
        logger.error(`[RTP Listener] UDP server error:\n${err.stack}`);
        udpServer.close(); // Close server on error
    });

    udpServer.on('close', () => {
        logger.info('[RTP Listener] UDP server closed.');
        udpServer = null; // Allow restarting
        ssrcToCallIdMap.clear(); // Clear mapping on close
    });

    try {
        udpServer.bind(RTP_LISTEN_PORT, RTP_LISTEN_HOST);
    } catch (bindErr) {
         logger.error(`[RTP Listener] Failed to bind UDP server: ${bindErr.message}`);
         udpServer = null;
    }

    // Graceful shutdown handlers
     process.on('SIGTERM', () => { if (udpServer) udpServer.close(); });
     process.on('SIGINT', () => { if (udpServer) udpServer.close(); });

    return udpServer;
}

function stopRtpListenerService() {
    if (udpServer) {
        logger.info('[RTP Listener] Stopping UDP server.');
        udpServer.close();
        // Setting udpServer = null happens in the 'close' event handler
    } else {
        logger.info('[RTP Listener] UDP server already stopped.');
    }
}

/**
 * Function to be called by ari.client.js during cleanup to remove SSRC mapping.
 * @param {number} ssrc - The SSRC to remove mapping for.
 */
function removeSsrcMapping(ssrc) {
    if (ssrc && ssrcToCallIdMap.has(ssrc)) {
        const callId = ssrcToCallIdMap.get(ssrc);
        ssrcToCallIdMap.delete(ssrc);
        logger.info(`[RTP Listener] Removed SSRC mapping for ${ssrc} (was callId: ${callId})`);
    } else if (ssrc) {
        logger.debug(`[RTP Listener] Attempted to remove mapping for SSRC ${ssrc}, but it was not found.`);
    }
}

async function ensureReady() {
    if (!udpServer) {
        logger.warn('[RTP Listener] UDP server not running, starting it');
        startRtpListenerService();
        // Give it a moment to bind
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return udpServer !== null;
}

module.exports = {
    startRtpListenerService,
    stopRtpListenerService,
    ensureReady, // Ensure the service is ready to process packets
    addSsrcMapping, // Export the function to manually add SSRC mappings
    removeSsrcMapping // Export the cleanup function
};
