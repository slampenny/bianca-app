// src/services/audio.socket.service.js

// *** Use WebSocket server, not TCP ***
const WebSocket = require('ws'); // npm install ws
const url = require('url'); // Node.js built-in module

const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
// *** Require the shared tracker instance ***
const channelTracker = require('./channel.tracker'); // Adjust path if needed

const LISTEN_HOST = '0.0.0.0';
const LISTEN_PORT = 9099;

let wsServer = null;

function startAudioSocketServer() {
    if (wsServer) {
        logger.warn('[AudioSocket] WebSocket Server already running.');
        return;
    }

    // *** Create WebSocket Server ***
    wsServer = new WebSocket.Server({ host: LISTEN_HOST, port: LISTEN_PORT });

    wsServer.on('listening', () => {
        logger.info(`[AudioSocket] WebSocket Server listening on ${LISTEN_HOST}:${LISTEN_PORT}`);
    });

    wsServer.on('connection', (ws, req) => {
        // req is the incoming HTTP request object
        const connectionId = `ws-${Date.now()}`;
        const remoteAddress = req.socket.remoteAddress;
        logger.info(`[AudioSocket] Asterisk connected via WebSocket. Client ID: ${connectionId} from ${remoteAddress}`);

        // ** Parse UUID from the connection URL query parameters **
        // Assumes dialplan uses: AudioSocket(ws://.../path?uuid=THE_UUID)
        const parsedUrl = url.parse(req.url, true); // true parses query string
        const audioSocketUuid = parsedUrl.query.uuid;

        if (!audioSocketUuid) {
            logger.error(`[AudioSocket] No 'uuid' query parameter found in connection URL: ${req.url}. Closing connection ${connectionId}.`);
            ws.terminate(); // Close the WebSocket connection
            return;
        }

        logger.info(`[AudioSocket] Extracted UUID "${audioSocketUuid}" from connection URL for ${connectionId}`);

        // ** Find the parent channel using the tracker **
        const parentChannelId = channelTracker.findParentChannelIdByUuid(audioSocketUuid);

        if (!parentChannelId) {
            logger.error(`[AudioSocket] No tracked channel found for UUID: "${audioSocketUuid}". Closing connection ${connectionId}.`);
            channelTracker.logState(); // Log tracker state for debugging
            ws.terminate();
            return;
        }

        logger.info(`[AudioSocket] Associated UUID ${audioSocketUuid} with Asterisk Channel ID ${parentChannelId} for connection ${connectionId}`);

        // Store the parent channel ID on the WebSocket object for later use
        ws.parentChannelId = parentChannelId;
        ws.connectionId = connectionId; // Store for logging

        // Handle incoming audio messages from Asterisk
        ws.on('message', (message) => {
            // message is likely a Buffer containing raw audio data (e.g., SLIN)
             logger.debug(`[AudioSocket] Received message chunk of length: ${message.length} for ${ws.connectionId} (Channel: ${ws.parentChannelId})`);

            if (ws.parentChannelId && Buffer.isBuffer(message) && message.length > 0) {
                try {
                     const audioBase64 = message.toString('base64');
                     // Assuming openAIService uses the Asterisk Channel ID
                     // You might need the Twilio SID here depending on openAIService implementation.
                     // If needed, retrieve it from the tracker:
                     // const callData = channelTracker.getCall(ws.parentChannelId);
                     // const sidForOpenAI = callData?.twilioSid || ws.parentChannelId;
                     openAIService.sendAudioChunk(ws.parentChannelId, audioBase64);
                } catch (err) {
                     logger.error(`[AudioSocket] Error encoding/sending audio for ${ws.parentChannelId}: ${err.message}`);
                }
            } else if (!Buffer.isBuffer(message)) {
                 logger.warn(`[AudioSocket] Received non-buffer message on WebSocket for ${ws.connectionId}: ${message}`);
            }
        });

        ws.on('close', (code, reason) => {
            const reasonStr = reason ? reason.toString() : 'No reason given';
            logger.info(`[AudioSocket] WebSocket client ${ws.connectionId} (Channel: ${ws.parentChannelId}) disconnected. Code: ${code}, Reason: ${reasonStr}`);
            // No need to explicitly clean up the tracker here; ARI events (StasisEnd/ChannelDestroyed) should handle that.
        });

        ws.on('error', (err) => {
            logger.error(`[AudioSocket] Error on WebSocket client ${ws.connectionId} (Channel: ${ws.parentChannelId}): ${err.message}`);
            // The 'close' event will usually fire after an error.
        });
    }); // End wsServer.on('connection')

    wsServer.on('error', (err) => {
        logger.error(`[AudioSocket] WebSocket Server error: ${err.message}`);
        wsServer = null; // Allow restarting
    });

    // Graceful shutdown handlers (keep existing logic)
     process.on('SIGTERM', () => {
        if (wsServer) {
            logger.info('[AudioSocket] Closing WebSocket server on SIGTERM...');
            wsServer.close(() => logger.info('[AudioSocket] WebSocket Server closed.'));
        }
     });
     process.on('SIGINT', () => {
         if (wsServer) {
            logger.info('[AudioSocket] Closing WebSocket server on SIGINT...');
            wsServer.close(() => logger.info('[AudioSocket] WebSocket Server closed.'));
         }
     });

    return wsServer;
}

// Remove the old findChannelByAudioSocketUuid using getAriClient

module.exports = { startAudioSocketServer };