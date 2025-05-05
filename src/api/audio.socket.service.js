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
const FRAME_TYPE_UUID = 0x01; // Assume Asterisk sends string UUID based on dialplan arg
const FRAME_TYPE_DTMF = 0x03;
const FRAME_TYPE_AUDIO_SLIN16 = 0x10; // Signed Linear 16-bit PCM, 8kHz mono LE (common Asterisk format)
const FRAME_TYPE_ERROR = 0xFF;

// Header length in bytes
const HEADER_LENGTH = 3; // 1 byte Type + 2 bytes Length

let tcpServer = null;

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

    // Create TCP Server
    tcpServer = net.createServer((socket) => {
        const connectionId = `tcp-${socket.remoteAddress}:${socket.remotePort}`;
        logger.info(`[AudioSocket TCP] Asterisk connected. Client ID: ${connectionId}`);

        let incomingBuffer = Buffer.alloc(0); // Buffer for accumulating data per connection
        let parentChannelId = null; // Associated Asterisk Channel ID
        let state = 'AwaitingUUID'; // Initial state for this connection

        // Handle incoming data from Asterisk
        socket.on('data', (data) => {
            // logger.debug(`[AudioSocket TCP] Received data chunk of length: ${data.length} from ${connectionId}`);
            incomingBuffer = Buffer.concat([incomingBuffer, data]);
            // logger.debug(`[AudioSocket TCP] Buffer size now: ${incomingBuffer.length}`);

            // Process as many full frames as possible from the buffer
            while (true) {
                if (incomingBuffer.length < HEADER_LENGTH) {
                    // Not enough data for a header, wait for more
                    // logger.debug(`[AudioSocket TCP] Buffer too small for header (${incomingBuffer.length}), waiting.`);
                    break;
                }

                // Read header
                const frameType = incomingBuffer.readUInt8(0);
                const payloadLength = incomingBuffer.readUInt16BE(1); // Length is Big Endian
                const totalFrameLength = HEADER_LENGTH + payloadLength;

                // logger.debug(`[AudioSocket TCP] Parsed header: Type=0x${frameType.toString(16)}, Length=${payloadLength}, TotalFrame=${totalFrameLength}`);


                if (incomingBuffer.length < totalFrameLength) {
                    // Not enough data for the full payload yet, wait for more
                    // logger.debug(`[AudioSocket TCP] Buffer too small for full frame (${incomingBuffer.length}/${totalFrameLength}), waiting.`);
                    break;
                }

                // We have a full frame, extract payload
                const payload = incomingBuffer.slice(HEADER_LENGTH, totalFrameLength);
                // logger.debug(`[AudioSocket TCP] Processing frame Type 0x${frameType.toString(16)} with payload length ${payload.length}`);


                // --- Process Frame based on Type and State ---
                switch (frameType) {
                    case FRAME_TYPE_UUID: // UUID Frame (Type 0x01)
                        if (state === 'AwaitingUUID') {
                            // Assuming Asterisk sends the 36-char UUID string here based on dialplan arg
                            let receivedUuidString = null;
                            if (payload.length === 16) {
                                // *** FIX: Convert 16-byte binary payload to string format ***
                                receivedUuidString = formatBinaryUUID(payload);
                                logger.info(`[AudioSocket TCP] Received 16-byte UUID frame from ${connectionId}, formatted as: "${receivedUuidString}"`);
                            } else {
                                // Fallback/Warning if unexpected length (e.g., 36 bytes string)
                                const receivedText = payload.toString('ascii').trim();
                                logger.warn(`[AudioSocket TCP] Received UUID payload with unexpected length ${payload.length} from ${connectionId}. Attempting ASCII conversion: "${receivedText}"`);
                                receivedUuidString = receivedText; // Try using text if not 16 bytes
                            }

                            if (!receivedUuidString) {
                                logger.error(`[AudioSocket TCP] Failed to format or invalid UUID received from ${connectionId}. Closing socket.`);
                                socket.destroy();
                                incomingBuffer = Buffer.alloc(0);
                                return;
                            }

                            logger.info(`[AudioSocket TCP] Received UUID frame from ${connectionId}: "${receivedUuidString}" (payload length: ${payload.length})`);

                            parentChannelId = channelTracker.findParentChannelIdByUuid(receivedUuidString);
                            if (parentChannelId) {
                                logger.info(`[AudioSocket TCP] Associated ${connectionId} with Asterisk Channel ID: ${parentChannelId}`);
                                socket.parentChannelId = parentChannelId; // Store on socket object
                                state = 'StreamingAudio'; // Transition state
                            } else {
                                logger.error(`[AudioSocket TCP] No tracked channel found for UUID "${receivedUuidString}" from ${connectionId}. Closing socket.`);
                                channelTracker.logState();
                                socket.destroy(); // Close the socket immediately
                                // Need to break the loop AND potentially return if socket is destroyed
                                incomingBuffer = Buffer.alloc(0); // Clear buffer on error
                                return; // Exit the 'data' handler for this destroyed socket
                            }
                        } else {
                             logger.warn(`[AudioSocket TCP] Received unexpected UUID frame from ${connectionId} in state ${state}. Ignoring.`);
                        }
                        break;

                    case FRAME_TYPE_AUDIO_SLIN16: // Audio Frame (Type 0x10)
                        if (state === 'StreamingAudio' && socket.parentChannelId) {
                            if (payload.length > 0) {
                                logger.debug(`[AudioSocket TCP] Received ${payload.length} bytes audio for ${socket.parentChannelId}`);
                                try {
                                    const audioBase64 = payload.toString('base64');
                                    // Forward to OpenAI service using the parent channel ID stored on the socket
                                    openAIService.sendAudioChunk(socket.parentChannelId, audioBase64);
                                } catch (err) {
                                    logger.error(`[AudioSocket TCP] Error encoding/sending audio for ${socket.parentChannelId}: ${err.message}`);
                                }
                            } else {
                                 logger.debug(`[AudioSocket TCP] Received empty audio payload for ${socket.parentChannelId}`);
                            }
                        } else {
                             logger.warn(`[AudioSocket TCP] Received audio frame from ${connectionId} but state is ${state} or parentChannelId is missing. Ignoring.`);
                        }
                        break;

                    case FRAME_TYPE_DTMF: // DTMF Frame (Type 0x03)
                         if (state === 'StreamingAudio' && socket.parentChannelId) {
                            const digit = payload.toString('ascii').charAt(0); // DTMF is usually single ASCII char
                            logger.info(`[AudioSocket TCP] Received DTMF '${digit}' for ${socket.parentChannelId}`);
                            // Optionally forward DTMF to OpenAI or handle differently
                            // openAIService.sendDtmf(socket.parentChannelId, digit);
                         } else {
                             logger.warn(`[AudioSocket TCP] Received DTMF frame from ${connectionId} but state is ${state} or parentChannelId is missing. Ignoring.`);
                         }
                         break;

                    case FRAME_TYPE_TERMINATE: // Terminate Frame (Type 0x00)
                         logger.info(`[AudioSocket TCP] Received Terminate frame from ${connectionId} (Channel: ${socket.parentChannelId}). Closing socket.`);
                         socket.end(); // Graceful close initiated by Asterisk
                         break;

                    case FRAME_TYPE_ERROR: // Error Frame (Type 0xFF)
                         const errorCode = payload.length > 0 ? payload.readUInt8(0) : 'N/A';
                         logger.error(`[AudioSocket TCP] Received Error frame from ${connectionId} (Channel: ${socket.parentChannelId}). Error code: ${errorCode}. Closing socket.`);
                         socket.destroy(); // Force close on error
                         break;

                    default:
                        logger.warn(`[AudioSocket TCP] Received unknown frame type 0x${frameType.toString(16)} from ${connectionId}. Ignoring frame.`);
                }

                // Remove the processed frame from the buffer
                incomingBuffer = incomingBuffer.slice(totalFrameLength);
                // logger.debug(`[AudioSocket TCP] Buffer size after processing: ${incomingBuffer.length}`);

                // Safety check in case socket was destroyed during processing
                if (socket.destroyed) {
                     logger.debug(`[AudioSocket TCP] Socket ${connectionId} was destroyed during frame processing loop. Breaking loop.`);
                     break;
                }

            } // End while loop processing buffer
        }); // End socket.on('data')

        socket.on('end', () => {
            // Fired when Asterisk initiates a graceful close (e.g., sends FIN)
            logger.info(`[AudioSocket TCP] Client ${connectionId} (Channel: ${socket.parentChannelId}) sent FIN packet.`);
            state = 'Closed';
            // Main cleanup is handled by ARI client detecting channel hangup/destroy
        });

        socket.on('close', (hadError) => {
            // Fired when the socket is fully closed, either gracefully or due to error/destroy
            logger.info(`[AudioSocket TCP] Socket closed for ${connectionId} (Channel: ${socket.parentChannelId}). Had error: ${hadError}`);
            state = 'Closed';
            // Remove any specific state tied to this socket instance if necessary,
            // but the main call state cleanup should happen via ARI events.
        });

        socket.on('error', (err) => {
            logger.error(`[AudioSocket TCP] Error on socket ${connectionId} (Channel: ${socket.parentChannelId}): ${err.message}`);
            state = 'Error';
            // 'close' will usually fire after 'error'
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