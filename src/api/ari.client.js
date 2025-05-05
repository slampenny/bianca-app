const AriClient = require('ari-client');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs'); // Keep for audio playback
const os = require('os');   // Keep for audio playback
const path = require('path'); // Keep for audio playback

const config = require('../config/config');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
const { Conversation, Patient } = require('../models');
const channelTracker = require('./channel.tracker'); // Adjust path if needed


class AsteriskAriClient {
  constructor() {
      this.client = null;
      this.isConnected = false;
      // *** Use the Channel Tracker ***
      this.tracker = channelTracker;
      this.retryCount = 0;
      this.MAX_RETRIES = 10;
      this.RETRY_DELAY = 3000;
      global.ariClient = this; // For debugging (use with caution)

      // Define the arguments we'll pass to Stasis for the Local channel
      this.AUDIO_SOCKET_ARG = 'audiosocket_local_leg';
      // Define the context the Local channel originates into (must exist in extensions.conf)
      this.AUDIO_SOCKET_CONTEXT = 'internal-audiosocket-context';
      // Define the extension the Local channel continues to after Stasis
      this.AUDIO_SOCKET_EXTENSION = 'audiosocket'; // This extension runs AudioSocket()
  }

  async start() {
      try {
          logger.info('[ARI] Connecting to Asterisk ARI...');
          const ariUrl = config.asterisk.url || 'http://asterisk:8088';
          const username = config.asterisk.username || 'myphonefriend';
          const password = config.asterisk.password || 'changeme';
          logger.info(`[ARI] Attempting connection to ${ariUrl} with user: ${username}`);

          this.client = await AriClient.connect(ariUrl, username, password);
          this.isConnected = true;
          this.retryCount = 0;
          logger.info('[ARI] Successfully connected to Asterisk ARI');

          this.setupEventHandlers();

          // Start the application instance (subscribes to Stasis events)
          // Make sure the app name matches Stasis(app_name) in dialplan
          await this.client.start('myphonefriend');
          logger.info('[ARI] Subscribed to Stasis application: myphonefriend');

          // return this.client; // No longer returning client directly
      } catch (err) {
          logger.error(`[ARI] Connection error: ${err.message}`);
          this.isConnected = false; // Ensure flag is false on error
          // Retry logic... (keep existing retry logic)
          if (this.retryCount < this.MAX_RETRIES) {
              this.retryCount++;
              const delay = this.RETRY_DELAY * Math.pow(1.5, this.retryCount - 1);
              logger.info(`[ARI] Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
              setTimeout(() => { this.start(); }, delay);
          } else {
              logger.error(`[ARI] Failed to connect after ${this.MAX_RETRIES} attempts. Giving up.`);
          }
      }
  }

  setupEventHandlers() {
      if (!this.client) {
          logger.error('[ARI] Cannot set up event handlers: Client not initialized');
          return;
      }

      logger.info('[ARI] Setting up event handlers...');

      // --- StasisStart: Handles BOTH main calls and our originated Local channels ---
      this.client.on('StasisStart', async (event, channel) => {
          const channelId = channel.id;
          const appArgs = event.args || [];
          const channelName = channel.name || 'Unknown';

          logger.info(`[ARI] StasisStart event for channel ${channelId} (${channelName}), Args: ${JSON.stringify(appArgs)}`);

          // --- Case 1: Handle the originated Local channel for AudioSocket ---
          if (appArgs.includes(this.AUDIO_SOCKET_ARG)) {
              logger.info(`[ARI] Handling StasisStart for Local AudioSocket channel: ${channelId}`);

              // Extract the UUID from the channel name (e.g., Local/uuid@context/n)
              const nameMatch = channelName.match(/Local\/([^@]+)@/);
              const audioSocketUuid = nameMatch ? nameMatch[1] : null;

              if (!audioSocketUuid) {
                  logger.error(`[ARI] Could not extract UUID from Local channel name: ${channelName}. Hanging up.`);
                  await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up Local channel ${channelId}: ${e.message}`));
                  return;
              }

              // Find the original parent call using the UUID
              const parentChannelId = this.tracker.findParentChannelIdByUuid(audioSocketUuid);
              if (!parentChannelId) {
                  logger.error(`[ARI] No parent channel found for AudioSocket UUID: ${audioSocketUuid} (Local channel: ${channelId}). Hanging up.`);
                  // Log tracker state for debugging
                  logger.debug(`[Tracker UUID Map] ${JSON.stringify(Object.fromEntries(this.tracker.uuidToChannelId))}`);
                  logger.debug(`[Tracker Calls Map] ${JSON.stringify(Object.fromEntries(this.tracker.calls))}`);
                  await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up orphaned Local channel ${channelId}: ${e.message}`));
                  return;
              }

              // Get the parent call data, including the snoop bridge
              const parentCallData = this.tracker.getCall(parentChannelId);
               if (!parentCallData || !parentCallData.snoopBridge) {
                  logger.error(`[ARI] Parent channel data or snoop bridge missing for ${parentChannelId} (UUID: ${audioSocketUuid}, Local: ${channelId}). Hanging up Local channel.`);
                  await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up Local channel ${channelId} due to missing parent/bridge data: ${e.message}`));
                  return;
              }

              logger.info(`[ARI] Found parent channel ${parentChannelId} for Local channel ${channelId} (UUID: ${audioSocketUuid})`);

              // Update tracker: Store the Local channel object and ID
              this.tracker.updateCall(parentChannelId, {
                  localChannel: channel,
                  localChannelId: channelId,
                  state: 'local_stasis' // New state
              });

              try {
                  // Add the Local channel to the Snoop Bridge
                  logger.info(`[ARI] Adding Local channel ${channelId} to Snoop Bridge ${parentCallData.snoopBridge.id}`);
                  await parentCallData.snoopBridge.addChannel({ channel: channelId });
                  logger.info(`[ARI] Added Local channel ${channelId} to Snoop Bridge.`);

                  // Continue the Local channel in the dialplan to execute AudioSocket()
                  logger.info(`[ARI] Continuing Local channel ${channelId} in dialplan (${this.AUDIO_SOCKET_CONTEXT}, ${this.AUDIO_SOCKET_EXTENSION})`);
                  await channel.continueInDialplan({
                      context: this.AUDIO_SOCKET_CONTEXT,
                      extension: this.AUDIO_SOCKET_EXTENSION,
                      priority: 1 // Start at priority 1 of the target extension
                  });
                  logger.info(`[ARI] Local channel ${channelId} sent to execute AudioSocket.`);
                  this.tracker.updateCall(parentChannelId, { state: 'audiosocket_running' });

              } catch (err) {
                   logger.error(`[ARI] Error handling Local channel ${channelId}: ${err.message}`, err);
                   // Attempt cleanup of the parent call if local channel setup fails
                   await this.cleanupChannel(parentChannelId, `Local channel ${channelId} setup failed`);
              }

          // --- Case 2: Handle a regular incoming call ---
          } else {
              logger.info(`[ARI] Handling StasisStart for Main incoming channel: ${channelId}`);
              let callSid = null; // Use Twilio SID if available
              let patientId = null;

              // Extract patientId/callSid from URIOPTS (same logic as V1)
               try {
                  const channelVars = await channel.getChannelVar({ variable: 'URIOPTS' });
                  if (channelVars.value) {
                      logger.info(`[ARI] URI options for ${channelId}: ${channelVars.value}`);
                      const uriOpts = channelVars.value.split('&').reduce((opts, pair) => {
                          const [key, value] = pair.split('=');
                          if (key && value) opts[key] = decodeURIComponent(value);
                          return opts;
                      }, {});
                      patientId = uriOpts.patientId || patientId; // Allow override
                      callSid = uriOpts.callSid ? uriOpts.callSid.trim() : callSid;
                      logger.info(`[ARI] Extracted from URI: patientId=${patientId}, callSid=${callSid}`);
                  }
               } catch (err) {
                  // Log if URIOPTS not found, but don't fail the call
                  logger.warn(`[ARI] URIOPTS variable not found or failed to parse for ${channelId}: ${err.message}`);
               }

               // Add to tracker
               this.tracker.addCall(channelId, {
                   channel: channel,
                   twilioSid: callSid,
                   patientId: patientId,
                   state: 'stasis_start'
               });

               // Handle the main call flow
               try {
                  logger.info(`[ARI] Answering main channel: ${channelId}`);
                  await channel.answer();
                  this.tracker.updateCall(channelId, { state: 'answered' });
                  logger.info(`[ARI] Answered main channel: ${channelId}`);

                  // --- Simple Playback Test (Beep) ---
                  // Keep this to ensure basic channel control works
                  try {
                      logger.info(`[ARI DEBUG] Attempting beep playback on ${channelId}...`);
                      const playback = await channel.play({ media: 'sound:beep' });
                      logger.info(`[ARI DEBUG] Beep playback command sent (ID: ${playback.id})`);
                      playback.once('PlaybackFailed', (_, inst) => logger.error(`[ARI DEBUG] Beep Playback ${inst.id} failed!`));
                      playback.once('PlaybackFinished', (_, inst) => logger.info(`[ARI DEBUG] Beep Playback ${inst.id} finished.`));
                  } catch (playErr) {
                      logger.error(`[ARI DEBUG] Failed to initiate beep playback: ${playErr.message}`);
                  }
                  // --- End Beep Test ---

                  // Setup the main bridge, recording, OpenAI, and initiate snooping
                  await this.setupMediaPipeline(channel, callSid, patientId);
                  // State might be updated further within setupMediaPipeline

               } catch (err) {
                  logger.error(`[ARI] Error handling main channel ${channelId} setup: ${err.message}`, err);
                  await this.cleanupChannel(channelId, `Main channel setup failed`);
               }
          }
      });

      // --- StasisEnd: Channel leaving the Stasis app ---
      this.client.on('StasisEnd', async (event, channel) => {
          const channelId = channel.id;
          logger.info(`[ARI] StasisEnd event for channel: ${channelId}`);
          // This often means the channel was hung up or moved out of the app.
          // Cleanup might have already been triggered by ChannelDestroyed/HangupRequest,
          // but we can trigger it here defensively if the channel is still tracked.
          const callData = this.tracker.getCall(channelId);
          if (callData) {
              logger.warn(`[ARI] StasisEnd for tracked main channel ${channelId}. Initiating cleanup.`);
              await this.cleanupChannel(channelId, "StasisEnd received"); // No await needed here
          } else {
               // Check if it's a tracked Local channel ending stasis
              this.tracker.calls.forEach(call => {
                   if(call.localChannelId === channelId) {
                       logger.warn(`[ARI] StasisEnd for tracked Local channel ${channelId}. Parent: ${call.asteriskChannelId}. Local channel likely hung up.`);
                       // Don't necessarily clean up the whole call here, just note the local channel ended.
                       // Update state if needed:
                       // this.tracker.updateCall(call.asteriskChannelId, { localChannel: null, localChannelId: null });
                   }
               });
          }
      });

      // --- ChannelDestroyed: Channel has been destroyed ---
      this.client.on('ChannelDestroyed', async (event, channel) => {
          const channelId = channel.id;
          logger.info(`[ARI] ChannelDestroyed event for channel: ${channelId}`);
          // This is a definitive end event. Ensure cleanup.
          const callData = this.tracker.getCall(channelId);
           if (callData) {
              logger.info(`[ARI] ChannelDestroyed for tracked main channel ${channelId}. Initiating cleanup.`);
              await this.cleanupChannel(channelId, "ChannelDestroyed received"); // No await needed here
           } else {
               // Check if it's a tracked Local or Snoop channel
               this.tracker.calls.forEach(call => {
                  if(call.localChannelId === channelId) {
                      logger.info(`[ARI] ChannelDestroyed for tracked Local channel ${channelId}. Parent: ${call.asteriskChannelId}.`);
                       // Update state, maybe don't cleanup parent unless parent is also destroyed
                       // this.tracker.updateCall(call.asteriskChannelId, { localChannel: null, localChannelId: null });
                  } else if (call.snoopChannelId === channelId) {
                       logger.info(`[ARI] ChannelDestroyed for tracked Snoop channel ${channelId}. Parent: ${call.asteriskChannelId}.`);
                       // Update state
                       // this.tracker.updateCall(call.asteriskChannelId, { snoopChannel: null, snoopChannelId: null });
                  }
               });
           }
      });

      // Handle explicit hangup requests (less common in Stasis apps)
      this.client.on('ChannelHangupRequest', async (event, channel) => {
           const channelId = channel.id;
           logger.info(`[ARI] ChannelHangupRequest event for channel: ${channelId}. Cause: ${event.cause}`);
           const callData = this.tracker.getCall(channelId);
           if (callData) {
               logger.info(`[ARI] HangupRequest for tracked main channel ${channelId}. Initiating cleanup.`);
               await this.cleanupChannel(channelId, `HangupRequest, Cause: ${event.cause_txt || event.cause}`); // No await needed here
           }
           // Potentially handle hangups for Local/Snoop channels if needed
      });

       // Handle DTMF (If needed)
      this.client.on('ChannelDtmfReceived', (event, channel) => {
          const digit = event.digit;
          const channelId = channel.id;
          logger.info(`[ARI] DTMF '${digit}' received on ${channelId}`);
          // If DTMF comes from the main channel, find its call data
          const callData = this.tracker.getCall(channelId);
          if(callData && callData.twilioSid) {
               // Forward to OpenAI or handle locally
               // openAIService.sendDtmf(callData.twilioSid, digit); // Example
               logger.info(`[ARI] Forwarding DTMF '${digit}' for call ${callData.twilioSid || channelId}`);
          } else {
              logger.warn(`[ARI] Received DTMF '${digit}' on untracked or unidentified channel ${channelId}`);
          }
      });

      // Handle client errors
      this.client.on('error', (err) => {
          logger.error(`[ARI] Client WebSocket Error: ${err.message}`, err);
          // Consider triggering reconnection logic or shutdown
          this.isConnected = false; // Mark as disconnected
          // Maybe call start() again after a delay? Be careful of loops.
          logger.info('[ARI] Attempting to reconnect after error...');
          // Simple immediate retry (consider backoff like in initial connect)
          setTimeout(() => {
              if (!this.isConnected) { // Check if already reconnected
                  this.start();
              }
          }, this.RETRY_DELAY);
      });

      logger.info('[ARI] Event handlers set up successfully.');
  }

  /**
   * Set up the main bridge, recording, OpenAI connection, and initiate snooping.
   */
  async setupMediaPipeline(channel, callSid, patientId) {
      const asteriskChannelId = channel.id;
      logger.info(`[ARI] Setting up media pipeline for ${asteriskChannelId}`);
      this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_setup' });

      let mainBridge = null;
      let conversation = null; // Mongoose conversation object

      try {
          // --- Find or create DB conversation record ---
          // Use Twilio SID if available, otherwise Asterisk Channel ID
          const conversationSid = callSid || asteriskChannelId;
          logger.info(`[ARI] Finding/Creating DB conversation for SID: ${conversationSid}`);
          const conversationData = {
              callSid: conversationSid,
              asteriskChannelId: asteriskChannelId, // Store Asterisk ID too
              startTime: new Date(),
              callType: 'asterisk-call',
              status: 'active',
              patientId: null // Default to null
          };

          if (patientId) {
              const patient = await Patient.findById(patientId).select('_id name').lean().catch(() => null);
              if (patient) {
                  logger.info(`[ARI] Found patient ${patient.name}. Linking conversation.`);
                  conversationData.patientId = patient._id;
              } else {
                  logger.warn(`[ARI] Patient ${patientId} not found in DB.`);
                  // Update tracker if needed, though patientId was passed in
                  this.tracker.updateCall(asteriskChannelId, { patientId: null });
              }
          }

          // Use findOneAndUpdate upsert for robustness
          conversation = await Conversation.findOneAndUpdate(
              { callSid: conversationSid },
              { $setOnInsert: conversationData },
              { new: true, upsert: true, runValidators: true }
          ).catch(dbErr => {
              logger.error(`[ARI] Failed to save/update Conversation: ${dbErr.message}`);
              return null;
          });

          const conversationId = conversation ? conversation._id.toString() : null;
          if (conversationId) {
              logger.info(`[ARI] Conversation ${conversationId} saved/found.`);
              this.tracker.updateCall(asteriskChannelId, { conversationId: conversationId });
          } else {
              logger.warn('[ARI] Proceeding without a saved conversation record due to DB error.');
              this.tracker.updateCall(asteriskChannelId, { conversationId: null });
          }
          // --- End DB Conversation ---


          // --- Create Main Bridge ---
          logger.info(`[ARI] Creating main bridge for ${asteriskChannelId}...`);
          const mainBridgeId = `bridge-${uuidv4()}`;
          mainBridge = await this.client.bridges.create({ type: 'mixing', bridgeId: mainBridgeId, name: `call-${asteriskChannelId}` });
          logger.info(`[ARI] Main Bridge ${mainBridge.id} created.`);
          this.tracker.updateCall(asteriskChannelId, { mainBridge: mainBridge, mainBridgeId: mainBridge.id, state: 'main_bridged' });
          // --- End Main Bridge ---


          // --- Start Main Bridge Recording ---
          const recordingName = `recording-${asteriskChannelId}`;
          try {
              logger.info(`[ARI] Starting recording for MAIN BRIDGE ${mainBridge.id}...`);
              await mainBridge.record({
                  name: recordingName,
                  format: 'wav', // Choose desired format
                  maxDurationSeconds: 3600,
                  beep: false,
                  ifExists: 'overwrite',
              });
              logger.info(`[ARI] Main bridge recording started as ${recordingName}.`);
              this.tracker.updateCall(asteriskChannelId, { recordingName: recordingName });
          } catch (recordErr) {
              logger.error(`[ARI] Main bridge.record failed: ${recordErr.message}`);
              // Continue without recording?
          }
          // --- End Main Bridge Recording ---


          // --- Add Main Channel to Main Bridge ---
          logger.info(`[ARI] Adding main channel ${asteriskChannelId} to main bridge ${mainBridge.id}...`);
          await mainBridge.addChannel({ channel: asteriskChannelId });
          logger.info(`[ARI] Main channel ${asteriskChannelId} added to main bridge.`);
          // --- End Add Main Channel ---


          // --- Connect to OpenAI ---
          let initialPrompt = "You are Bianca, a helpful AI assistant from the patient's care team.";
          // ... customize prompt based on patientId or other data ...
          logger.info(`[ARI] Initializing OpenAI for call SID: ${callSid || asteriskChannelId} (ConvID: ${conversationId || 'None'})...`);
          try {
              // Pass Twilio SID if available, otherwise Asterisk ID
              await openAIService.initialize(callSid || asteriskChannelId, conversationId, initialPrompt);
              logger.info(`[ARI] OpenAI initialized.`);

              // Set callback for receiving audio FROM OpenAI to play TO Asterisk
              openAIService.setNotificationCallback((cbCallSid, type, data) => {
                  // Ensure callback is for the correct call (using Twilio SID preferably)
                  const currentCallData = this.tracker.getCall(asteriskChannelId);
                  if (!currentCallData) return; // Call already cleaned up

                  const expectedSid = currentCallData.twilioSid || currentCallData.asteriskChannelId;

                  if (cbCallSid === expectedSid && type === 'audio_chunk' && data?.audio) {
                      this.handleOpenAIAudio(asteriskChannelId, data.audio); // Use Asterisk ID for playback
                  }
                  // Add handlers for other notification types if needed
              });
              logger.info(`[ARI] OpenAI notification callback set.`);

          } catch (openAiErr) {
              logger.error(`[ARI] openAIService.initialize failed: ${openAiErr.message}`);
              // Decide if call should continue without AI
          }
          // --- End Connect to OpenAI ---


          // --- Initiate Snoop and AudioSocket ---
          logger.info(`[ARI] Initiating Snoop and AudioSocket setup for ${asteriskChannelId}...`);
          // We don't await this, as it involves async steps including originating a new channel
          this.initiateSnoopAndAudioSocket(asteriskChannelId, channel)
              .catch(snoopErr => {
                   logger.error(`[ARI] Failed to initiate snoop/audiosocket for ${asteriskChannelId}: ${snoopErr.message}`);
                   // Decide how to handle this - maybe update state, but likely let call continue without audio capture
                   this.tracker.updateCall(asteriskChannelId, { state: 'snoop_failed' });
              });
          // --- End Initiate Snoop ---

          logger.info(`[ARI] Media pipeline setup phase completed for ${asteriskChannelId}. Waiting for Local channel/AudioSocket.`);
          // Final state update? Maybe 'pipeline_active' or wait for 'audiosocket_running'
          this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_active' });

      } catch (err) {
          logger.error(`[ARI] Error during setupMediaPipeline for ${asteriskChannelId}: ${err.message}`, err);
          // Ensure cleanup happens by throwing the error to the StasisStart handler's catch block
          throw err; // Re-throw
      }
  }


  /**
   * Creates snoop channel, snoop bridge, and originates the Local channel for AudioSocket.
   * Does NOT wait for the Local channel to enter Stasis.
   */
  async initiateSnoopAndAudioSocket(asteriskChannelId, mainChannel) {
       logger.info(`[Snoop Setup] Starting for ${asteriskChannelId}`);
       let snoopChannel = null;
       let snoopBridge = null;
       const audioSocketUuid = uuidv4();

       try {
           // 1. Store UUID and mapping in tracker *before* originating
           this.tracker.addAudioSocketMapping(asteriskChannelId, audioSocketUuid);

           // 2. Create Snoop Channel (spying on incoming audio to the main channel)
           const snoopId = `snoop-${uuidv4()}`;
           logger.info(`[Snoop Setup] Creating snoop channel '${snoopId}' spying 'in' on ${asteriskChannelId}`);
           snoopChannel = await this.client.channels.snoopChannel({
               channelId: asteriskChannelId,
               snoopId: snoopId,
               spy: 'in', // Listen to audio received BY the main channel (caller's voice)
               app: 'myphonefriend', // Send snoop channel events (like hangup) to our app too
               // appArgs: `snoop_leg,${asteriskChannelId}` // Optional args to identify snoop channel in StasisStart if needed
           });
           logger.info(`[Snoop Setup] Created snoop channel ${snoopChannel.id}`);
           this.tracker.updateCall(asteriskChannelId, { snoopChannel: snoopChannel, snoopChannelId: snoopChannel.id });

           // 3. Create Snoop Bridge
           const snoopBridgeId = `snoop-bridge-${uuidv4()}`;
           logger.info(`[Snoop Setup] Creating snoop bridge ${snoopBridgeId}`);
           snoopBridge = await this.client.bridges.create({ type: 'mixing', bridgeId: snoopBridgeId, name: `snoop-bridge-${asteriskChannelId}` });
           logger.info(`[Snoop Setup] Created snoop bridge ${snoopBridge.id}`);
           this.tracker.updateCall(asteriskChannelId, { snoopBridge: snoopBridge, snoopBridgeId: snoopBridge.id });

           // 4. Add Snoop Channel to Snoop Bridge
           logger.info(`[Snoop Setup] Adding snoop channel ${snoopChannel.id} to snoop bridge ${snoopBridge.id}`);
           await snoopBridge.addChannel({ channel: snoopChannel.id });
           logger.info(`[Snoop Setup] Added snoop channel to snoop bridge.`);

           // 5. Originate Local Channel (this is asynchronous)
           const localEndpoint = `Local/${audioSocketUuid}@${this.AUDIO_SOCKET_CONTEXT}`;
           logger.info(`[Snoop Setup] Originating Local channel -> ${localEndpoint} into Stasis app 'myphonefriend' with arg '${this.AUDIO_SOCKET_ARG}'`);

           // We don't await the promise here, but handle errors via .catch
           this.client.channels.originate({
               endpoint: localEndpoint,
               app: 'myphonefriend', // Use the app name ARI client registered with
               appArgs: this.AUDIO_SOCKET_ARG, // Argument to identify this in StasisStart
               // callerId: `AudioSocket <${asteriskChannelId}>`, // Optional Caller ID for Local channel
               // timeout: 10 // Optional timeout for originate
           })
           .then(originatedLocalChannel => {
               // Note: This originatedLocalChannel object might be limited.
               // The full channel object arrives in the StasisStart event.
               logger.info(`[Snoop Setup] Originate request successful for ${localEndpoint}. Potential Local ID: ${originatedLocalChannel.id}. Waiting for StasisStart.`);
               // Optionally store the pending ID if needed:
               // this.tracker.updateCall(asteriskChannelId, { pendingLocalId: originatedLocalChannel.id });
           })
           .catch(originateErr => {
               // This catches errors in the originate *request* itself.
               // Failure of the originated channel *later* won't be caught here.
               logger.error(`[Snoop Setup] Failed to originate Local channel for ${asteriskChannelId}: ${originateErr.message}`, originateErr);
               // Clean up snoop channel/bridge if originate fails? This is tricky.
               // Maybe just log and let subsequent cleanup handle it.
               this.tracker.updateCall(asteriskChannelId, { state: 'originate_failed' });
               // Consider cleaning up snoop resources immediately:
               // if (snoopChannel) snoopChannel.hangup().catch(()=>{});
               // if (snoopBridge) snoopBridge.destroy().catch(()=>{});
           });

           logger.info(`[Snoop Setup] Snoop/AudioSocket initiation steps complete for ${asteriskChannelId}.`);
           this.tracker.updateCall(asteriskChannelId, { state: 'snooping_initiated' });

       } catch (err) {
           logger.error(`[Snoop Setup] Error during snoop/originate for ${asteriskChannelId}: ${err.message}`, err);
            // Attempt cleanup of any resources created so far in this function
            if (snoopChannel) {
               await snoopChannel.hangup().catch(e => logger.warn(`[Snoop Setup Cleanup] Error hanging up snoop channel: ${e.message}`));
            }
            if (snoopBridge) {
               await snoopBridge.destroy().catch(e => logger.warn(`[Snoop Setup Cleanup] Error destroying snoop bridge: ${e.message}`));
            }
            // Rethrow error to be caught by setupMediaPipeline caller
            throw err;
       }
  }


  /**
   * Handles playing audio received FROM OpenAI back TO the main Asterisk channel.
   * Uses the sound upload method from Version 1.
   */
  handleOpenAIAudio(asteriskChannelId, audioBase64) {
      if (!audioBase64) {
          logger.warn(`[ARI] Empty audio received from OpenAI for channel: ${asteriskChannelId}`);
          return;
      }
      logger.info(`[ARI] Received audio from OpenAI for channel: ${asteriskChannelId}, size: ${audioBase64.length}`);
      // Play the audio to the main channel associated with this ID
      this.playAudioToChannel(asteriskChannelId, audioBase64);
  }

  /**
   * Plays audio (base64) to the specified main Asterisk channel.
   * Uses the temp file + sounds.upload approach from Version 1.
   */
  async playAudioToChannel(asteriskChannelId, base64Audio) {
      const callData = this.tracker.getCall(asteriskChannelId);
      if (!callData || !callData.mainChannel) {
          logger.warn(`[ARI Playback] Cannot play audio - main channel not found in tracker for ID: ${asteriskChannelId}`);
          return;
      }
      const mainChannel = callData.mainChannel;

      // Rest of this function is identical to the V1 playback logic provided previously...
      // (Using temp file, sound upload, fallback, cleanup)
      // ... see the previous response for the full playback code ...

      // --- Paste the full playAudioToChannel implementation from the previous response here ---
      // --- Start Paste ---
       try {
          const audioBuffer = Buffer.from(base64Audio, 'base64');
          if (audioBuffer.length === 0) {
              logger.warn(`[ARI Playback] Empty audio buffer for ${asteriskChannelId}, skipping.`);
              return;
          }
          const soundId = `openai-${uuidv4()}`;
          const tempPath = path.join(os.tmpdir(), `${soundId}.ulaw`); // Assuming ulaw

          try {
              fs.writeFileSync(tempPath, audioBuffer);
              logger.debug(`[ARI Playback] Saved audio to temp file: ${tempPath}`);
          } catch (writeErr) {
              logger.error(`[ARI Playback] Failed to write temp audio file ${tempPath}: ${writeErr.message}`);
              return;
          }

          let playbackInitiated = false;
          try {
              logger.debug(`[ARI Playback] Uploading sound ${soundId} (ulaw) from ${tempPath}`);
              await this.client.sounds.upload({ soundId: soundId, format: 'ulaw', sound: tempPath });
              logger.debug(`[ARI Playback] Uploaded sound ${soundId}. Playing sound:${soundId}`);

              const playback = await mainChannel.play({ media: `sound:${soundId}`});
              playbackInitiated = true;
              logger.info(`[ARI Playback] Playing uploaded sound ${soundId} to ${asteriskChannelId}`);

              playback.once('PlaybackFinished', () => logger.info(`[ARI Playback] Finished uploaded sound ${soundId} on ${asteriskChannelId}.`));
              playback.once('PlaybackFailed', (_, inst) => logger.error(`[ARI Playback] Failed playing uploaded sound ${soundId} on ${asteriskChannelId}: ${inst.playback.reason}`));

          } catch (uploadErr) {
              logger.error(`[ARI Playback] Error uploading/playing sound ${soundId}: ${uploadErr.message}. Falling back to file.`);
              try {
                  const playback = await mainChannel.play({ media: `sound:${tempPath}`});
                  playbackInitiated = true;
                  logger.info(`[ARI Playback] Playing directly from file ${tempPath} to ${asteriskChannelId}`);
                  playback.once('PlaybackFinished', () => logger.info(`[ARI Playback] Finished file playback ${tempPath} on ${asteriskChannelId}.`));
                  playback.once('PlaybackFailed', (_, inst) => logger.error(`[ARI Playback] Failed playing file ${tempPath} on ${asteriskChannelId}: ${inst.playback.reason}`));
              } catch (playFileErr) {
                  logger.error(`[ARI Playback] Fallback play from file ${tempPath} also failed: ${playFileErr.message}`);
              }
          } finally {
               if (fs.existsSync(tempPath)) {
                   fs.unlink(tempPath, (unlinkErr) => {
                      if (unlinkErr) logger.warn(`[ARI Playback] Error deleting temp file ${tempPath}: ${unlinkErr.message}`);
                      else logger.debug(`[ARI Playback] Deleted temp file: ${tempPath}`);
                  });
               }
          }
       } catch (err) {
           logger.error(`[ARI Playback] General error playing audio for ${asteriskChannelId}: ${err.message}`, err);
       }
      // --- End Paste ---

  }

   /**
    * Clean up all resources associated with a call.
    * @param {string} asteriskChannelId - The ID of the main Asterisk channel for the call.
    * @param {string} reason - Optional reason for logging.
    */
  async cleanupChannel(asteriskChannelId, reason = "Unknown") {
      logger.info(`[Cleanup] Initiating cleanup for ${asteriskChannelId}. Reason: ${reason}`);

      // Get all associated resources from the tracker
      const resources = this.tracker.getResources(asteriskChannelId);

      // Remove from tracker *first* to prevent race conditions with new events
      const removed = this.tracker.removeCall(asteriskChannelId);
      if (!removed) {
           // If already removed (e.g., cleanup called twice), check if resources object was retrieved before removal
           if(!resources) {
                logger.warn(`[Cleanup] Call ${asteriskChannelId} not found in tracker or already cleaned up.`);
                return; // Nothing more to do
           }
           logger.warn(`[Cleanup] Call ${asteriskChannelId} was already removed from tracker, but attempting resource cleanup.`);
      }

      // Safely hangup/destroy each resource if it exists
      const safeHangup = async (channel, type) => {
          if (channel && typeof channel.hangup === 'function') {
              try {
                  logger.info(`[Cleanup] Hanging up ${type} channel ${channel.id} for parent ${asteriskChannelId}`);
                  await channel.hangup();
              } catch (e) {
                  // Ignore errors if channel is already gone (e.g., code 404)
                  if (!e.message || !e.message.includes(' 404 ')) {
                      logger.warn(`[Cleanup] Error hanging up ${type} channel ${channel.id}: ${e.message}`);
                  }
              }
          }
      };

      const safeDestroy = async (bridge, type) => {
          if (bridge && typeof bridge.destroy === 'function') {
              try {
                  logger.info(`[Cleanup] Destroying ${type} bridge ${bridge.id} for parent ${asteriskChannelId}`);
                  await bridge.destroy();
              } catch (e) {
                   if (!e.message || !e.message.includes(' 404 ')) {
                       logger.warn(`[Cleanup] Error destroying ${type} bridge ${bridge.id}: ${e.message}`);
                   }
              }
          }
      };

      // Perform cleanup actions asynchronously but wait for all
      await Promise.allSettled([
          // Hangup channels first
          safeHangup(resources.localChannel, 'Local'),
          safeHangup(resources.snoopChannel, 'Snoop'),
          safeHangup(resources.mainChannel, 'Main'), // Hangup main channel last? Or after local/snoop?
          // Then destroy bridges
          safeDestroy(resources.snoopBridge, 'Snoop'),
          safeDestroy(resources.mainBridge, 'Main'),
          // Disconnect OpenAI
          (async () => {
              const sidToDisconnect = resources.twilioSid || resources.asteriskChannelId;
               if (sidToDisconnect) {
                   try {
                      logger.info(`[Cleanup] Disconnecting OpenAI service for call SID: ${sidToDisconnect}`);
                      await openAIService.disconnect(sidToDisconnect);
                   } catch(e) {
                      logger.warn(`[Cleanup] Error disconnecting OpenAI for ${sidToDisconnect}: ${e.message}`);
                   }
               }
          })(),
          // Update DB conversation status
          (async () => {
               if (resources.conversationId) {
                   try {
                       logger.info(`[Cleanup] Updating conversation ${resources.conversationId} status to completed.`);
                       await Conversation.findByIdAndUpdate(resources.conversationId, {
                           status: 'completed',
                           endTime: new Date(),
                       });
                   } catch (e) {
                       logger.error(`[Cleanup] Error updating conversation ${resources.conversationId}: ${e.message}`);
                   }
               }
          })()
      ]);

      logger.info(`[Cleanup] Completed cleanup operations for ${asteriskChannelId}`);
  }

   /**
    * !! IMPORTANT !! Audio Input Handling Placeholder
    * This function needs to be called by your SEPARATE WebSocket client
    * that connects to the AudioSocket feed from Asterisk.
    */
   handleAudioSocketData(audioSocketUuid, audioDataBuffer) {
       const parentChannelId = this.tracker.findChannelIdByUuid(audioSocketUuid);
       if (!parentChannelId) {
           logger.warn(`[Audio Input] Received audio data for unknown UUID: ${audioSocketUuid}`);
           // Maybe close this specific WebSocket connection?
           return;
       }

       const callData = this.tracker.getCall(parentChannelId);
       if (!callData) {
            logger.warn(`[Audio Input] Received audio data for UUID ${audioSocketUuid}, but parent channel ${parentChannelId} not tracked.`);
            return;
       }

       // logger.debug(`[Audio Input] Received ${audioDataBuffer.length} bytes for ${parentChannelId} via UUID ${audioSocketUuid}`);

       // Encode and send to OpenAI
       try {
           const base64Audio = audioDataBuffer.toString('base64');
           if (base64Audio.length > 0) {
               const sidToSend = callData.twilioSid || callData.asteriskChannelId;
               // Note: Assuming openAIService uses the SID (Twilio or Asterisk)
               openAIService.sendAudioChunk(sidToSend, base64Audio);
           }
       } catch (err) {
           logger.error(`[Audio Input] Error encoding/sending audio chunk for ${parentChannelId}: ${err.message}`);
       }
   }

} // End AsteriskAriClient Class

// --- Singleton Instance ---
const ariClientInstance = new AsteriskAriClient();

module.exports = {
  startAriClient: () => ariClientInstance.start(),
  getAriClient: () => ariClientInstance, // Might not be needed externally often
  // Expose the audio input handler if your WebSocket client is in another module
  handleAudioSocketData: (uuid, buffer) => ariClientInstance.handleAudioSocketData(uuid, buffer),
};