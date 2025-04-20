const WebSocket = require('ws');
const url = require('url');
const prism = require('prism-media');
const { Buffer } = require('buffer');
const logger = require('../config/logger');
const { Conversation } = require('../models');

const twilioConnections = new Map();
const conversationStore = new Map();
const streamSidMap = new Map();
const streamEstablished = new Set();

function findStreamSidForCall(callSid) {
  return streamSidMap.get(callSid) || null;
}

function handleOpenAINotification(callSid, type, data) {
  logger.debug(`[WebSocket Service] Received notification from OpenAI service for ${callSid}: ${type}`);
  const twilioWs = twilioConnections.get(callSid);

  if (!twilioWs || twilioWs.readyState !== WebSocket.OPEN) {
    logger.warn(`[WebSocket Service] Twilio WebSocket not available for ${callSid} to handle notification: ${type}`);
    if (type === 'openai_error' || type === 'openai_closed') {
      if (twilioWs) twilioWs.close();
      cleanupConnection(callSid);
    }
    return;
  }

  switch (type) {
    case 'audio_chunk': {
      if (!data.audio) return;
      if (!streamEstablished.has(callSid)) {
        logger.warn(`[WebSocket Service] Skipping audio_chunk for ${callSid} — stream not yet established`);
        return;
      }
      const mediaMessage = {
        event: 'media',
        streamSid: findStreamSidForCall(callSid),
        media: {
          payload: data.audio,
        },
      };
      twilioWs.send(JSON.stringify(mediaMessage));
      break;
    }
    case 'openai_connected':
      logger.info(`[WebSocket Service] OpenAI connection ready for ${callSid}.`);
      break;
    case 'text_message':
      logger.info(
        `[WebSocket Service] Text message from OpenAI for ${callSid} (role: ${data.role}): ${data.content.substring(
          0,
          50
        )}...`
      );
      break;
    case 'response_done':
      logger.info(`[WebSocket Service] OpenAI response done for ${callSid}.`);
      break;
    case 'function_call':
      logger.info(`[WebSocket Service] Function call received for ${callSid}: ${data.call.name}`);
      break;
    case 'openai_error':
      logger.error(`[WebSocket Service] OpenAI error for ${callSid}: ${data.message}. Closing Twilio connection.`);
      twilioWs.close();
      cleanupConnection(callSid);
      break;
    case 'openai_closed':
      logger.info(`[WebSocket Service] OpenAI connection closed for ${callSid}. Closing Twilio connection.`);
      twilioWs.close();
      cleanupConnection(callSid);
      break;
    default:
      logger.warn(`[WebSocket Service] Unhandled notification type from OpenAI service: ${type}`);
  }
}

const openAIService = require('./openai.realtime.service');

openAIService.setNotificationCallback(handleOpenAINotification);

