// ari.client.js

const AriClient = require('ari-client');

const { v4: uuidv4 } = require('uuid');

const config = require('../config/config');

const logger = require('../config/logger');

const openAIService = require('./openai.realtime.service');

const { Conversation, Patient } = require('../models');

/**

 * Client for Asterisk ARI (Asterisk REST Interface)

 * Manages SIP/VoIP calls through Asterisk

 */

class AsteriskAriClient {
  constructor() {
    this.client = null;

    this.isConnected = false;

    this.channels = new Map(); // Store active channel information

    this.retryCount = 0;

    this.MAX_RETRIES = 10;

    this.RETRY_DELAY = 3000;

    // Make the client instance available globally for debugging

    global.ariClient = this;
  }

  /**

   * Initialize and connect to Asterisk ARI

   * @returns {Promise<void>}

   */

  async start() {
    try {
      logger.info('[ARI] Connecting to Asterisk ARI...');

      // Get connection details from config

      const ariUrl = config.asterisk.url || 'http://asterisk:8088';

      const username = config.asterisk.username || 'myphonefriend';

      const password = config.asterisk.password || 'changeme';

      logger.info(`[ARI] Attempting connection to ${ariUrl} with user: ${username}`);

      // Connect to Asterisk

      this.client = await AriClient.connect(ariUrl, username, password);

      this.isConnected = true;

      this.retryCount = 0; // Reset retry count

      logger.info('[ARI] Successfully connected to Asterisk ARI');

      // Set up event handlers

      this.setupEventHandlers();

      // Start application

      this.client.start('myphonefriend');

      logger.info('[ARI] Subscribed to Stasis application: myphonefriend');

      return this.client;
    } catch (err) {
      logger.error(`[ARI] Connection error: ${err.message}`);

      // Implement retry logic with backoff

      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;

        const delay = this.RETRY_DELAY * Math.pow(1.5, this.retryCount - 1); // Exponential backoff

        logger.info(`[ARI] Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);

        // Schedule retry

        setTimeout(() => {
          this.start();
        }, delay);
      } else {
        logger.error(`[ARI] Failed to connect after ${this.MAX_RETRIES} attempts. Giving up.`);

        this.isConnected = false;
      }
    }
  }

  /**

   * Set up event handlers for ARI events

   */

  setupEventHandlers() {
    if (!this.client) {
      logger.error('[ARI] Cannot set up event handlers: Client not initialized');

      return;
    }

    // Handle new channels (incoming calls)

    this.client.on('StasisStart', async (event, incomingChannel) => {
      const rawChannelId = incomingChannel.id;

      let callSid = null; // fallback

      let patientId = null;

      // Extract dialplan vars

      const callerName = incomingChannel.caller.name || 'unknown';

      const dialplanVars = event.channel.dialplan || {};

      logger.info(`[ARI] Incoming channel: ${rawChannelId}`);

      logger.info(`[ARI] Caller ID: ${callerName}`);

      logger.info(`[ARI] Channel variables: ${JSON.stringify(dialplanVars)}`);

      logger.info(`[ARI] Stasis Args: ${JSON.stringify(event.args || [])}`);

      // Check if callerName looks like a MongoDB ObjectId

      if (/^[0-9a-fA-F]{24}$/.test(callerName)) {
        patientId = callerName;

        logger.info(`[ARI] Extracted patientId from caller ID: ${patientId}`);
      } else {
        logger.info(`[ARI] Caller ID does not appear to be a patient ID, will try to extract from URI parameters`);
      }

      // Try to get URI options passed through dialplan (Set(URIOPTS=...))

      let channelVars;

      try {
        channelVars = await incomingChannel.getChannelVar({ variable: 'URIOPTS' });
      } catch (err) {
        logger.warn(`[ARI] URIOPTS variable not found on channel ${rawChannelId}: ${err.message}`);

        channelVars = { value: '' };
      }

      if (channelVars.value) {
        logger.info(`[ARI] URI options: ${channelVars.value}`);

        try {
          const uriOpts = channelVars.value.split('&').reduce((opts, pair) => {
            const [key, value] = pair.split('=');

            if (key && value) opts[key] = decodeURIComponent(value);

            return opts;
          }, {});

          if (uriOpts.patientId) {
            patientId = uriOpts.patientId;

            logger.info(`[ARI] Extracted patientId from URI options: ${patientId}`);
          }

          if (uriOpts.callSid) {
            callSid = uriOpts.callSid.trim();

            logger.info(`[ARI] Extracted Twilio CallSid from URI options: ${callSid}`);
          }
        } catch (err) {
          logger.warn(`[ARI] Failed to parse URIOPTS: ${channelVars.value} — ${err.message}`);
        }
      }

      try {
        await incomingChannel.answer();

        logger.info(`[ARI] Answered channel: ${rawChannelId}`);

        // --- ADD SIMPLE PLAYBACK TEST ---

        try {
          logger.info(`[ARI DEBUG] Attempting simple playback test (beep)...`);

          const playback = incomingChannel.play({
            // Play on the original channel ID

            targetUri: `channel:${rawChannelId}`,

            // Use 'sound:beep' as it's very likely available

            media: 'sound:beep',
          });

          logger.info(`[ARI DEBUG] Playback command sent. Playback ID: ${playback.id}`);

          // Optional: Listen for playback events for more debug info

          playback.once('PlaybackFinished', (event, instance) => {
            logger.info(`[ARI DEBUG] Playback ${instance.id} finished.`);
          });

          playback.once('PlaybackFailed', (event, instance) => {
            logger.error(`[ARI DEBUG] Playback ${instance.id} failed: ${event.playback.reason || 'Unknown reason'}`);
          });
        } catch (playErr) {
          logger.error(`[ARI DEBUG] Failed to initiate playback: ${playErr.message}`);

          if (playErr.stack) logger.error(`[ARI DEBUG] Playback Error Stack: ${playErr.stack}`);
        }

        // --- END SIMPLE PLAYBACK TEST ---

        await this.setupMediaPipeline(incomingChannel, callSid, patientId);

        this.channels.set(callSid, {
          channel: incomingChannel,

          channelId: rawChannelId,

          startTime: new Date(),

          state: 'active',

          patientId: patientId,
        });
      } catch (err) {
        logger.error(`[ARI] Error handling new channel ${callSid}: ${err.message}`);

        try {
          await incomingChannel.hangup();
        } catch (hangupErr) {
          logger.error(`[ARI] Error hanging up channel after error: ${hangupErr.message}`);
        }
      }
    });

    // Handle channel hangup requests

    this.client.on('ChannelHangupRequest', async (event, channel) => {
      const callSid = channel.id;

      logger.info(`[ARI] Channel hangup requested: ${callSid}`);

      await this.cleanupChannel(callSid);
    });

    // Handle channel destruction (call ended)

    this.client.on('ChannelDestroyed', async (event, channel) => {
      const callSid = channel.id;

      logger.info(`[ARI] Channel destroyed: ${callSid}`);

      await this.cleanupChannel(callSid);
    });

    // Handle client errors

    this.client.on('error', (err) => {
      logger.error(`[ARI] Client error: ${err.message}`);

      // Could implement reconnection logic here
    });
  }

  /**

     * Set up media pipeline for a channel

     * @param {Object} channel - Asterisk channel object

     * @param {string|null} patientId - Optional patient ID (CAN BE NULL)

     * @returns {Promise<void>}

     */

  async setupMediaPipeline(channel, callSid, patientId = null) {
    // Use Asterisk channel ID as the key identifier within this function

    const asteriskChannelId = channel.id;

    logger.info(`[ARI DEBUG] ENTERING setupMediaPipeline for ${asteriskChannelId}, patientId: ${patientId || 'None'}`);

    let conversation = null; // Define conversation in outer scope for potential cleanup

    let bridge = null; // Define bridge in outer scope for potential cleanup

    try {
      // --- Find or create conversation record ---

      logger.info(`[ARI DEBUG] Finding/Creating conversation for ${asteriskChannelId}, patientId: ${patientId || 'None'}`);

      const conversationData = {
        callSid: asteriskChannelId, // Use Asterisk Channel ID as primary key here

        startTime: new Date(),

        callType: 'asterisk-call', // Differentiate from maybe pure Twilio calls

        status: 'active',
      };

      if (patientId) {
        // Check if patient exists before assigning

        const patient = await Patient.findById(patientId)
          .lean()
          .catch((err) => {
            logger.warn(`[ARI DEBUG] DB Error finding patient ${patientId}: ${err.message}`);

            return null;
          });

        if (patient) {
          logger.info(`[ARI DEBUG] Found patient ${patient.name}. Linking conversation.`);

          conversationData.patientId = patient._id;
        } else {
          logger.warn(`[ARI DEBUG] Patient ${patientId} not found in DB. Creating conversation without patient link.`);

          // No need to explicitly set patientId: null if the schema doesn't require it
        }
      } else {
        logger.info(`[ARI DEBUG] No patientId provided. Creating conversation without patient link.`);
      }

      // Create the Mongoose object

      conversation = new Conversation(conversationData);

      // Save the conversation (handle potential validation errors if patientId is required by schema)

      try {
        await conversation.save();

        const conversationId = conversation._id.toString();

        logger.info(`[ARI DEBUG] Conversation ${conversationId} saved for ${asteriskChannelId}.`);

        // Store conversationId in channel map data

        const currentChannelData = this.channels.get(asteriskChannelId);

        if (currentChannelData) {
          currentChannelData.conversationId = conversationId;
        }
      } catch (dbErr) {
        logger.error(
          `[ARI DEBUG] Failed to save Conversation (patientId: ${patientId}): ${dbErr.message}. Check Mongoose schema validation if patientId is required.`
        );

        // Decide how to proceed - maybe throw, maybe continue without DB record?

        conversation = null; // Mark as null since save failed

        // For now, let's allow the call to proceed without a saved conversation record

        logger.warn('[ARI DEBUG] Proceeding without a saved conversation record due to DB error.');
      }

      // --------------------------------------------

      // 1. Create bridge

      logger.info(`[ARI DEBUG] Creating bridge for ${asteriskChannelId}...`);

      const bridgeId = `bridge-${uuidv4()}`;

      bridge = await this.client.bridges.create({ type: 'mixing', id: bridgeId, name: `call-${asteriskChannelId}` });

      logger.info(`[ARI DEBUG] Bridge ${bridge.id} created.`);

      // --- FIX: Record the BRIDGE, not the channel ---

      logger.info(`[ARI DEBUG] Starting recording for BRIDGE ${bridge.id}...`);

      const recordingName = `recording-${asteriskChannelId}`; // Use channel ID for name consistency

      try {
        await bridge.record({
          name: recordingName,
          format: 'wav',
          maxDurationSeconds: 3600,
          beep: false,
          ifExists: 'overwrite',
        });

        logger.info(`[ARI DEBUG] Bridge recording started for ${bridge.id} as ${recordingName}.`);
      } catch (recordErr) {
        logger.error(`[ARI DEBUG] bridge.record failed for ${bridge.id}: ${recordErr.message}`);

        // Decide if this is fatal
      }

      // --- End Bridge Recording ---

      // 2. Add channel to bridge (AFTER starting bridge recording if desired, or before)

      logger.info(`[ARI DEBUG] Adding channel ${asteriskChannelId} to bridge ${bridge.id}...`);

      await bridge.addChannel({ channel: channel.id });

      logger.info(`[ARI DEBUG] Channel ${asteriskChannelId} added to bridge.`);

      // 3. Update channel data map with bridge info

      const channelDataForBridge = this.channels.get(asteriskChannelId);

      if (channelDataForBridge) {
        channelDataForBridge.bridge = bridge;

        channelDataForBridge.bridgeId = bridge.id;
      }

      logger.info(`[ARI DEBUG] Channel map updated with bridge info for ${asteriskChannelId}.`);

      // 4. Connect to OpenAI

      let initialPrompt = "You are Bianca, a helpful AI assistant from the patient's care team.";

      // ... (Your logic to customize prompt based on patientId if available) ...

      const conversationIdForOpenAI = conversation ? conversation._id.toString() : null;

      logger.info(
        `[ARI DEBUG] Initializing OpenAI for ${asteriskChannelId} (ConvID: ${conversationIdForOpenAI || 'None'})...`
      );

      try {
        await openAIService.initialize(callSid, conversationIdForOpenAI, initialPrompt);

        logger.info(`[ARI DEBUG] OpenAI initialized for ${asteriskChannelId}.`);

        logger.info(`[ARI DEBUG] Setting OpenAI notification callback for ${asteriskChannelId}...`);

        openAIService.setNotificationCallback((notifCallSid, type, data) => {
          if (notifCallSid === callSid && type === 'audio_chunk') {
            this.handleOpenAIAudio(callSid, data.audio);
          }
        });

        logger.info(`[ARI DEBUG] OpenAI callback set for ${callSid}.`);
      } catch (openAiErr) {
        logger.error(`[ARI DEBUG] openAIService.initialize failed for ${callSid}: ${openAiErr.message}`);

        // Decide if call should continue without AI
      }

      // 5. External Media (Snooping) - Keep commented out for now

      logger.info(`[ARI DEBUG] Checking setupExternalMedia call for ${asteriskChannelId}...`);

      // this.setupExternalMedia(asteriskChannelId, channel); // <<< CONFIRM COMMENTED OUT

      logger.info(`[ARI DEBUG] setupExternalMedia call IS COMMENTED OUT for ${asteriskChannelId}.`);

      logger.info(`[ARI DEBUG] setupMediaPipeline try block SUCCESSFULLY COMPLETED for ${asteriskChannelId}.`);
    } catch (err) {
      logger.error(`[ARI DEBUG] >>> ERROR caught in setupMediaPipeline for ${asteriskChannelId} - Message: ${err.message}`);

      logger.error(`[ARI] Error setting up pipeline for ${asteriskChannelId}: ${err.message}`);

      if (err.stack) {
        logger.error(`[ARI] Pipeline Error Stack: ${err.stack}`);
      }

      // Attempt cleanup if bridge was created before error

      if (bridge && bridge.id) {
        logger.warn(`[ARI DEBUG] Attempting to destroy bridge ${bridge.id} after error.`);

        try {
          await bridge.destroy();
        } catch (e) {
          logger.warn(`[ARI DEBUG] Error destroying bridge after error: ${e.message}`);
        }
      }

      // Re-throw so StasisStart handler's catch block handles channel hangup

      throw err;
    }
  } // End of setupMediaPipeline

  /**

   * Set up external media handling for the channel using ARI WebSocket audio.

   * @param {string} callSid - Channel ID (Asterisk Channel ID)

   * @param {Object} channel - Asterisk channel object from ari-client

   */

  setupExternalMedia(callSid, channel) {
    logger.info(`[ARI] Setting up ARI WebSocket audio streaming for channel: ${callSid}`);

    // Event handler for receiving audio frames over the WebSocket

    // NOTE: The exact event name might vary ('ChannelUserevent', 'ChannelDtmfReceived', etc.

    // are standard, but audio frames might be less directly named or require specific

    // setup like snooping depending on exact library/Asterisk versions).

    // We'll use a conceptual name 'AudioFrame'. Check your library's specific events

    // or Asterisk ARI documentation if this doesn't work. A common alternative

    // is using channel snooping (channel.snoopChannel) and listening on the snoop channel.

    // ---- Hypothetical Example using a direct audio event ----

    // channel.on('AudioFrame', (event) => { // Replace 'AudioFrame' if needed

    //   if (event.audio && event.audio.length > 0) {

    //     this.sendAudioToOpenAI(callSid, event.audio);

    //   }

    // });

    // ---- End Hypothetical ----

    // ---- More Realistic Approach: Using Snooping ----

    // This is often more reliable across versions if direct audio frames aren't easily available.

    this.setupSnoopChannel(callSid, channel);

    // ---- ----

    // Optional: Listen for DTMF tones if needed

    channel.on('ChannelDtmfReceived', (event, chan) => {
      const digit = event.digit;

      logger.info(`[ARI] DTMF received on ${chan.id}: ${digit}`);

      // You could potentially forward this to OpenAI or handle it locally

      // openAIService.sendDtmf(callSid, digit); // Example
    });

    logger.info(`[ARI] Subscribed to relevant events for channel: ${callSid}`);
  }

  /**

 * Sets up a snoop channel to capture audio.

 * NOTE: Capturing the actual audio stream from the snoop channel via ARI

 * often requires additional steps beyond basic event listeners, such as

 * bridging the snoop channel to a Local channel using the AudioSocket() app

 * or using External Media on the snoop channel. This implementation provides

 * the snoop channel creation and basic event listeners for debugging/DTMF,

 * but the audio capture itself needs further specific implementation.

 *

 * @param {string} targetCallSid - The original channel ID to snoop on (e.g., Asterisk Channel ID).

 * @param {Object} targetChannel - The original channel object from ari-client.

 */

  async setupSnoopChannel(targetCallSid, targetChannel) {
    logger.info(`[ARI] Setting up snoop channel for ${targetCallSid}`);

    let snoopChannel; // Define snoopChannel in the outer scope to access in catch/finally

    try {
      const snoopId = `snoop-${uuidv4()}`;

      logger.info(`[ARI] Creating snoop channel to spy 'in' on ${targetChannel.id}`);

      // Create the snoop channel

      snoopChannel = await this.client.channels.snoopChannel({
        channelId: targetChannel.id, // The channel we want to listen to

        snoopId: snoopId, // A unique ID for the snoop operation

        spy: 'in', // 'in' = Audio received BY targetChannel (Caller's voice)

        // 'out' = Audio sent BY targetChannel (OpenAI's voice)

        // 'both' = Mixed audio
      });

      logger.info(`[ARI] Created snoop channel ${snoopChannel.id} spying on ${targetChannel.id}`);

      // --- Listen for standard events on the Snoop Channel ---

      // Optional: Handle DTMF received on the snooped channel

      snoopChannel.on('ChannelDtmfReceived', (event) => {
        const digit = event.digit;

        logger.info(
          `[ARI Snoop] DTMF '${digit}' detected via snoop on ${targetChannel.id} (snoop channel: ${snoopChannel.id})`
        );

        // Forward DTMF to your OpenAI service if needed

        // this.openAIService.sendDtmf(targetCallSid, digit); // Example call
      });

      // Handle when the snoop channel itself is hung up or destroyed

      snoopChannel.on('StasisEnd', () => {
        logger.info(
          `[ARI Snoop] StasisEnd received for snoop channel ${snoopChannel.id}. Original channel: ${targetCallSid}`
        );

        // Might indicate the snoop was terminated, maybe remove from tracking?
      });

      snoopChannel.on('ChannelDestroyed', () => {
        logger.info(
          `[ARI Snoop] ChannelDestroyed received for snoop channel ${snoopChannel.id}. Original channel: ${targetCallSid}`
        );

        // Remove snoop channel reference from main channel data if necessary

        const channelData = this.channels.get(targetCallSid);

        if (channelData && channelData.snoopChannel && channelData.snoopChannel.id === snoopChannel.id) {
          delete channelData.snoopChannel;
        }
      });

      // --- Audio Handling Placeholder ---

      logger.warn(`[ARI Snoop] ### Audio Handling Not Implemented ###`);

      logger.warn(`[ARI Snoop] Successfully created snoop channel ${snoopChannel.id}.`);

      logger.warn(`[ARI Snoop] >>> ACTION REQUIRED: Implement audio capture from snoop channel ${snoopChannel.id}.`);

      logger.warn(
        `[ARI Snoop] >>> Common methods involve bridging ${snoopChannel.id} to a Local channel using AudioSocket()`
      );

      logger.warn(`[ARI Snoop] >>> or potentially using ExternalMedia on ${snoopChannel.id}. Check Asterisk ARI docs.`);

      // ---- EXAMPLE of where audio event handling *would* go IF it existed ----

      // const hypotheticalAudioEvent = 'SomeAudioDataEvent';

      // snoopChannel.on(hypotheticalAudioEvent, (event) => {

      //    if (event.audioData) {

      //        logger.debug(`[ARI Snoop] Received audio chunk on ${snoopChannel.id}, size: ${event.audioData.length}`);

      //        this.sendAudioToOpenAI(targetCallSid, event.audioData);

      //    }

      // });

      // logger.info(`[ARI Snoop] Attempted to subscribe to hypothetical '${hypotheticalAudioEvent}' on ${snoopChannel.id}`);

      // ---- END EXAMPLE ----

      // Store snoop channel info for potential cleanup

      const channelData = this.channels.get(targetCallSid);

      if (channelData) {
        channelData.snoopChannel = snoopChannel; // Store the snoop channel object itself

        logger.info(`[ARI] Stored snoop channel ${snoopChannel.id} reference for target ${targetCallSid}.`);
      } else {
        // This shouldn't happen if called correctly from StasisStart where channelData is set

        logger.warn(`[ARI] Could not find original channel data for ${targetCallSid} when storing snoop channel.`);

        // Immediately hangup the snoop channel if we can't track its parent

        await snoopChannel.hangup();

        logger.warn(`[ARI] Hung up orphaned snoop channel ${snoopChannel.id}.`);

        return; // Stop further processing for this snoop channel
      }
    } catch (err) {
      logger.error(`[ARI] Error setting up snoop channel for ${targetCallSid}: ${err.message}`);

      if (err.message && err.message.includes(' Snooping channels must be bridged ')) {
        logger.error(
          '[ARI] Hint: Snooping might require the target channel to be in a bridge *before* snooping, or snoop options need adjustment.'
        );
      }

      // Clean up potentially created snoop channel if error occurred after creation

      if (snoopChannel && snoopChannel.id) {
        logger.warn(`[ARI] Attempting cleanup of snoop channel ${snoopChannel.id} after setup error.`);

        try {
          await snoopChannel.hangup();
        } catch (e) {
          logger.warn(`[ARI] Error hanging up failed snoop channel: ${e.message}`);
        }
      }
    }
  }

  /**

  * Send audio data from Asterisk to OpenAI Service.

  * @param {string} callSid - Channel ID (Asterisk Channel ID)

  * @param {Buffer} audioData - Raw audio data buffer (e.g., ulaw/alaw/slin)

  * @returns {Promise<void>}

  */

  async sendAudioToOpenAI(callSid, audioData) {
    // Check if channel still exists before sending

    if (!this.channels.has(callSid)) {
      // logger.debug(`[ARI] Channel ${callSid} no longer exists, skipping OpenAI send.`);

      return;
    }

    try {
      // Encode audio data to base64

      // Ensure the audioData format matches what OpenAI expects (e.g., ulaw often works)

      const base64Audio = audioData.toString('base64');

      if (base64Audio.length === 0) return; // Don't send empty chunks

      // Send to OpenAI service (asynchronously)

      openAIService.sendAudioChunk(callSid, base64Audio); // Removed await for non-blocking

      // logger.debug(`[ARI] Sent audio chunk to OpenAI for ${callSid}, size: ${audioData.length}`);
    } catch (err) {
      logger.error(`[ARI] Error encoding/sending audio to OpenAI for ${callSid}: ${err.message}`);
    }
  }

  /**

   * Handle audio received from OpenAI

   * @param {string} callSid - Channel ID

   * @param {string} audioBase64 - Base64 encoded audio

   */

  handleOpenAIAudio(callSid, audioBase64) {
    logger.info(`[ARI] Received audio from OpenAI for channel: ${callSid}, size: ${audioBase64.length}`);

    if (!audioBase64) {
      logger.warn(`[ARI] Empty audio received from OpenAI for channel: ${callSid}`);

      return;
    }

    // Play the audio to the channel

    this.playAudioToChannel(callSid, audioBase64);
  }

  /**

   * Clean up resources for a channel

   * @param {string} callSid - Channel ID

   * @returns {Promise<void>}

   */

  async cleanupChannel(callSid) {
    const channelData = this.channels.get(callSid);

    if (!channelData) {
      logger.warn(`[ARI] No data found for channel ${callSid} during cleanup`);

      return;
    }

    logger.info(`[ARI] Cleaning up channel: ${callSid}`);

    if (channelData && channelData.snoopChannel) {
      try {
        logger.info(`[ARI] Hanging up snoop channel ${channelData.snoopChannel.id}`);

        await channelData.snoopChannel.hangup();
      } catch (snoopErr) {
        logger.warn(`[ARI] Error hanging up snoop channel ${channelData.snoopChannel.id}: ${snoopErr.message}`);
      }
    }

    // Update conversation record

    try {
      if (channelData.conversationId) {
        await Conversation.findByIdAndUpdate(
          channelData.conversationId,

          {
            endTime: new Date(),

            status: 'completed',
          }
        );

        logger.info(`[ARI] Updated conversation record for ${callSid}`);
      }
    } catch (dbErr) {
      logger.error(`[ARI] Error updating conversation record: ${dbErr.message}`);
    }

    // Clean up bridge

    if (channelData.bridge) {
      try {
        await channelData.bridge.destroy();

        logger.info(`[ARI] Destroyed bridge ${channelData.bridgeId}`);
      } catch (err) {
        logger.warn(`[ARI] Error destroying bridge: ${err.message}`);
      }
    }

    // Hang up channel if still active

    try {
      if (channelData.channel && channelData.state !== 'destroyed') {
        await channelData.channel.hangup();

        logger.info(`[ARI] Hung up channel ${callSid}`);
      }
    } catch (err) {
      logger.warn(`[ARI] Error hanging up channel ${callSid}: ${err.message}`);
    }

    // Clean up OpenAI connection

    try {
      await openAIService.disconnect(callSid);

      logger.info(`[ARI] Disconnected OpenAI service for call: ${callSid}`);
    } catch (err) {
      logger.warn(`[ARI] Error cleaning up OpenAI connection: ${err.message}`);
    }

    // Remove from channels map

    this.channels.delete(callSid);

    logger.info(`[ARI] Completed cleanup for channel: ${callSid}`);
  }

  /**

   * Send audio data from Asterisk to OpenAI

   * @param {string} callSid - Channel ID

   * @param {Buffer} audioData - Raw audio data

   * @returns {Promise<void>}

   */

  async sendAudioToOpenAI(callSid, audioData) {
    try {
      // Encode audio data to base64 (assuming ulaw format)

      const base64Audio = audioData.toString('base64');

      // Send to OpenAI service

      await openAIService.sendAudioChunk(callSid, base64Audio);

      logger.debug(`[ARI] Sent audio chunk to OpenAI for ${callSid}`);
    } catch (err) {
      logger.error(`[ARI] Error sending audio to OpenAI: ${err.message}`);
    }
  }

  /**

   * Play audio from OpenAI to Asterisk channel

   * @param {string} callSid - Channel ID

   * @param {string} base64Audio - Base64 encoded audio

   * @returns {Promise<void>}

   */

  async playAudioToChannel(callSid, base64Audio) {
    const channelData = this.channels.get(callSid);

    if (!channelData || !channelData.channel) {
      logger.warn(`[ARI] Cannot play audio - invalid channel: ${callSid}`);

      return;
    }

    try {
      // Convert base64 to Buffer

      const audioBuffer = Buffer.from(base64Audio, 'base64');

      // Create a temporary file in /tmp

      const fs = require('fs');

      const os = require('os');

      const path = require('path');

      const soundId = `openai-${uuidv4()}`;

      const tempPath = path.join(os.tmpdir(), `${soundId}.ulaw`);

      // Write buffer to temporary file

      fs.writeFileSync(tempPath, audioBuffer);

      logger.debug(`[ARI] Saved audio to temp file: ${tempPath}`);

      // Upload sound to Asterisk

      try {
        await this.client.sounds.upload({
          name: soundId,

          format: 'ulaw',

          sound: tempPath,
        });

        logger.debug(`[ARI] Uploaded sound to Asterisk: ${soundId}`);

        // Play the sound on the channel

        await channelData.channel.play({
          media: `sound:${soundId}`,
        });

        logger.info(`[ARI] Playing sound ${soundId} to channel ${callSid}`);

        // Clean up temporary file

        fs.unlinkSync(tempPath);
      } catch (asteriskErr) {
        logger.error(`[ARI] Error with Asterisk sound: ${asteriskErr.message}`);

        // Alternative approach: play from file directly

        try {
          await channelData.channel.play({
            media: `sound:${tempPath}`,
          });

          logger.info(`[ARI] Played audio file directly to channel ${callSid}`);
        } catch (playErr) {
          logger.error(`[ARI] Error playing audio file: ${playErr.message}`);
        }
      }
    } catch (err) {
      logger.error(`[ARI] Error playing audio to channel: ${err.message}`);
    }
  }
}

// Create singleton instance

const ariClient = new AsteriskAriClient();

module.exports = {
  startAriClient: () => ariClient.start(),

  getAriClient: () => ariClient,
};
