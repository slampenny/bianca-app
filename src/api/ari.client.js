// src/services/ari.client.js

const AriClient = require('ari-client');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');
const path = require('path');
// No prism needed here
const config = require('../config/config');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
const { Conversation, Patient } = require('../models');
const channelTracker = require('./channel.tracker');
const rtpListenerService = require('./rtp.listener.service'); // To call removeSsrcMapping

class AsteriskAriClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.tracker = channelTracker;
        this.retryCount = 0;
        this.MAX_RETRIES = 10;
        this.RETRY_DELAY = 3000;
        global.ariClient = this;

        // --- Configuration for ExternalMedia ---
        this.RTP_LISTENER_HOST = 'bianca-app';
        this.RTP_LISTENER_PORT = 5061; // Use the non-conflicting port
        this.RTP_SEND_FORMAT = 'slin'; // Asterisk sends 8k SLIN
        // --- End ExternalMedia Config ---
    }

    async start() {
        // ... (start method remains the same) ...
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

             await this.client.start('myphonefriend');
             logger.info('[ARI] Subscribed to Stasis application: myphonefriend');

         } catch (err) {
              logger.error(`[ARI] Connection error: ${err.message}`);
              this.isConnected = false;
              if (this.retryCount < this.MAX_RETRIES) {
                  this.retryCount++;
                  const delay = this.RETRY_DELAY * Math.pow(1.5, this.retryCount - 1);
                  logger.info(`[ARI] Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  return this.start();
              } else {
                  const finalErrorMsg = `[ARI] Failed to connect after ${this.MAX_RETRIES} attempts. Last error: ${err.message}. Giving up.`;
                  logger.error(finalErrorMsg);
                  throw new Error(finalErrorMsg);
              }
         }
    }

    setupEventHandlers() {
        if (!this.client) { /* ... error ... */ return; }
        logger.info('[ARI] Setting up event handlers...');

        this.client.on('StasisStart', async (event, channel) => {
            const channelId = channel.id;
            const appArgs = event.args || [];
            const channelName = channel.name || 'Unknown';
            logger.info(`[ARI] StasisStart event for ${channelId} (${channelName}), Args: ${JSON.stringify(appArgs)}`);

            let isSnoopChannelForExtMedia = false;
            let parentCallId = null;
            for (const [mainCallId, callData] of this.tracker.calls.entries()) {
                if (callData.snoopChannelId === channelId && callData.snoopMethod === 'externalMedia') {
                    isSnoopChannelForExtMedia = true;
                    parentCallId = mainCallId;
                    break;
                }
            }

            if (isSnoopChannelForExtMedia) {
                logger.info(`[ARI] StasisStart for ExternalMedia snoop channel: ${channelId} (Parent: ${parentCallId})`);
                try {
                     await channel.answer();
                     logger.info(`[ARI] Answered snoop channel ${channelId}. Starting ExternalMedia.`);
                     const rtpDest = `${this.RTP_LISTENER_HOST}:${this.RTP_LISTENER_PORT}`;

                     // *** FIX: Re-add the 'app' parameter, using our main app name ***
                     await channel.externalMedia({
                         app: 'myphonefriend', // Required by ari-client, send internal RTP channel here
                         external_host: rtpDest,
                         format: this.RTP_SEND_FORMAT, // 'slin'
                         direction: 'read',
                     });
                     logger.info(`[ARI] ExternalMedia started for snoop ${channelId} -> ${rtpDest}`);
                     // Update state to indicate waiting for SSRC (RTP listener will update further)
                     this.tracker.updateCall(parentCallId, { state: 'external_media_active_awaiting_ssrc' });

                } catch (err) {
                     logger.error(`[ARI] Failed to start ExternalMedia on snoop ${channelId}: ${err.message}`, err);
                     if (parentCallId) await this.cleanupChannel(parentCallId, `ExternalMedia setup failed for snoop ${channelId}`);
                     else await channel.hangup().catch(()=>{});
                }
            } else if (channelName.startsWith('Local/')) {
                 logger.warn(`[ARI] StasisStart for unexpected Local channel ${channelId}. Hanging up.`);
                 await channel.hangup().catch(()=>{});
            } else if (channelName.startsWith('UnicastRTP/')) {
                 logger.info(`[ARI] StasisStart for internal UnicastRTP channel ${channelId} used by ExternalMedia. Ignoring.`);
                 // We don't need to do anything with this channel in Stasis.
            }
            else { // Main incoming channel
                logger.info(`[ARI] Handling StasisStart for Main incoming channel: ${channelId}`);
                let twilioCallSid = null; // Declared with let
                let patientId = null;     // Declared with let

                try { // Parse URIOPTS
                    const channelVars = await channel.getChannelVar({ variable: 'URIOPTS' });
                    if (channelVars?.value) {
                        const uriOpts = channelVars.value.split('&').reduce((opts, pair) => {
                             const [key, value] = pair.split('=');
                             if (key && value) opts[decodeURIComponent(key)] = decodeURIComponent(value);
                             return opts;
                         }, {});
                        if (uriOpts.patientId) patientId = uriOpts.patientId; // Assign to declared variable
                        if (uriOpts.callSid) twilioCallSid = uriOpts.callSid; // Assign to declared variable
                        logger.info(`[ARI] From URIOPTS for ${channelId}: patientId=${patientId}, twilioCallSid=${twilioCallSid}`);
                    } else { logger.warn(`[ARI] URIOPTS variable not found or empty for ${channelId}.`); }
                } catch (err) { logger.warn(`[ARI] Error parsing URIOPTS for ${channelId}: ${err.message}`); }

                const asteriskChannelId = channelId;

                // Debugging logs added previously (can be removed later)
                logger.debug(`[ARI DEBUG] Before addCall for ${asteriskChannelId}: twilioCallSid type = ${typeof twilioCallSid}, value = ${twilioCallSid}`);
                logger.debug(`[ARI DEBUG] Before addCall for ${asteriskChannelId}: patientId type = ${typeof patientId}, value = ${patientId}`);

                // *** FIX: Ensure correct variable names are used here ***
                this.tracker.addCall(asteriskChannelId, {
                    channel: channel,
                    twilioSid: twilioCallSid, // Use the variable holding the SID
                    patientId: patientId,     // Use the variable holding the patientId
                    state: 'stasis_start'
                });

                try {
                    await channel.answer();
                    this.tracker.updateCall(asteriskChannelId, { state: 'answered' });
                    logger.info(`[ARI] Answered main channel: ${asteriskChannelId}`);
                    try { // Main beep test
                        const playback = await channel.play({ media: 'sound:beep' });
                        playback.once('PlaybackFinished', (_, inst) => logger.info(`[ARI DEBUG] Main Beep ${inst.id} finished.`));
                        playback.once('PlaybackFailed', (_, inst) => logger.error(`[ARI DEBUG] Main Beep ${inst.id} FAILED! ${inst.playback?.reason || 'Unknown'}`));
                    } catch (playErr) { logger.error(`[ARI DEBUG] Error playing main beep: ${playErr.message}`); }

                    await this.setupMediaPipeline(channel, twilioCallSid, patientId);
                } catch (err) {
                    logger.error(`[ARI] Error in main channel setup for ${asteriskChannelId}: ${err.message}`, err);
                    await this.cleanupChannel(asteriskChannelId, `Main channel ${asteriskChannelId} setup error`);
                }
            }
        }); // End StasisStart

        // --- Other Event Handlers ---
        this.client.on('StasisEnd', async (event, channel) => {
            const channelId = channel.id;
            const callData = this.tracker.getCall(channelId); // Is it a main channel?
            if (callData) {
                logger.warn(`[ARI] StasisEnd for tracked main channel ${channelId}. Initiating cleanup.`);
                // Don't await cleanup here, let it run in the background
                this.cleanupChannel(channelId, "StasisEnd (Main Channel)").catch(err => {
                    logger.error(`[ARI] Error during cleanup triggered by StasisEnd for ${channelId}: ${err.message}`);
                });
            } else {
                // Check if it's our snoop channel ending
                 for (const [mainCallId, cData] of this.tracker.calls.entries()) {
                    if (cData.snoopChannelId === channelId) {
                        logger.info(`[ARI] StasisEnd for ExternalMedia snoop channel ${channelId} (parent: ${mainCallId}).`);
                        // ExternalMedia might stop automatically, or we might need an explicit stop command if available/needed.
                        // No immediate cleanup of parent call needed just because snoop ended stasis.
                        break;
                    }
                    // Check if it's the internal UnicastRTP channel (less critical)
                    if (channelName.startsWith('UnicastRTP/') && cData.asteriskChannelId === parentCallId) { // Heuristic guess for parent
                         logger.info(`[ARI] StasisEnd for internal UnicastRTP channel ${channelId}. Ignoring.`);
                         break;
                    }
                }
            }
        });

        this.client.on('ChannelDestroyed', async (event, channel) => {
             const channelId = channel.id;
             logger.info(`[ARI] ChannelDestroyed event for: ${channelId}`);
             if (this.tracker.getCall(channelId)) { // If it's a tracked main channel
                 logger.info(`[ARI] ChannelDestroyed for tracked main channel ${channelId}. Initiating cleanup.`);
                 // Don't await cleanup here
                 this.cleanupChannel(channelId, "ChannelDestroyed (Main Channel)").catch(err => {
                     logger.error(`[ARI] Error during cleanup triggered by ChannelDestroyed for ${channelId}: ${err.message}`);
                 });
             } else {
                 // Check if it's a snoop channel being destroyed
                 for (const [mainCallId, cData] of this.tracker.calls.entries()) {
                    if (cData.snoopChannelId === channelId) {
                        logger.info(`[ARI] Snoop channel ${channelId} destroyed (parent: ${mainCallId}). Parent cleanup should handle resources.`);
                        // Update tracker state if needed
                        this.tracker.updateCall(mainCallId, { snoopChannel: null, snoopChannelId: null });
                        break;
                    }
                 }
             }
        });

        this.client.on('ChannelHangupRequest', async (event, channel) => {
             const channelId = channel.id;
             logger.info(`[ARI] ChannelHangupRequest for: ${channelId}, Cause: ${event.cause_txt || event.cause}`);
             if (this.tracker.getCall(channelId)) { // If it's a tracked main channel
                 logger.info(`[ARI] HangupRequest for tracked main channel ${channelId}. Initiating cleanup.`);
                 // Don't await cleanup here
                 this.cleanupChannel(channelId, `HangupRequest (Main Channel)`).catch(err => {
                     logger.error(`[ARI] Error during cleanup triggered by ChannelHangupRequest for ${channelId}: ${err.message}`);
                 });
             }
        });

        this.client.on('ChannelTalkingStarted', (event, channel) => {
            // This event might fire for main channel, snoop channel, or even the internal RTP channel
            logger.info(`[ARI VAD] >>> Talking STARTED on channel ${channel.id} (${channel.name})`);
        });

        this.client.on('ChannelTalkingFinished', (event, channel) => {
            logger.info(`[ARI VAD] <<< Talking FINISHED on channel ${channel.id} (${channel.name}). Duration: ${event.duration}ms`);
        });

        this.client.on('ChannelDtmfReceived', (event, channel) => {
            const digit = event.digit;
            const channelId = channel.id;
            // Find the associated primary call (likely the main channel)
            const callData = this.tracker.getCall(channelId) || Array.from(this.tracker.calls.values()).find(cd => cd.snoopChannelId === channelId);
            const primarySid = callData?.twilioSid || callData?.asteriskChannelId || channelId; // Use Twilio SID if available

            logger.info(`[ARI] DTMF '${digit}' on ${channelId} (CallID: ${primarySid})`);
            // Forward DTMF to OpenAI service if needed
            // if (primarySid) {
            //     openAIService.sendDtmf(primarySid, digit);
            // }
        });

        this.client.on('error', (err) => {
            logger.error(`[ARI] Client WebSocket Error: ${err.message}`, err);
            this.isConnected = false;
            // Optional: Trigger reconnection logic here if needed, similar to start()
            logger.info('[ARI] Attempting to reconnect after WebSocket error...');
            setTimeout(() => {
                if (!this.isConnected) { this.start(); }
            }, this.RETRY_DELAY);
        });

        logger.info('[ARI] Event handlers set up successfully.');
    } // End setupEventHandlers

    async setupMediaPipeline(channel, twilioCallSid, patientId) {
        // ... (setupMediaPipeline remains the same as previous ExternalMedia version) ...
         const asteriskChannelId = channel.id;
         logger.info(`[ARI] Setting up media pipeline for Asterisk ID: ${asteriskChannelId}, Twilio SID: ${twilioCallSid || 'N/A'}`);
         this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_setup' });
         let mainBridge = null; let dbConversationId = null;
         try {
             const conversationRecordKey = twilioCallSid || asteriskChannelId;
             const conversationData = { callSid: conversationRecordKey, asteriskChannelId, startTime: new Date(), callType: 'asterisk-call', status: 'active', patientId: null };
             if (patientId) {
                 const patientDoc = await Patient.findById(patientId).select('_id name').lean().catch(() => null);
                 if (patientDoc) conversationData.patientId = patientDoc._id;
             }
             const conversation = await Conversation.findOneAndUpdate({ callSid: conversationRecordKey }, { $setOnInsert: conversationData }, { new: true, upsert: true, runValidators: true }).catch(dbErr => { logger.error(`[ARI] DB Conversation error: ${dbErr.message}`); return null; });
             if (conversation) { dbConversationId = conversation._id.toString(); this.tracker.updateCall(asteriskChannelId, { conversationId: dbConversationId }); }

             mainBridge = await this.client.bridges.create({ type: 'mixing', name: `call-${asteriskChannelId}` });
             this.tracker.updateCall(asteriskChannelId, { mainBridge, mainBridgeId: mainBridge.id });
             const recordingName = `recording-${asteriskChannelId.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
             try { await mainBridge.record({ name: recordingName, format: 'wav', maxDurationSeconds: 3600, beep: false, ifExists: 'overwrite' }); this.tracker.updateCall(asteriskChannelId, { recordingName }); } catch (recordErr) { logger.error(`[ARI] Main bridge record failed: ${recordErr.message}`); }
             await mainBridge.addChannel({ channel: asteriskChannelId });
             this.tracker.updateCall(asteriskChannelId, { state: 'main_bridged' });
             const initialPrompt = "You are Bianca, a helpful AI assistant from the patient's care team.";
             await openAIService.initialize(asteriskChannelId, twilioCallSid, dbConversationId, initialPrompt);
             openAIService.setNotificationCallback((cbAsteriskChannelId, type, data) => {
                if (cbAsteriskChannelId === asteriskChannelId && type === 'audio_chunk' && data?.audio) {
                    this.handleOpenAIAudio(asteriskChannelId, data.audio); // Expects uLaw
                }
             });
             logger.info(`[ARI] OpenAI initialized and callback set for Asterisk ID: ${asteriskChannelId}.`);
             await this.initiateSnoopForExternalMedia(asteriskChannelId, channel);
             this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_active_extmedia' });
         } catch (err) {
             logger.error(`[ARI] Error in setupMediaPipeline for ${asteriskChannelId}: ${err.message}`, err);
             if (mainBridge) await mainBridge.destroy().catch(()=>{});
             throw err;
         }
    }

    async initiateSnoopForExternalMedia(asteriskChannelId, mainChannelObject) {
        // ... (initiateSnoopForExternalMedia remains the same as previous ExternalMedia version) ...
         logger.info(`[ExternalMedia Setup] Starting for main channel: ${asteriskChannelId}`);
         let snoopChannel = null;
         try {
             const snoopId = `snoop-extmedia-${uuidv4()}`;
             snoopChannel = await this.client.channels.snoopChannel({ channelId: asteriskChannelId, snoopId: snoopId, spy: 'in', app: 'myphonefriend' });
             logger.info(`[ExternalMedia Setup] Created snoop channel ${snoopChannel.id}. Waiting for StasisStart.`);
             this.tracker.updateCall(asteriskChannelId, { snoopChannel, snoopChannelId: snoopChannel.id, snoopMethod: 'externalMedia', state: 'external_media_snoop_created' });
             // Actual externalMedia call happens in StasisStart for the snoop channel
         } catch (err) {
             logger.error(`[ExternalMedia Setup] Failed to create snoop channel for ${asteriskChannelId}: ${err.message}`, err);
             if (snoopChannel && !snoopChannel.destroyed) await snoopChannel.hangup().catch(()=>{});
             this.tracker.updateCall(asteriskChannelId, { state: 'snoop_extmedia_failed', snoopChannel: null, snoopChannelId: null });
             throw err;
         }
    }

    handleOpenAIAudio(asteriskChannelId, audioBase64Ulaw) {
        // ... (remains the same, expects uLaw) ...
         if (!audioBase64Ulaw) return;
         this.playAudioToChannel(asteriskChannelId, audioBase64Ulaw);
    }

    async playAudioToChannel(asteriskChannelId, base64UlawAudio) {
        // ... (remains the same, expects uLaw) ...
         const callData = this.tracker.getCall(asteriskChannelId);
         if (!callData || !callData.mainChannel) { /* ... */ return; }
         const mainChannel = callData.mainChannel;
         const AUDIO_FORMAT = 'ulaw'; const FILE_EXTENSION = 'ulaw';
         try {
             const audioBuffer = Buffer.from(base64UlawAudio, 'base64');
             if (audioBuffer.length === 0) { /* ... */ return; }
             const soundId = `openai-ulaw-${uuidv4()}`;
             const tempPath = path.join(os.tmpdir(), `${soundId}.${FILE_EXTENSION}`);
             try { fs.writeFileSync(tempPath, audioBuffer); } catch (writeErr) { /* ... */ return; }
             try {
                  await this.client.sounds.upload({ soundId, format: AUDIO_FORMAT, sound: tempPath });
                  const playback = await mainChannel.play({ media: `sound:${soundId}`});
                  logger.info(`[ARI Playback] Playing uLaw sound ${soundId} to ${asteriskChannelId}`);
                  playback.once('PlaybackFinished', (_, inst) => logger.info(`[ARI Playback] Finished uLaw sound ${inst.id} on ${asteriskChannelId}.`));
                  playback.once('PlaybackFailed', (_, inst) => logger.error(`[ARI Playback] Failed playing uLaw sound ${inst.id} on ${asteriskChannelId}: ${inst.playback?.reason || 'Unknown'}`));
             } catch (uploadErr) {
                  logger.error(`[ARI Playback] Error uploading/playing uLaw sound ${soundId}: ${uploadErr.message}. Fallback file.`);
                  try {
                      const playback = await mainChannel.play({ media: `sound:${tempPath}`});
                      logger.info(`[ARI Playback] Playing uLaw file ${tempPath} to ${asteriskChannelId}`);
                      playback.once('PlaybackFinished', (_, inst) => logger.info(`[ARI Playback] Finished uLaw file playback ${inst.id} on ${asteriskChannelId}.`));
                      playback.once('PlaybackFailed', (_, inst) => logger.error(`[ARI Playback] Failed playing uLaw file ${inst.id} on ${asteriskChannelId}: ${inst.playback?.reason || 'Unknown'}`));
                  } catch (playFileErr) { logger.error(`[ARI Playback] Fallback uLaw file play failed: ${playFileErr.message}`); }
             } finally { if (fs.existsSync(tempPath)) { fs.unlink(tempPath, (err) => { if(err) logger.warn(`Error deleting ${tempPath}: ${err.message}`)}); }}
          } catch (err) { logger.error(`[ARI Playback] General error playing uLaw for ${asteriskChannelId}: ${err.message}`, err); }
    }

/**
     * Clean up all resources associated with a call.
     * @param {string} asteriskChannelIdToClean - The ID of the main Asterisk channel for the call.
     * @param {string} reason - Optional reason for logging.
     */
async cleanupChannel(asteriskChannelIdToClean, reason = "Unknown") {
    logger.info(`[Cleanup] Initiating for Asterisk ID: ${asteriskChannelIdToClean}. Reason: ${reason}`);

    // Get resources before removing from tracker to ensure we have IDs/objects
    const resources = this.tracker.getResources(asteriskChannelIdToClean);
    const primarySidForOpenAI = resources?.twilioSid || resources?.asteriskChannelId || asteriskChannelIdToClean;
    const ssrcToRemove = resources?.rtp_ssrc; // Get SSRC if using ExternalMedia

    // Remove from tracker *first* to prevent race conditions with new events
    const removed = this.tracker.removeCall(asteriskChannelIdToClean);

    // If it wasn't in the tracker but we retrieved resources, still try cleanup
    if (!removed && !resources) {
         logger.warn(`[Cleanup] Call ${asteriskChannelIdToClean} not found or already cleaned up.`);
         return; // Nothing more to do
    }
    // Use 'actualResources' which will be 'resources' if found, or a minimal object if not.
    const actualResources = resources || {
        asteriskChannelId: asteriskChannelIdToClean,
        twilioSid: primarySidForOpenAI,
        localChannel: null, snoopChannel: null, mainChannel: null,
        snoopBridge: null, mainBridge: null, conversationId: null,
        rtp_ssrc: null, // Ensure ssrcToRemove covers this case
        ffmpegTranscoder: null // Keep for safety, though not used now
    };

    // *** Remove SSRC mapping if applicable ***
    if (ssrcToRemove) {
        try {
            rtpListenerService.removeSsrcMapping(ssrcToRemove);
        } catch (e) {
             logger.warn(`[Cleanup] Error calling removeSsrcMapping for SSRC ${ssrcToRemove}: ${e.message}`);
        }
    }

    // If FFmpeg approach was somehow used, ensure cleanup
    if (actualResources.ffmpegTranscoder && typeof actualResources.ffmpegTranscoder.destroy === 'function') {
        logger.warn(`[Cleanup] Found unexpected FFmpeg transcoder during cleanup for ${asteriskChannelIdToClean}. Destroying.`);
        actualResources.ffmpegTranscoder.destroy();
    }

    // --- Helper functions for safe cleanup ---
    const safeHangup = async (channel, type) => {
        if (channel && typeof channel.hangup === 'function') {
            try {
                await channel.hangup();
                logger.info(`[Cleanup] Hung up ${type} channel ${channel.id}`);
            } catch (e) {
                // Ignore errors if channel is already gone (e.g., code 404)
                if (!e.message || !e.message.includes(' 404 ')) {
                    logger.warn(`[Cleanup] Error hanging up ${type} channel ${channel.id || 'unknown'}: ${e.message}`);
                }
            }
        } else if (channel) {
             logger.warn(`[Cleanup] Cannot hangup invalid ${type} channel object for ${asteriskChannelIdToClean}`);
        }
    };

    const safeDestroy = async (bridge, type) => {
        if (bridge && typeof bridge.destroy === 'function') {
            try {
                await bridge.destroy();
                logger.info(`[Cleanup] Destroyed ${type} bridge ${bridge.id}`);
            } catch (e) {
                if (!e.message || !e.message.includes(' 404 ')) {
                    logger.warn(`[Cleanup] Error destroying ${type} bridge ${bridge.id || 'unknown'}: ${e.message}`);
                }
            }
        } else if (bridge) {
             logger.warn(`[Cleanup] Cannot destroy invalid ${type} bridge object for ${asteriskChannelIdToClean}`);
        }
    };
    // --- End Helper functions ---


    // Perform cleanup actions concurrently
    await Promise.allSettled([
        // Hangup channels (Local/Snoop might be null depending on flow)
        safeHangup(actualResources.localChannel, 'Local'),
        safeHangup(actualResources.snoopChannel, 'Snoop'),

        // Destroy bridges (Snoop bridge might be null)
        safeDestroy(actualResources.snoopBridge, 'Snoop'),
        safeDestroy(actualResources.mainBridge, 'Main'),

        // Hangup main channel after bridges/snoop (might help avoid race conditions)
        safeHangup(actualResources.mainChannel, 'Main'),

        // Disconnect OpenAI Service
        (async () => {
             if (primarySidForOpenAI) {
                 try {
                    logger.info(`[Cleanup] Disconnecting OpenAI service for primary SID: ${primarySidForOpenAI}`);
                    await openAIService.disconnect(primarySidForOpenAI);
                 } catch(e) {
                     logger.warn(`[Cleanup] Error disconnecting OpenAI for ${primarySidForOpenAI}: ${e.message}`);
                 }
             } else {
                  logger.warn(`[Cleanup] Cannot disconnect OpenAI, no primary SID found for ${asteriskChannelIdToClean}`);
             }
        })(),

        // Update DB Conversation Status
        (async () => {
             if (actualResources.conversationId) {
                 try {
                     logger.info(`[Cleanup] Updating DB conversation ${actualResources.conversationId} status.`);
                     await Conversation.findByIdAndUpdate(actualResources.conversationId, {
                         status: 'completed',
                         endTime: new Date(),
                     });
                 } catch (e) {
                     logger.error(`[Cleanup] Error updating DB conversation ${actualResources.conversationId}: ${e.message}`);
                 }
             }
        })()
    ]);

    logger.info(`[Cleanup] Completed cleanup operations for Asterisk ID: ${asteriskChannelIdToClean}`);
} // End cleanupChannel
}

const ariClientInstance = new AsteriskAriClient();
module.exports = { startAriClient: () => ariClientInstance.start(), };