const initializeWebSocketServer = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    logger.info(`[WebSocket Service] New WS connection attempt: ${req.url}`);
    logger.info(`[WebSocket Service] headers: ${JSON.stringify(req.headers, null, 2)}`);
    logger.info(`[WebSocket Service] url: ${req.url}`);
    logger.info(`[WebSocket Service] connection IP: ${req.socket.remoteAddress}`);
    logger.info(`[WebSocket Service] connection method: ${req.method}`);

    const { pathname } = url.parse(req.url);
    const pathSegments = pathname.split('/');
    const callSid = pathSegments[pathSegments.length - 1];

    if (!callSid) {
      logger.error('[WebSocket Service] Connection attempt without CallSid in URL. Closing.');
      ws.close();
      return;
    }

    logger.info(`[WebSocket Service] Twilio client connected for CallSid: ${callSid}`);
    twilioConnections.set(callSid, ws);
    ws.send(JSON.stringify({ event: 'connected' }));
    logger.info(`[WebSocket Service] Sent 'connected' event back to Twilio for ${callSid}`);

    let conversation;
    let conversationId;
    try {
      conversation = await Conversation.findOne({ callSid });
      if (!conversation) {
        logger.warn(
          `[WebSocket Service] No conversation found in DB for CallSid: ${callSid}. Creating temporary placeholder.`
        );
        conversation = new Conversation({
          callSid,
          // Add default fields as needed
          messages: [],
          createdAt: new Date(),
        });
        await conversation.save(); // This ensures you have an _id for conversationId
        // logger.error(`[WebSocket Service] No conversation found in DB for CallSid: ${callSid}. Closing.`);
        // ws.close();
        // cleanupConnection(callSid);
        // return;
      }
      conversationId = conversation._id.toString();
      conversationStore.set(callSid, conversationId);
      logger.info(`[WebSocket Service] Found conversation ${conversationId} for CallSid: ${callSid}`);
    } catch (dbError) {
      logger.error(`[WebSocket Service] DB error retrieving conversation for ${callSid}: ${dbError}. Closing.`);
      ws.close();
      cleanupConnection(callSid);
      return;
    }

    const initialPrompt =
      "You are Bianca, a helpful AI assistant from the patient's care team. Greet the patient warmly and ask how you can help today.";
    logger.info(`[WebSocket Service] Connecting to OpenAI Realtime for ${callSid} with convId: ${conversationId}`);
    try {
      setTimeout(() => {
        openAIService.connect(callSid, conversationId, initialPrompt);
      }, 500);
      //openAIService.connect(callSid, conversationId, initialPrompt);
      logger.info(`[WebSocket Service] connect() call returned for ${callSid}`);
    } catch (err) {
      logger.error(`[WebSocket Service] ERROR in openAIService.connect for ${callSid}: ${err.stack}`);
    }

    ws.on('message', (message) => {
      try {
        logger.debug(`[WebSocket Service] Raw message from Twilio for ${callSid}: ${message.toString()}`);
        const data = JSON.parse(message);
        logger.debug(`[WebSocket Service] Parsed message from Twilio for ${callSid}: ${JSON.stringify(data)}`);
        logger.info(`[WebSocket Service] Event received from Twilio: ${data.event}`);
        if (data.event === 'start' && data.start) {
          logger.info(`[WebSocket Service] START event body: ${JSON.stringify(data.start)}`);
        }
        switch (data.event) {
          case 'connected':
            logger.info(`[WebSocket Service] Twilio 'connected' event for ${callSid}`);
            break;
          case 'start':
            logger.info(`[WebSocket Service] Twilio 'start' event for ${callSid}. StreamSid: ${data.start.streamSid}`);
            streamSidMap.set(callSid, data.start.streamSid);
            streamEstablished.add(callSid);
            break;
          case 'media':
            logger.debug(`[WebSocket Service] Twilio 'media' event for ${callSid}`);
            openAIService.sendAudioChunk(callSid, data.media.payload);
            break;
          case 'stop':
            logger.info(`[WebSocket Service] Twilio 'stop' event for ${callSid}. Call likely ended.`);
            cleanupConnection(callSid);
            break;
          case 'mark':
            logger.info(`[WebSocket Service] Twilio 'mark' event received for ${callSid}: ${data.mark.name}`);
            break;
          default:
            logger.warn(`[WebSocket Service] Unhandled Twilio event type: ${data.event}`);
        }
      } catch (err) {
        logger.error(`[WebSocket Service] Error processing message from Twilio for ${callSid}: ${err}`, message.toString());
      }
    });

    ws.on('error', (error) => {
      logger.error(`[WebSocket Service] Twilio WebSocket error for ${callSid}: ${error}`);
      cleanupConnection(callSid);
    });

    ws.on('close', (code, reason) => {
      logger.info(`[WebSocket Service] Twilio WebSocket closed for ${callSid}. Code: ${code}, Reason: ${reason.toString()}`);
      cleanupConnection(callSid);
    });
  });

  logger.info('[WebSocket Service] WebSocket server initialized and listening.');
};

const cleanupConnection = (callSid) => {
  logger.info(`[WebSocket Service] Cleaning up connections for CallSid: ${callSid}`);
  const twilioWs = twilioConnections.get(callSid);
  if (twilioWs && twilioWs.readyState !== WebSocket.CLOSED) {
    twilioWs.close();
  }
  twilioConnections.delete(callSid);
  openAIService.disconnect(callSid);
  conversationStore.delete(callSid);
  streamSidMap.delete(callSid);
  streamEstablished.delete(callSid);
};

module.exports = {
  initializeWebSocketServer,
};
