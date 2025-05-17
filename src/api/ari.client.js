// src/services/ari.client.js

const AriClient = require('ari-client');
const { v4: uuidv4 } = require('uuid');
const fs =require('fs');
const os = require('os');
const path = require('path');
const config = require('../config/config');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
const { Conversation, Patient } = require('../models'); // Assuming Patient model is correctly imported
const channelTracker = require('./channel.tracker');
const rtpListenerService = require('./rtp.listener.service');

class AsteriskAriClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.tracker = channelTracker;
        this.retryCount = 0;
        this.MAX_RETRIES = 10;
        this.RETRY_DELAY = 3000;
        global.ariClient = this;

        this.RTP_LISTENER_HOST = config.asterisk.rtpListenerHost || 'bianca-app.myphonefriend.internal';
        this.RTP_LISTENER_PORT = config.asterisk.rtpListenerPort || 5060;
        this.RTP_SEND_FORMAT = 'slin';
    }

    async start() {
        try {
            logger.info('[ARI] Connecting to Asterisk ARI...');
            const ariUrl = config.asterisk.url;
            const username = config.asterisk.username;
            const password = config.asterisk.password;

            if (!ariUrl || !username || !password) {
                logger.error('[ARI] Missing ARI connection details (URL, username, or password) in configuration.');
                throw new Error('ARI configuration incomplete.');
            }
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
                const delay = Math.min(this.RETRY_DELAY * Math.pow(1.5, this.retryCount - 1), 30000);
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
        if (!this.client) {
            logger.error("[ARI] Client not initialized. Cannot set up event handlers.");
            return;
        }
        logger.info('[ARI] Setting up event handlers...');

        this.client.on('StasisStart', async (event, channel) => {
            const channelId = channel.id;
            const currentChannelName = channel.name || 'Unknown';
            const appArgs = event.args || []; // Usually empty for StasisStart from dialplan
            logger.info(`[ARI] StasisStart event for ${channelId} (${currentChannelName}), Args: ${JSON.stringify(appArgs)}`);

            // Check if this is a snoop channel we created for ExternalMedia
            let parentCallDataForSnoop = null;
            let parentCallIdForSnoop = null;
            if (currentChannelName.startsWith('Snoop/')) { // Only iterate if it's a snoop channel
                for (const [mainCallId, callData] of this.tracker.calls.entries()) {
                    if (callData.snoopChannelId === channelId && callData.snoopMethod === 'externalMedia') {
                        parentCallDataForSnoop = callData;
                        parentCallIdForSnoop = mainCallId;
                        break;
                    }
                }
            }

            if (parentCallDataForSnoop) { // This IS our snoop channel for ExternalMedia
                logger.info(`[ARI] StasisStart for tracked ExternalMedia snoop channel: ${channelId} (Parent: ${parentCallIdForSnoop})`);
                try {
                    await channel.answer();
                    logger.info(`[ARI] Answered snoop channel ${channelId}. Starting ExternalMedia.`);
                    const rtpDest = `${this.RTP_LISTENER_HOST}:${this.RTP_LISTENER_PORT}`;
                    await channel.externalMedia({
                        app: 'myphonefriend',
                        external_host: rtpDest,
                        format: this.RTP_SEND_FORMAT,
                        direction: 'read',
                    });
                    logger.info(`[ARI] ExternalMedia started for snoop ${channelId} -> ${rtpDest}`);
                    this.tracker.updateCall(parentCallIdForSnoop, { state: 'external_media_active_awaiting_ssrc' });
                } catch (err) {
                    logger.error(`[ARI] Failed to start ExternalMedia on snoop ${channelId}: ${err.message}`, err);
                    // If snoop setup fails, we should clean up the parent call as the media pipeline is broken.
                    if (parentCallIdForSnoop) {
                        await this.cleanupChannel(parentCallIdForSnoop, `ExternalMedia setup failed for snoop ${channelId}`);
                    } else {
                        // This case should ideally not be reached if parentCallDataForSnoop was found
                        await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up orphaned snoop channel ${channelId}: ${e.message}`));
                    }
                }
            } else if (currentChannelName.startsWith('PJSIP/twilio-trunk-')) { // Main incoming call
                logger.info(`[ARI] Handling StasisStart for Main incoming channel: ${channelId}`);
                let twilioCallSid = null;
                let patientId = null;

                try {
                    const channelVars = await channel.getChannelVar({ variable: 'URIOPTS' });
                    if (channelVars && typeof channelVars.value === 'string' && channelVars.value.length > 0) {
                        logger.info(`[ARI] Raw URIOPTS for ${channelId}: ${channelVars.value}`);
                        const uriOpts = channelVars.value.split('&').reduce((opts, pair) => {
                            const [key, value] = pair.split('=');
                            if (key && value) opts[decodeURIComponent(key)] = decodeURIComponent(value);
                            return opts;
                        }, {});
                        if (uriOpts.patientId) patientId = uriOpts.patientId;
                        if (uriOpts.callSid) twilioCallSid = uriOpts.callSid;
                        logger.info(`[ARI] From URIOPTS for ${channelId}: patientId=${patientId}, twilioCallSid=${twilioCallSid}`);
                    } else {
                        logger.warn(`[ARI] URIOPTS variable not found, empty, or not a string for ${channelId}. Raw value: ${JSON.stringify(channelVars)}`);
                    }
                } catch (err) {
                    logger.warn(`[ARI] Error getting/parsing URIOPTS for ${channelId}: ${err.message}. This might indicate the variable wasn't set in dialplan or channel was hung up.`);
                }

                if (!twilioCallSid || !patientId) {
                    logger.error(`[ARI] Critical: twilioCallSid or patientId is missing for main channel ${channelId}. Cannot proceed. TwilioSID: ${twilioCallSid}, PatientID: ${patientId}`);
                    await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up main channel ${channelId} after missing params: ${e.message}`));
                    return;
                }

                this.tracker.addCall(channelId, {
                    channel: channel,
                    mainChannel: channel, // Explicitly store the main channel object
                    twilioSid: twilioCallSid,
                    patientId: patientId,
                    state: 'stasis_start'
                });

                try {
                    await channel.answer();
                    this.tracker.updateCall(channelId, { state: 'answered' });
                    logger.info(`[ARI] Answered main channel: ${channelId}`);
                    await this.setupMediaPipeline(channel, twilioCallSid, patientId);
                } catch (err) {
                    logger.error(`[ARI] Error in main channel setup for ${channelId}: ${err.message}`, err);
                    await this.cleanupChannel(channelId, `Main channel ${channelId} setup error`);
                }

            } else if (currentChannelName.startsWith('UnicastRTP/')) {
                logger.info(`[ARI] StasisStart for internal UnicastRTP channel ${channelId} created by ExternalMedia. Ignoring.`);
            } else if (currentChannelName.startsWith('Local/')) {
                logger.warn(`[ARI] StasisStart for unexpected Local channel ${channelId}. Hanging up.`);
                await channel.hangup().catch(()=>{});
            } else {
                logger.warn(`[ARI] StasisStart for unhandled channel type: ${channelId} (${currentChannelName}). Hanging up.`);
                await channel.hangup().catch(()=>{});
            }
        });

        this.client.on('StasisEnd', async (event, channel) => {
            const channelId = channel.id;
            const currentChannelName = channel.name || 'Unknown';
            logger.info(`[ARI] StasisEnd for channel ${channelId} (${currentChannelName})`);

            if (this.tracker.getCall(channelId)) {
                logger.info(`[ARI] StasisEnd for tracked main channel ${channelId}. Initiating cleanup.`);
                this.cleanupChannel(channelId, "StasisEnd (Main Channel)").catch(err => {
                    logger.error(`[ARI] Error during cleanup from StasisEnd for ${channelId}: ${err.message}`);
                });
            } else {
                let isKnownSnoop = false;
                for (const [mainCallId, cData] of this.tracker.calls.entries()) {
                    if (cData.snoopChannelId === channelId) {
                        isKnownSnoop = true;
                        logger.info(`[ARI] StasisEnd for ExternalMedia snoop channel ${channelId} (parent: ${mainCallId}).`);
                        break;
                    }
                }
                 if (!isKnownSnoop && currentChannelName.startsWith('UnicastRTP/')) {
                     logger.info(`[ARI] StasisEnd for internal UnicastRTP channel ${channelId}. Ignoring.`);
                } else if (!isKnownSnoop && !currentChannelName.startsWith('Snoop/')) {
                    logger.warn(`[ARI] StasisEnd for untracked or non-snoop/UnicastRTP channel ${channelId} (${currentChannelName}).`);
                }
            }
        });

        this.client.on('ChannelDestroyed', async (event, channel) => {
            const channelId = channel.id;
            const currentChannelName = channel.name || 'Unknown';
            logger.info(`[ARI] ChannelDestroyed event for: ${channelId} (${currentChannelName})`);
            if (this.tracker.getCall(channelId)) {
                logger.info(`[ARI] ChannelDestroyed for tracked main channel ${channelId}. Initiating cleanup.`);
                this.cleanupChannel(channelId, "ChannelDestroyed (Main Channel)").catch(err => {
                    logger.error(`[ARI] Error during cleanup from ChannelDestroyed for ${channelId}: ${err.message}`);
                });
            } else {
                for (const [mainCallId, cData] of this.tracker.calls.entries()) {
                    if (cData.snoopChannelId === channelId) {
                        logger.info(`[ARI] Snoop channel ${channelId} destroyed (parent: ${mainCallId}).`);
                        this.tracker.updateCall(mainCallId, { snoopChannel: null, snoopChannelId: null });
                        break;
                    }
                }
            }
        });

        this.client.on('ChannelHangupRequest', async (event, channel) => {
            const channelId = channel.id;
            const currentChannelName = channel.name || 'Unknown';
            logger.info(`[ARI] ChannelHangupRequest for: ${channelId} (${currentChannelName}), Cause: ${event.cause_txt || event.cause}`);
            if (this.tracker.getCall(channelId)) {
                logger.info(`[ARI] HangupRequest for tracked main channel ${channelId}. Initiating cleanup.`);
                this.cleanupChannel(channelId, `HangupRequest (Main Channel)`).catch(err => {
                    logger.error(`[ARI] Error during cleanup from ChannelHangupRequest for ${channelId}: ${err.message}`);
                });
            }
        });

        this.client.on('ChannelTalkingStarted', (event, channel) => {
            logger.info(`[ARI VAD] >>> Talking STARTED on channel ${channel.id} (${channel.name || 'Unknown'})`);
        });

        this.client.on('ChannelTalkingFinished', (event, channel) => {
            logger.info(`[ARI VAD] <<< Talking FINISHED on channel ${channel.id} (${channel.name || 'Unknown'}). Duration: ${event.duration}ms`);
        });

        this.client.on('ChannelDtmfReceived', (event, channel) => {
            const digit = event.digit;
            const channelId = channel.id;
            const callData = this.tracker.getCall(channelId) || Array.from(this.tracker.calls.values()).find(cd => cd.snoopChannelId === channelId);
            const primarySid = callData?.twilioSid || callData?.asteriskChannelId || channelId;
            logger.info(`[ARI] DTMF '${digit}' on ${channelId} (CallID: ${primarySid})`);
        });

        this.client.on('error', (err) => {
            logger.error(`[ARI] Client WebSocket Error: ${err.message}`, err);
            this.isConnected = false;
            logger.info('[ARI] Attempting to reconnect after WebSocket error...');
            setTimeout(() => {
                if (!this.isConnected && this.retryCount < this.MAX_RETRIES) {
                     this.start().catch(e => logger.error(`[ARI] Reconnect attempt failed: ${e.message}`));
                } else if (!this.isConnected) {
                    logger.error('[ARI] Max retries reached or already attempting reconnect. Not retrying from "error" event.');
                }
            }, this.RETRY_DELAY);
        });

        logger.info('[ARI] Event handlers set up successfully.');
    }

    async setupMediaPipeline(channel, twilioCallSid, patientId) {
        const asteriskChannelId = channel.id;
        logger.info(`[ARI Pipeline] Setting up for Asterisk ID: ${asteriskChannelId}, Twilio SID: ${twilioCallSid}, PatientID: ${patientId}`);
        this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_setup' });
        let mainBridge = null;
        let dbConversationId = null;

        try {
            if (!patientId) {
                logger.error(`[ARI Pipeline] Critical: PatientID is missing for main channel ${asteriskChannelId}. Cannot create conversation record.`);
                throw new Error('PatientID is missing, cannot create conversation record for media pipeline.');
            }

            const conversationRecordKey = twilioCallSid;
            const conversationData = {
                callSid: conversationRecordKey,
                asteriskChannelId,
                startTime: new Date(),
                callType: 'asterisk-call',
                status: 'active',
                patientId: null // Initialize
            };

            const patientDoc = await Patient.findById(patientId).select('_id name').lean().catch(() => null);
            if (patientDoc) {
                conversationData.patientId = patientDoc._id; // Assign the ObjectId
            } else {
                logger.warn(`[ARI Pipeline] Patient with ID ${patientId} not found. Conversation will not be linked to a patient.`);
                // If patientId is strictly required by your Conversation schema and cannot be null,
                // you should throw an error here to prevent saving an invalid record.
                // For example: throw new Error(`Patient with ID ${patientId} not found, and is required for Conversation.`);
            }
            
            // Only proceed with DB if patientId is resolved (if it's mandatory for your schema)
            // Or adjust schema if patientId can be optional.
            // Assuming for now that if patientDoc is null, we might still want to record the call without patient linkage,
            // but your schema for Conversation.patientId must allow null or be omitted.
            // If it's required, the findOneAndUpdate will fail.

            if (conversationData.patientId) { // Only try to save if we have a valid patientId (if it's required)
                const conversation = await Conversation.findOneAndUpdate(
                    { callSid: conversationRecordKey },
                    { $set: conversationData, $setOnInsert: { createdAt: new Date() } },
                    { new: true, upsert: true, runValidators: true }
                ).catch(dbErr => {
                    logger.error(`[ARI Pipeline] DB Conversation error for ${conversationRecordKey}: ${dbErr.message}`, dbErr);
                    return null;
                });

                if (conversation) {
                    dbConversationId = conversation._id.toString();
                    this.tracker.updateCall(asteriskChannelId, { conversationId: dbConversationId });
                    logger.info(`[ARI Pipeline] Conversation record ${dbConversationId} created/updated for call ${conversationRecordKey}`);
                } else {
                    logger.warn(`[ARI Pipeline] Failed to create/update conversation record for ${conversationRecordKey}.`);
                }
            } else {
                 logger.warn(`[ARI Pipeline] Skipping DB Conversation record for ${conversationRecordKey} due to missing or invalid patientId.`);
            }


            mainBridge = await this.client.bridges.create({ type: 'mixing', name: `call-${asteriskChannelId}` });
            this.tracker.updateCall(asteriskChannelId, { mainBridge, mainBridgeId: mainBridge.id });
            logger.info(`[ARI Pipeline] Created main bridge ${mainBridge.id} for ${asteriskChannelId}`);

            const recordingName = `recording-${asteriskChannelId.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            try {
                await mainBridge.record({ name: recordingName, format: 'wav', maxDurationSeconds: 3600, beep: false, ifExists: 'overwrite' });
                this.tracker.updateCall(asteriskChannelId, { recordingName });
                logger.info(`[ARI Pipeline] Started recording ${recordingName} on bridge ${mainBridge.id}`);
            } catch (recordErr) {
                logger.error(`[ARI Pipeline] Main bridge record failed: ${recordErr.message}`);
            }

            await mainBridge.addChannel({ channel: asteriskChannelId });
            this.tracker.updateCall(asteriskChannelId, { state: 'main_bridged' });
            logger.info(`[ARI Pipeline] Added main channel ${asteriskChannelId} to bridge ${mainBridge.id}`);

            const initialPrompt = "You are Bianca, a helpful AI assistant from the patient's care team.";
            // Pass dbConversationId (which might be null if DB save failed/skipped)
            await openAIService.initialize(asteriskChannelId, twilioCallSid, dbConversationId, initialPrompt);
            openAIService.setNotificationCallback((cbAsteriskChannelId, type, data) => {
                if (cbAsteriskChannelId === asteriskChannelId && type === 'audio_chunk' && data?.audio) {
                    this.handleOpenAIAudio(asteriskChannelId, data.audio);
                }
            });
            logger.info(`[ARI Pipeline] OpenAI initialized and callback set for Asterisk ID: ${asteriskChannelId}.`);

            await this.initiateSnoopForExternalMedia(asteriskChannelId, channel);
            this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_active_extmedia' });

        } catch (err) {
            logger.error(`[ARI Pipeline] Error in setupMediaPipeline for ${asteriskChannelId}: ${err.message}`, err);
            if (mainBridge && mainBridge.id) {
                 await mainBridge.destroy().catch(e => logger.warn(`[ARI Pipeline] Error destroying mainBridge in catch: ${e.message}`));
            }
            throw err; // Re-throw to be caught by the StasisStart handler for full channel cleanup
        }
    }

    async initiateSnoopForExternalMedia(asteriskChannelId, mainChannelObject) {
        logger.info(`[ExternalMedia Setup] Starting for main channel: ${asteriskChannelId}`);
        let snoopChannel = null;
        try {
            const snoopId = `snoop-extmedia-${uuidv4()}`;
            snoopChannel = await this.client.channels.snoopChannel({
                channelId: asteriskChannelId,
                snoopId: snoopId,
                spy: 'in', // Snoop audio FROM the main channel (what the user/Twilio sends)
                app: 'myphonefriend',
            });
            logger.info(`[ExternalMedia Setup] Created snoop channel ${snoopChannel.id}. It will enter Stasis app 'myphonefriend'.`);
            this.tracker.updateCall(asteriskChannelId, {
                snoopChannel: snoopChannel,
                snoopChannelId: snoopChannel.id,
                snoopMethod: 'externalMedia',
                state: 'external_media_snoop_created'
            });
        } catch (err) {
            logger.error(`[ExternalMedia Setup] Failed to create snoop channel for ${asteriskChannelId}: ${err.message}`, err);
            if (snoopChannel && snoopChannel.id && !snoopChannel.destroyed) {
                await snoopChannel.hangup().catch(e => logger.warn(`[ExternalMedia Setup] Error hanging up snoop channel in catch: ${e.message}`));
            }
            this.tracker.updateCall(asteriskChannelId, { state: 'snoop_extmedia_failed', snoopChannel: null, snoopChannelId: null });
            throw err;
        }
    }

    handleOpenAIAudio(asteriskChannelId, audioBase64Ulaw) {
        if (!audioBase64Ulaw) {
            logger.warn(`[ARI Playback] Received empty audio for ${asteriskChannelId}. Skipping.`);
            return;
        }
        this.playAudioToChannel(asteriskChannelId, audioBase64Ulaw);
    }

    async playAudioToChannel(asteriskChannelId, base64UlawAudio) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData || !callData.mainChannel) {
            logger.warn(`[ARI Playback] Main channel not found for ${asteriskChannelId}. Cannot play audio.`);
            return;
        }
        const mainChannel = callData.mainChannel;
        const AUDIO_FORMAT = 'ulaw';
        const FILE_EXTENSION = 'ulaw';

        try {
            const audioBuffer = Buffer.from(base64UlawAudio, 'base64');
            if (audioBuffer.length === 0) {
                logger.warn(`[ARI Playback] Decoded audio buffer is empty for ${asteriskChannelId}.`);
                return;
            }
            const soundId = `openai-ulaw-${uuidv4()}`;
            const tempPath = path.join(os.tmpdir(), `${soundId}.${FILE_EXTENSION}`);
            try {
                fs.writeFileSync(tempPath, audioBuffer);
            } catch (writeErr) {
                logger.error(`[ARI Playback] Failed to write audio to temp file ${tempPath}: ${writeErr.message}`);
                return;
            }
            try {
                await this.client.sounds.upload({ soundId, format: AUDIO_FORMAT, sound: tempPath });
                const playback = await mainChannel.play({ media: `sound:${soundId}`});
                logger.info(`[ARI Playback] Playing uLaw sound ${soundId} to ${asteriskChannelId}`);
                playback.once('PlaybackFinished', (_, inst) => {
                    logger.info(`[ARI Playback] Finished uLaw sound ${inst.id} on ${asteriskChannelId}.`);
                });
                playback.once('PlaybackFailed', (_, inst) => {
                    logger.error(`[ARI Playback] Failed playing uLaw sound ${inst.id} on ${asteriskChannelId}: ${inst.playback?.reason || 'Unknown'}`);
                });
            } catch (uploadErr) {
                logger.error(`[ARI Playback] Error uploading/playing uLaw sound ${soundId}: ${uploadErr.message}. Attempting fallback to play file directly.`);
                try {
                    const playback = await mainChannel.play({ media: `sound:!${tempPath}` });
                    logger.info(`[ARI Playback] Playing uLaw file (fallback) ${tempPath} to ${asteriskChannelId}`);
                    playback.once('PlaybackFinished', (_, inst) => logger.info(`[ARI Playback] Finished uLaw file playback ${inst.id} on ${asteriskChannelId}.`));
                    playback.once('PlaybackFailed', (_, inst) => logger.error(`[ARI Playback] Failed playing uLaw file (fallback) ${inst.id} on ${asteriskChannelId}: ${inst.playback?.reason || 'Unknown'}`));
                } catch (playFileErr) {
                    logger.error(`[ARI Playback] Fallback uLaw file play also failed: ${playFileErr.message}`);
                }
            } finally {
                if (fs.existsSync(tempPath)) {
                    fs.unlink(tempPath, (err) => {
                        if (err) logger.warn(`[ARI Playback] Error deleting temp audio file ${tempPath}: ${err.message}`);
                    });
                }
            }
        } catch (err) {
            logger.error(`[ARI Playback] General error playing uLaw for ${asteriskChannelId}: ${err.message}`, err);
        }
    }

    async cleanupChannel(asteriskChannelIdToClean, reason = "Unknown") {
        logger.info(`[Cleanup] Initiating for Asterisk ID: ${asteriskChannelIdToClean}. Reason: ${reason}`);
        const resources = this.tracker.getResources(asteriskChannelIdToClean); // Get a copy of resources
        const primarySidForOpenAI = resources?.twilioSid || resources?.asteriskChannelId || asteriskChannelIdToClean;
        const ssrcToRemove = resources?.rtp_ssrc;

        const removedCallData = this.tracker.removeCall(asteriskChannelIdToClean); // Remove from tracker
        
        // Use 'resources' if available (from before removal), otherwise use 'removedCallData' if that was returned,
        // or fallback to a minimal object if neither have what we need.
        const actualResources = resources || removedCallData || {
            asteriskChannelId: asteriskChannelIdToClean,
            twilioSid: primarySidForOpenAI, // Might be just asteriskChannelIdToClean if no twilioSid
            mainChannel: null, snoopChannel: null, localChannel: null,
            mainBridge: null, snoopBridge: null, conversationId: null, rtp_ssrc: null
        };


        if (ssrcToRemove) { // Use ssrcToRemove which was captured before removing from tracker
            try {
                rtpListenerService.removeSsrcMapping(ssrcToRemove);
            } catch (e) {
                logger.warn(`[Cleanup] Error calling removeSsrcMapping for SSRC ${ssrcToRemove}: ${e.message}`);
            }
        }

        const safeHangup = async (channel, type) => {
            if (channel && typeof channel.hangup === 'function' && !channel.destroyed) {
                try {
                    await channel.hangup();
                    logger.info(`[Cleanup] Hung up ${type} channel ${channel.id}`);
                } catch (e) {
                    if (!e.message || !e.message.includes(' 404 ')) {
                        logger.warn(`[Cleanup] Error hanging up ${type} channel ${channel.id || 'unknown'}: ${e.message}`);
                    } else {
                        logger.info(`[Cleanup] ${type} channel ${channel.id || 'unknown'} already gone (404).`);
                    }
                }
            }
        };
        const safeDestroy = async (bridge, type) => {
            if (bridge && typeof bridge.destroy === 'function' && !bridge.destroyed) {
                try {
                    await bridge.destroy();
                    logger.info(`[Cleanup] Destroyed ${type} bridge ${bridge.id}`);
                } catch (e) {
                    if (!e.message || !e.message.includes(' 404 ')) {
                        logger.warn(`[Cleanup] Error destroying ${type} bridge ${bridge.id || 'unknown'}: ${e.message}`);
                    } else {
                         logger.info(`[Cleanup] ${type} bridge ${bridge.id || 'unknown'} already gone (404).`);
                    }
                }
            }
        };

        await safeHangup(actualResources.snoopChannel, 'Snoop');
        await safeDestroy(actualResources.snoopBridge, 'Snoop');
        await safeHangup(actualResources.mainChannel, 'Main');
        await safeDestroy(actualResources.mainBridge, 'Main');
        await safeHangup(actualResources.localChannel, 'Local');

        if (primarySidForOpenAI) {
            try {
                logger.info(`[Cleanup] Disconnecting OpenAI service for primary SID: ${primarySidForOpenAI}`);
                await openAIService.disconnect(primarySidForOpenAI);
            } catch(e) {
                logger.warn(`[Cleanup] Error disconnecting OpenAI for ${primarySidForOpenAI}: ${e.message}`);
            }
        }

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
        logger.info(`[Cleanup] Completed cleanup operations for Asterisk ID: ${asteriskChannelIdToClean}`);
    }
}

const ariClientInstance = new AsteriskAriClient();

module.exports = {
    startAriClient: async () => {
        // Ensure start is only called if not already connected and not in a retry loop from 'error' handler
        if (!ariClientInstance.isConnected && ariClientInstance.retryCount === 0) {
            await ariClientInstance.start();
        } else if (ariClientInstance.isConnected) {
            logger.info('[ARI] Client already connected.');
        } else {
            logger.info('[ARI] Client is currently in a retry sequence.');
        }
        return ariClientInstance;
    },
    getAriClientInstance: () => ariClientInstance
};
