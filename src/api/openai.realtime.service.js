const WebSocket = require('ws');
const stream = require('stream');
const prism = require('prism-media');
const { Buffer } = require('buffer');
const config = require('../config/config');
const logger = require('../config/logger');
const { Message } = require('../models');

const openAIConnections = new Map();
const readyToStreamAudio = new Set();
const waitForSessionStarted = new Map();
const pendingAudioChunks = new Map();
const commitTimers = new Map();

let notifyWebSocketService;

const setNotificationCallback = (callback) => {
  notifyWebSocketService = callback;
};

const flushPendingAudio = (callSid) => {
  const chunks = pendingAudioChunks.get(callSid);
  if (chunks && chunks.length > 0) {
    chunks.forEach((chunk) => sendAudioChunk(callSid, chunk));
    pendingAudioChunks.delete(callSid);
  }
};

const debounceCommit = (callSid) => {
  if (commitTimers.has(callSid)) clearTimeout(commitTimers.get(callSid));
  const ws = openAIConnections.get(callSid);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const timer = setTimeout(() => {
    ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    commitTimers.delete(callSid);
  }, 500);

  commitTimers.set(callSid, timer);
};

const connect = (callSid, conversationId, initialPrompt) => {
  logger.info(
    `[OpenAI Realtime] CONNECT INVOKED for ${callSid}. notifyWebSocketService is ${typeof notifyWebSocketService}`
  );

  if (openAIConnections.has(callSid)) {
    logger.warn(`[OpenAI Realtime] Connection already exists for CallSid: ${callSid}`);
    return;
  }

  const model = config.openai.realtimeModel;
  const voice = 'alloy';
  const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;

  logger.info(`[OpenAI Realtime] Connecting to ${wsUrl} for CallSid: ${callSid}`);

  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  ws.on('unexpected-response', (req, res) => {
    logger.error(`[OpenAI Realtime] Unexpected response: ${res.statusCode}`);
  });

  ws.on('open', () => {
    logger.info(`[OpenAI Realtime] WebSocket opened for CallSid: ${callSid}`);
    openAIConnections.set(callSid, ws);
    logger.info(`[OpenAI Realtime] WebSocket connection established for CallSid: ${callSid}`);
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'session.created') {
        logger.info(`[OpenAI Realtime] Session started confirmed for ${callSid}`);
        waitForSessionStarted.set(callSid, true);

        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions:
              initialPrompt ||
              "You are Bianca, a helpful AI assistant from the patient's care team. Greet the patient warmly and ask how you can help today.",
            voice: 'alloy',
            output_audio_format: 'pcm16',
            tts_first: true,
          },
        };
        ws.send(JSON.stringify(sessionConfig));
        logger.info(`[OpenAI Realtime] Sent session config for CallSid: ${callSid}`);

        const initialUserMessage = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Hello, are you there?',
              },
            ],
          },
        };
        ws.send(JSON.stringify(initialUserMessage));
        logger.info(`[OpenAI Realtime] Sent initial prompt trigger for CallSid: ${callSid}`);

        readyToStreamAudio.add(callSid);
        flushPendingAudio(callSid);

        if (notifyWebSocketService) {
          notifyWebSocketService(callSid, 'openai_connected', {});
        }
      } else if (message.type === 'response.content_part.added' && message.content_part.content_type === 'audio') {
        const audioBase64 = message.content_part.data;
        if (notifyWebSocketService) {
          const inputBuffer = Buffer.from(audioBase64, 'base64');
          const encoder = new prism.Encoder({
            type: 'ulaw',
            rate: 8000,
            channels: 1,
          });

          const passthrough = new stream.PassThrough();
          passthrough.end(inputBuffer);

          const chunks = [];

          passthrough
            .pipe(encoder)
            .on('data', (chunk) => chunks.push(chunk))
            .on('end', () => {
              const ulaw = Buffer.concat(chunks).toString('base64');
              notifyWebSocketService(callSid, 'audio_chunk', { audio: ulaw });
            })
            .on('error', (err) => {
              logger.error(`[OpenAI Realtime] Error in audio transcoding for ${callSid}: ${err.message}`);
            });
        }
      } else if (message.type === 'conversation.item.created') {
        const { item } = message;
        if (item.type === 'message' && (item.role === 'assistant' || item.role === 'user') && item.content) {
          const contentText = Array.isArray(item.content)
            ? item.content.map((part) => part.text || '').join(' ')
            : item.content;

          logger.info(`[OpenAI Realtime] Saving ${item.role} message for ${callSid}: "${contentText.substring(0, 50)}..."`);

          const dbMessage = new Message({
            role: item.role,
            content: contentText,
            conversationId,
          });
          await dbMessage.save();

          if (notifyWebSocketService) {
            notifyWebSocketService(callSid, 'text_message', { role: item.role, content: contentText });
          }
        } else if (item.type === 'function_call') {
          logger.info(`[OpenAI Realtime] Received function call request for ${callSid}: ${item.function_call.name}`);
          if (notifyWebSocketService) {
            notifyWebSocketService(callSid, 'function_call', { call: item.function_call });
          }
        }
      } else if (message.type === 'response.done') {
        logger.info(`[OpenAI Realtime] Assistant response done for CallSid: ${callSid}`);
        if (notifyWebSocketService) {
          notifyWebSocketService(callSid, 'response_done', {});
        }
      } else if (message.type === 'error') {
        logger.error(`[OpenAI Realtime] Error type for ${callSid}: ${message.error.message}`);
        if (notifyWebSocketService) {
          notifyWebSocketService(callSid, 'openai_error', { message: message.error.message });
        }
        disconnect(callSid);
      } else {
        logger.debug(`[OpenAI Realtime] Ignored type for ${callSid}: ${JSON.stringify(message)}`);
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error processing message for ${callSid}: ${err}`, data.toString());
    }
  });

  ws.on('error', (error) => {
    logger.error(`[OpenAI Realtime] WebSocket error for ${callSid}: ${error}`);
    if (notifyWebSocketService) {
      notifyWebSocketService(callSid, 'openai_error', { message: error.message || 'WebSocket error' });
    }
    readyToStreamAudio.delete(callSid);
    waitForSessionStarted.delete(callSid);
    openAIConnections.delete(callSid);
  });

  ws.on('close', (code, reason) => {
    logger.info(`[OpenAI Realtime] WebSocket closed for ${callSid}. Code: ${code}, Reason: ${reason.toString()}`);
    if (notifyWebSocketService) {
      notifyWebSocketService(callSid, 'openai_closed', { code, reason: reason.toString() });
    }
    readyToStreamAudio.delete(callSid);
    waitForSessionStarted.delete(callSid);
    openAIConnections.delete(callSid);
  });
};

const decodeUlawToPcm = (ulawBase64) => {
  const inputBuffer = Buffer.from(ulawBase64, 'base64');
  const decoder = new prism.Decoder({ type: 'ulaw', rate: 8000, channels: 1 });
  const output = new stream.PassThrough();
  const outputChunks = [];

  output.on('data', (chunk) => outputChunks.push(chunk));
  output.on('end', () => {});
  output.on('error', (err) => {
    logger.error(`[OpenAI Realtime] Decoder error: ${err.message}`);
  });

  const input = new stream.PassThrough();
  input.end(inputBuffer);
  input.pipe(decoder).pipe(output);

  return new Promise((resolve) => {
    output.on('end', () => {
      const combined = Buffer.concat(outputChunks);
      resolve(combined.toString('base64'));
    });
  });
};

const sendAudioChunk = async (callSid, audioChunkBase64) => {
  logger.debug(`[OpenAI Realtime] Received audio chunk for ${callSid}. Size: ${audioChunkBase64.length}`);

  if (!audioChunkBase64 || typeof audioChunkBase64 !== 'string' || audioChunkBase64.trim() === '') {
    logger.warn(`[OpenAI Realtime] Skipping empty or invalid audio chunk for ${callSid}`);
    return;
  }

  if (!readyToStreamAudio.has(callSid) || !waitForSessionStarted.get(callSid)) {
    logger.debug(`[OpenAI Realtime] Buffering audio for ${callSid} (session not ready)`);
    if (!pendingAudioChunks.has(callSid)) pendingAudioChunks.set(callSid, []);
    pendingAudioChunks.get(callSid).push(audioChunkBase64);
    return;
  }

  const ws = openAIConnections.get(callSid);
  if (ws && ws.readyState === WebSocket.OPEN) {
    const pcmBase64 = await decodeUlawToPcm(audioChunkBase64);
    const message = {
      type: 'input_audio_buffer.append',
      audio: pcmBase64,
    };
    ws.send(JSON.stringify(message));
    debounceCommit(callSid);
  } else {
    logger.warn(`[OpenAI Realtime] WebSocket not open or not found for sending audio, CallSid: ${callSid}`);
  }
};

const sendTextMessage = (callSid, text, role = 'user', metadata = {}) => {
  const ws = openAIConnections.get(callSid);
  if (ws && ws.readyState === WebSocket.OPEN) {
    let item;
    if (role === 'function_call_response') {
      item = {
        type: 'function_call_response',
        function_call_id: metadata.functionCallId,
        content: text,
      };
    } else {
      item = {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      };
    }

    const message = {
      type: 'conversation.item.create',
      item,
    };
    ws.send(JSON.stringify(message));
    logger.info(`[OpenAI Realtime] Sent ${role} text message for ${callSid}: ${text.substring(0, 50)}...`);
  } else {
    logger.warn(`[OpenAI Realtime] WebSocket not open or not found for sending text, CallSid: ${callSid}`);
  }
};

const disconnect = (callSid) => {
  const ws = openAIConnections.get(callSid);
  if (ws) {
    logger.info(`[OpenAI Realtime] Closing WebSocket connection for CallSid: ${callSid}`);
    ws.close();
    readyToStreamAudio.delete(callSid);
    waitForSessionStarted.delete(callSid);
    openAIConnections.delete(callSid);
    pendingAudioChunks.delete(callSid);
    commitTimers.delete(callSid);
  } else {
    logger.warn(`[OpenAI Realtime] Attempted to disconnect non-existent connection for CallSid: ${callSid}`);
  }
};

module.exports = {
  connect,
  disconnect,
  sendAudioChunk,
  sendTextMessage,
  setNotificationCallback,
};
