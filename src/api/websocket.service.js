// Simplified websocket.service.js
const WebSocket = require('ws');
const url = require('url');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');

// Create the connections map at module scope
const connections = new Map();

// Make connections available globally for debugging
global.twilioConnections = connections;

function initializeWebSocketServer(server) {
  // Create WebSocket server without path restriction
  const wss = new WebSocket.Server({ server });
 
  logger.info('[WebSocket] Server initialized');
 
  // Handle new connections
  wss.on('connection', async (ws, req) => {
    try {
      // Log the connection attempt
      logger.info(`[WebSocket] New connection: ${req.url}`);
     
      // Parse URL to extract CallSid from path
      const parsedUrl = url.parse(req.url, true);
      const pathParts = parsedUrl.pathname.split('/');
      const callSid = pathParts[pathParts.length - 1];
     
      logger.info(`[WebSocket] Extracted CallSid: ${callSid}`);
     
      // Initialize conversation with OpenAI
      const initialPrompt = "You are Bianca, a helpful AI assistant from the patient's care team. Greet the patient warmly and ask how you can help today.";
     
      // Send connection acknowledgement
      ws.send(JSON.stringify({ event: 'connected' }));
     
      // Store connection using the module-level map
      connections.set(callSid, {
        ws,
        connected: new Date()
      });
      
      // Update global reference (redundant but ensures it's always current)
      global.twilioConnections = connections;
     
      // Set up event handlers
      ws.on('message', async (message) => {
        try {
          logger.info(`[WebSocket] Received message from ${callSid}`);
         
          // Parse message as JSON
          const data = JSON.parse(message);
         
          // Handle media messages (audio)
          if (data.event === 'media' && data.media && data.media.payload) {
            // Forward audio to OpenAI
            await openAIService.sendAudioChunk(callSid, data.media.payload);
          }
        } catch (err) {
          logger.error(`[WebSocket] Error processing message: ${err.message}`);
        }
      });
     
      // Handle connection close
      ws.on('close', () => {
        logger.info(`[WebSocket] Connection closed for ${callSid}`);
       
        // Clean up using the module-level map
        connections.delete(callSid);
       
        // Disconnect from OpenAI
        openAIService.disconnect(callSid);
      });
     
      // Handle errors
      ws.on('error', (err) => {
        logger.error(`[WebSocket] Error for ${callSid}: ${err.message}`);
      });
     
      // Initialize OpenAI connection
      logger.info(`[WebSocket] Initializing OpenAI for ${callSid}`);
      await openAIService.initialize(callSid, null, initialPrompt);
     
      // Register callback to handle OpenAI responses
      openAIService.setNotificationCallback((sid, type, data) => {
        if (sid !== callSid) return;
       
        // Find connection
        const conn = connections.get(callSid);
        if (!conn || !conn.ws || conn.ws.readyState !== WebSocket.OPEN) return;
       
        // Handle audio chunks from OpenAI
        if (type === 'audio_chunk' && data.audio) {
          // Send audio back to Twilio
          conn.ws.send(JSON.stringify({
            event: 'media',
            streamSid: callSid, // Twilio expects this
            media: {
              payload: data.audio
            }
          }));
        }
      });
     
    } catch (err) {
      logger.error(`[WebSocket] Error handling connection: ${err.message}`);
      ws.close(1011, 'Internal server error');
    }
  });

  // Make the WebSocket server instance available for inspection
  global.webSocketServer = wss;
 
  return wss;
}

// Export both the function and the connections map
module.exports = {
  initializeWebSocketServer,
  connections
};