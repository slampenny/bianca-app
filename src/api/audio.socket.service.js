// src/services/audio.socket.service.js

const net = require('net'); // Use Node's built-in TCP module
const { Buffer } = require('buffer'); // Explicitly require Buffer if needed

const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
// Require the shared tracker instance
const channelTracker = require('./channel.tracker'); // Adjust path if needed

const LISTEN_HOST = '0.0.0.0';
const LISTEN_PORT = 9099;

// AudioSocket Protocol Frame Types (based on documentation)
const FRAME_TYPE_TERMINATE = 0x00;
const FRAME_TYPE_UUID = 0x01; // Asterisk sends 16-byte binary
const FRAME_TYPE_DTMF = 0x03;
const FRAME_TYPE_AUDIO_SLIN16 = 0x10; // Signed Linear 16-bit PCM, 8kHz mono LE (common Asterisk format)
const FRAME_TYPE_ERROR = 0xFF;

// Header length in bytes
const HEADER_LENGTH = 3; // 1 byte Type + 2 bytes Length

let tcpServer = null;

// Helper to format binary UUID remains the same
function formatBinaryUUID(buffer) {
  if (!buffer || buffer.length !== 16) {
    logger.error(`[AudioSocket Utils] Invalid buffer length for UUID formatting: ${buffer?.length}`);
    return null;
  }
  try {
    const hex = buffer.toString('hex');
    // Add hyphens: 8-4-4-4-12
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch (e) {
     logger.error(`[AudioSocket Utils] Error formatting binary UUID: ${e.message}`);
     return null;
  }
}

function startAudioSocketServer() {
    if (tcpServer) {
        logger.warn('[AudioSocket TCP] Server already running.');
        return;
    }

    tcpServer = net.createServer((socket) => {
        const connectionId = `tcp-${socket.remoteAddress}:${socket.remotePort}`;
        logger.info(`[AudioSocket TCP] Asterisk connected. Client ID: ${connectionId}`);

        let incomingBuffer = Buffer.alloc(0);
        // Add properties directly to the socket object to store state for this connection
        socket.state = 'AwaitingUUID'; // Initial state
        socket.asteriskId = null;     // Associated Asterisk Channel ID
        socket.primarySid = null;     // Associated Primary SID (Twilio CallSid preferably) to use with OpenAI service

        socket.on('data', (data) => {
            if (socket.destroyed) return; // Don't process if socket is already closing/closed
            incomingBuffer = Buffer.concat([incomingBuffer, data]);

            while (true) { // Process frames
                if (socket.destroyed || socket.state === 'Closed' || socket.state === 'Error') break;

                if (incomingBuffer.length < HEADER_LENGTH) break; // Need header

                const frameType = incomingBuffer.readUInt8(0);
                const payloadLength = incomingBuffer.readUInt16BE(1);
                const totalFrameLength = HEADER_LENGTH + payloadLength;

                if (incomingBuffer.length < totalFrameLength) break; // Need full frame

                const payload = incomingBuffer.slice(HEADER_LENGTH, totalFrameLength);

                try {
                    switch (frameType) {
                        case FRAME_TYPE_UUID:
                            if (socket.state === 'AwaitingUUID') {
                                let receivedUuidString = null;
                                if (payload.length === 16) {
                                    receivedUuidString = formatBinaryUUID(payload);
                                    logger.info(`[AudioSocket TCP] ${connectionId}: Received 16-byte UUID frame, formatted as: "${receivedUuidString}"`);
                                } else {
                                    receivedUuidString = payload.toString('ascii').trim();
                                    logger.warn(`[AudioSocket TCP] ${connectionId}: Received UUID payload length ${payload.length}, expected 16. Using ASCII: "${receivedUuidString}"`);
                                }

                                if (!receivedUuidString) {
                                    logger.error(`[AudioSocket TCP] ${connectionId}: Failed to format/invalid UUID. Closing socket.`);
                                    socket.destroy(); break;
                                }

                                const parentAsteriskId = channelTracker.findParentChannelIdByUuid(receivedUuidString);
                                if (parentAsteriskId) {
                                    const callData = channelTracker.getCall(parentAsteriskId);
                                    // *** Use Twilio SID as primary identifier if available, fallback to Asterisk ID ***
                                    socket.primarySid = callData?.twilioSid || parentAsteriskId;
                                    socket.asteriskId = parentAsteriskId; // Store for reference/logging
                                    socket.state = 'StreamingAudio';
                                    logger.info(`[AudioSocket TCP] ${connectionId}: Associated with Primary SID: ${socket.primarySid} (Asterisk ID: ${socket.asteriskId})`);
                                } else {
                                    logger.error(`[AudioSocket TCP] ${connectionId}: No tracked channel found for UUID "${receivedUuidString}". Closing socket.`);
                                    channelTracker.logState();
                                    socket.destroy(); break;
                                }
                            } else {
                                logger.warn(`[AudioSocket TCP] ${connectionId}: Received unexpected UUID frame in state ${socket.state}. Ignoring.`);
                            }
                            break; // End FRAME_TYPE_UUID

                        case FRAME_TYPE_AUDIO_SLIN16:
                            if (socket.state === 'StreamingAudio' && socket.primarySid) { // Check for primarySid
                                if (payload.length > 0) {
                                    // logger.debug(`[AudioSocket TCP] Received ${payload.length} bytes audio for Primary SID ${socket.primarySid}`);
                                    try {
                                        const audioBase64 = payload.toString('base64');
                                        // *** FIX: Send using Primary SID (preferably Twilio SID) ***
                                        openAIService.sendAudioChunk(socket.primarySid, audioBase64);
                                    } catch (err) {
                                        logger.error(`[AudioSocket TCP] Error encoding/sending audio for Primary SID ${socket.primarySid}: ${err.message}`);
                                    }
                                }
                            } else if (socket.state !== 'StreamingAudio') {
                                // Avoid logging empty payload warnings
                                if(payload.length > 0) logger.warn(`[AudioSocket TCP] ${connectionId}: Received audio frame but state is ${socket.state}. Ignoring.`);
                            } else { // State is StreamingAudio but primarySid is missing (shouldn't happen)
                                if(payload.length > 0) logger.error(`[AudioSocket TCP] ${connectionId}: Received audio frame in StreamingAudio state but Primary SID is missing. Cannot forward.`);
                            }
                            break; // End FRAME_TYPE_AUDIO_SLIN16

                        case FRAME_TYPE_DTMF:
                             if (socket.state === 'StreamingAudio' && socket.primarySid) { // Check for primarySid
                                const digit = payload.toString('ascii').charAt(0);
                                logger.info(`[AudioSocket TCP] ${connectionId}: Received DTMF '${digit}' for Primary SID ${socket.primarySid}`);
                                // Optionally forward DTMF using Primary SID
                                // openAIService.sendDtmf(socket.primarySid, digit);
                             } else {
                                 logger.warn(`[AudioSocket TCP] ${connectionId}: Received DTMF frame but state is ${socket.state} or Primary SID is missing. Ignoring.`);
                             }
                             break; // End FRAME_TYPE_DTMF

                        case FRAME_TYPE_TERMINATE:
                             logger.info(`[AudioSocket TCP] ${connectionId}: Received Terminate frame (Primary SID: ${socket.primarySid}). Closing socket.`);
                             socket.end(); // Graceful close
                             break; // End FRAME_TYPE_TERMINATE

                        case FRAME_TYPE_ERROR:
                             const errorCode = payload.length > 0 ? payload.readUInt8(0) : 'N/A';
                             logger.error(`[AudioSocket TCP] ${connectionId}: Received Error frame (Primary SID: ${socket.primarySid}). Error code: ${errorCode}. Closing socket.`);
                             socket.destroy(); // Force close
                             break; // End FRAME_TYPE_ERROR

                        default:
                            logger.warn(`[AudioSocket TCP] ${connectionId}: Received unknown frame type 0x${frameType.toString(16)}. Ignoring frame.`);
                    } // End switch
                } catch (processingError) {
                     logger.error(`[AudioSocket TCP] ${connectionId}: Error processing frame type 0x${frameType.toString(16)}: ${processingError.message}`);
                     if (processingError.stack) logger.error(`[AudioSocket TCP] Stack: ${processingError.stack}`);
                     socket.destroy(); // Destroy socket on unexpected processing error
                     break;
                }

                // Remove the processed frame from the buffer
                incomingBuffer = incomingBuffer.slice(totalFrameLength);
                if (socket.destroyed) break; // Exit loop if socket was destroyed

            } // End while loop
        }); // End socket.on('data')

        socket.on('end', () => {
            logger.info(`[AudioSocket TCP] Client ${connectionId} (Primary SID: ${socket.primarySid}) sent FIN packet.`);
            socket.state = 'Closed';
        });
        socket.on('close', (hadError) => {
            logger.info(`[AudioSocket TCP] Socket closed for ${connectionId} (Primary SID: ${socket.primarySid}). Had error: ${hadError}`);
            socket.state = 'Closed';
        });
        socket.on('error', (err) => {
            logger.error(`[AudioSocket TCP] Error on socket ${connectionId} (Primary SID: ${socket.primarySid}): ${err.message}`);
            socket.state = 'Error';
        });
    }); // End tcpServer = net.createServer

    tcpServer.listen(LISTEN_PORT, LISTEN_HOST, () => {
        logger.info(`[AudioSocket TCP] Server listening on TCP ${LISTEN_HOST}:${LISTEN_PORT}`);
    });

    tcpServer.on('error', (err) => {
        logger.error(`[AudioSocket TCP] Server error: ${err.message}`);
        if (err.code === 'EADDRINUSE') {
             logger.error(`[AudioSocket TCP] Port ${LISTEN_PORT} is already in use.`);
        }
        tcpServer = null; // Allow restarting
    });

    // Graceful shutdown handlers
     process.on('SIGTERM', () => {
        if (tcpServer) {
            logger.info('[AudioSocket TCP] Closing TCP server on SIGTERM...');
            tcpServer.close(() => logger.info('[AudioSocket TCP] TCP Server closed.'));
        }
     });
     process.on('SIGINT', () => {
         if (tcpServer) {
            logger.info('[AudioSocket TCP] Closing TCP server on SIGINT...');
            tcpServer.close(() => logger.info('[AudioSocket TCP] TCP Server closed.'));
         }
     });

    return tcpServer;
}

module.exports = { startAudioSocketServer };