const AriClient = require('ari-client');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config/config');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
const { Conversation, Patient } = require('../models');
const channelTracker = require('./channel.tracker');
const rtpListenerService = require('./rtp.listener.service');

// Helper to strip protocol and ensure valid host[:port]
function sanitizeHost(raw) {
    try {
        const u = new URL(raw);
        return u.hostname; // doesn't and shouldn't include port if present
    } catch {
        return raw;
    }
}

class AsteriskAriClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.tracker = channelTracker;
        this.retryCount = 0;
        this.MAX_RETRIES = 10;
        this.RETRY_DELAY = 3000;
        global.ariClient = this;

        // Configuration for ExternalMedia
        this.RTP_BIANCA_HOST = sanitizeHost(config.asterisk.rtpBiancaHost);
        this.RTP_ASTERISK_HOST = sanitizeHost(config.asterisk.rtpAsteriskHost);
        this.RTP_BIANCA_SEND_PORT = config.asterisk.rtpBiancaSendPort;
        this.RTP_BIANCA_RECEIVE_PORT = config.asterisk.rtpBiancaReceivePort || (config.asterisk.rtpBiancaSendPort + 1); // For sending (App → Asterisk)
        this.RTP_SEND_FORMAT = 'ulaw';
    }

    async waitForReady() {
        logger.info('[ARI] waitForReady() called');
        
        if (!this.isConnected) {
            logger.error('[ARI] waitForReady() - client not connected!');
            throw new Error('ARI client not connected');
        }
        
        if (!this.client) {
            logger.error('[ARI] waitForReady() - client object is null!');
            throw new Error('ARI client object is null');
        }
        
        // Verify the Stasis app is registered by testing an API call
        try {
            logger.info('[ARI] Checking for registered applications...');
            const apps = await this.client.applications.list();
            logger.info(`[ARI] Found ${apps.length} applications: ${apps.map(a => a.name).join(', ')}`);
            
            const myApp = apps.find(app => app.name === 'myphonefriend');
            if (!myApp) {
                logger.error('[ARI] Stasis application "myphonefriend" not found in registered apps');
                throw new Error('Stasis application myphonefriend not found');
            }
            
            logger.info('[ARI] Stasis application "myphonefriend" verified and ready');
            return true;
        } catch (err) {
            if (err.message) {
                logger.error('[ARI] Stasis application not ready:', err.message);
            }
            logger.error('[ARI] Full error:', err);
            throw err;
        }
    }

    async start() {
        try {
            logger.info('[ARI] Connecting to Asterisk ARI...');
            const ariUrl = config.asterisk.url;
            const username = config.asterisk.username;
            const password = config.asterisk.password;

            if (!ariUrl || !username || !password) {
                logger.error('[ARI] Missing ARI connection details in configuration.');
                throw new Error('ARI configuration incomplete.');
            }

            // Connect with WS-level pings disabled and auto-reconnect
            this.client = await AriClient.connect(
                ariUrl,
                username,
                password,
                {
                    keepAliveIntervalMs: 20000,     // send WebSocket-level PING every 20s
                    perMessageDeflate: false,       // avoid compression issues
                    reconnect: { retries: Infinity, delay: 10000 }
                }
            );

            this.isConnected = true;
            this.retryCount = 0;
            logger.info('[ARI] Successfully connected to Asterisk ARI');

            // Hook into built-in WebSocket events
            this.client.on('WebSocketConnected', () => {
                logger.info('[ARI] WS connected');
            });
            this.client.on('WebSocketReconnecting', err => {
                if (err.message) {
                    logger.warn('[ARI] WS reconnecting:', err.message || err);
                }
                else {
                    logger.warn('[ARI] WS reconnecting with no error message');
                }
            });
            this.client.on('WebSocketMaxRetries', err => {
                if (err.message) {
                    logger.error('[ARI] WS max retries:', err.message || err);
                } else {
                    logger.error('[ARI] WS max retries with no error message'); 
                }
            });
            this.client.on('WebSocketClosed', (code, reason) => {
                logger.warn(`[ARI] WS closed ${code}: ${reason}`);
                this.isConnected = false;
                
                // Reconnect on any abnormal closure
                if (code !== 1000) {
                    this.reconnect();
                } else {
                    logger.info('[ARI] WS closed normally (code 1000), not reconnecting');
                }
            });

            // Setup ARI event handlers
            this.setupEventHandlers();

            // Register Stasis application
            await this.client.start('myphonefriend');
            logger.info('[ARI] Subscribed to Stasis application: myphonefriend');

            // Connection test
            try {
                const eps = await this.client.endpoints.list();
                logger.info(`[ARI] Endpoint list success: ${eps.length} endpoints`);
            } catch (e) {
                logger.warn(`[ARI] Endpoint list failed: ${e.message}`);
            }

        } catch (err) {
            logger.error(`[ARI] Start error: ${err.message}`);
            this.isConnected = false;
            this.reconnect();
        }
    }

    handleDisconnection(reason) {
        if (!this.isConnected) {
            logger.debug('[ARI] Already disconnected, skipping disconnect handler');
            return;
        }

        logger.warn(`[ARI] Handling disconnection: ${reason}`);
        this.isConnected = false;

        // Stop keep-alive
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }

        // Clean up WebSocket
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                if (this.ws.readyState === 1) { // OPEN
                    this.ws.close(1000, 'Client initiated disconnect');
                } else {
                    this.ws.terminate();
                }
                logger.info('[ARI] WebSocket terminated');
            } catch (err) {
                logger.error(`[ARI] Error terminating WebSocket: ${err.message}`);
            }
            this.ws = null;
        }

        // Clean up client
        this.client = null;

        // Initiate reconnection
        this.reconnect();
    }

    async reconnect() {
        if (this.retryCount >= this.MAX_RETRIES) {
            logger.error(`[ARI] Reconnect failed after ${this.MAX_RETRIES} attempts`);
            return;
        }
        this.retryCount++;
        const delay = Math.min(this.RETRY_DELAY * Math.pow(1.5, this.retryCount - 1) + Math.random() * 1000, 30000);
        logger.info(`[ARI] Reconnecting in ${delay.toFixed(0)}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
        await new Promise(res => setTimeout(res, delay));
        await this.start();
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
            logger.info(`[ARI] StasisStart event for ${channelId} (${currentChannelName})`);

            if (currentChannelName.startsWith('Snoop/')) {
                await this.handleStasisStartForSnoop(channel, currentChannelName);
            } else if (currentChannelName.startsWith('Local/playback-')) {
                await this.handleStasisStartForPlayback(channel, currentChannelName, event);
            } else if (currentChannelName.startsWith('PJSIP/twilio-trunk-')) {

                await channel.answer();
                this.tracker.addCall(channelId, {
                    channel: channel,
                    mainChannel: channel,
                    twilioCallSid: null,
                    patientId: null,
                    state: 'answered'
                });
                logger.info(`[ARI] Answered main channel: ${channelId}`);

                let twilioCallSid = null;
                let patientId = null;

                try {
                    logger.info(`[ARI] StasisStart for ${channel.id}, args: ${JSON.stringify(event.args)}`);
                    // First try the Stasis argument
                    let rawUri = event.args[0] || '';
                    // Fallback to channel variable if missing
                    if (!rawUri) {
                        try {
                            const result = await channel.getChannelVar({ variable: 'RAW_SIP_URI_FOR_ARI' });
                            rawUri = result.value;
                        } catch (err) {
                            logger.warn(`[ARI] Could not get RAW_SIP_URI_FOR_ARI: ${err.message}`);
                        }
                    }

                    if (!rawUri) {
                        logger.error('[ARI] No SIP URI provided in StasisStart, hanging up');
                        return channel.hangup();
                    }
                    // Strip angle brackets
                    rawUri = rawUri.replace(/^<|>$/g, '');
                    // Parse parameters after semicolons
                    const parts = rawUri.split(';');
                    const paramMap = {};
                    parts.slice(1).forEach(p => {
                        const [k, v] = p.split('=');
                        if (k && v) paramMap[k] = decodeURIComponent(v);
                    });
                    twilioCallSid = paramMap.callSid;
                    patientId = paramMap.patientId;
                    if (!twilioCallSid || !patientId) {
                        logger.error('[ARI] Missing twilioCallSid or patientId, hanging up');
                        return channel.hangup();
                    }
                } catch (err) {
                    logger.warn(`[ARI] Error getting/parsing RAW_SIP_URI_FOR_ARI for ${channelId}: ${err.message}`);
                }

                try {
                    this.tracker.updateCall(channelId, { twilioCallSid, patientId });
                    await this.setupMediaPipeline(channel, twilioCallSid, patientId);
                } catch (err) {
                    logger.error(`[ARI] Error in main channel setup for ${channelId}: ${err.message}`, err);
                    await this.cleanupChannel(channelId, `Main channel ${channelId} setup error`);
                }
            } else if (currentChannelName.startsWith('UnicastRTP/')) {
                const creatorId = channel.creator?.id;
                logger.info(`[ARI] StasisStart for UnicastRTP channel ${channel.id}. Creator: ${creatorId || 'N/A'}`);

                if (!creatorId) {
                    logger.warn(`[ARI] UnicastRTP channel ${channel.id} has no creator. Cannot determine its purpose.`);
                    return;
                }

                // Find the parent call by matching the creator ID with our tracked channels
                let parentCallId = null;
                let creatorType = null;

                for (const [id, data] of this.tracker.calls.entries()) {
                    if (data.snoopChannelId === creatorId) {
                        parentCallId = id;
                        creatorType = 'snoop';
                        break;
                    }
                    if (data.playbackChannelId === creatorId) {
                        parentCallId = id;
                        creatorType = 'playback';
                        break;
                    }
                }

                if (parentCallId && creatorType === 'snoop') {
                    // This is the INBOUND RTP stream created by the snoop channel.
                    // It needs to be answered to allow media to flow TO our application.
                    // It must NOT be bridged.
                    logger.info(`[ARI] Identified inbound UnicastRTP channel ${channel.id} (from snoop ${creatorId}). Answering it.`);
                    try {
                        await channel.answer();
                        this.tracker.updateCall(parentCallId, { inboundRtpChannel: channel });
                    } catch (err) {
                        logger.error(`[ARI] Failed to answer inbound UnicastRTP channel ${channel.id}: ${err.message}`);
                    }
                } else if (parentCallId && creatorType === 'playback') {
                    // This is the OUTBOUND RTP stream created by the playback channel.
                    // It is handled (bridged) in the handleStasisStartForPlayback function.
                    logger.info(`[ARI] Identified outbound UnicastRTP channel ${channel.id} (from playback ${creatorId}). No action needed in this handler.`);
                } else {
                    logger.warn(`[ARI] Could not find parent call for UnicastRTP channel ${channel.id} with creator ${creatorId}.`);
                }
            } else if (currentChannelName.startsWith('Local/')) {
                logger.warn(`[ARI] StasisStart for unexpected Local channel ${channelId}. Hanging up.`);
                await channel.hangup().catch(()=>{});
            } else {
                logger.warn(`[ARI] StasisStart for unhandled/unknown channel type: ${channelId} (${currentChannelName}). Hanging up.`);
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
                let parentCallIdForSnoop = null;
                for (const [mainCallId, cData] of this.tracker.calls.entries()) {
                    if (cData.snoopChannelId === channelId) {
                        parentCallIdForSnoop = mainCallId;
                        logger.info(`[ARI] StasisEnd for ExternalMedia snoop channel ${channelId} (parent: ${mainCallId}).`);
                        break;
                    }
                }
                if (!parentCallIdForSnoop && currentChannelName.startsWith('UnicastRTP/')) {
                    logger.info(`[ARI] StasisEnd for internal UnicastRTP channel ${channelId}. Ignoring.`);
                } else if (!parentCallIdForSnoop && !currentChannelName.startsWith('Snoop/')) {
                    logger.warn(`[ARI] StasisEnd for untracked channel ${channelId} (${currentChannelName}).`);
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
                        logger.info(`[ARI] Snoop channel ${channelId} destroyed (parent: ${mainCallId}). Updating tracker.`);
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
            const currentChannelName = channel.name || 'Unknown';
            logger.info(`[ARI VAD] >>> Talking STARTED on channel ${channel.id} (${currentChannelName})`);
        });

        this.client.on('ChannelTalkingFinished', (event, channel) => {
            const currentChannelName = channel.name || 'Unknown';
            logger.info(`[ARI VAD] <<< Talking FINISHED on channel ${channel.id} (${currentChannelName}). Duration: ${event.duration}ms`);
        });

        this.client.on('ChannelRtpStarted', async (event, channel) => {
            if (!channel.name.startsWith('UnicastRTP/')) return;

            logger.info('[ARI] 🔥 ChannelRtpStarted for', channel.id, 'with SSRC', event.ssrc);

            // This event is primarily for the inbound stream (from snoop). 
            // We need to find the parent call to map the SSRC.
            let parentId = null;
            for (const [callId, data] of this.tracker.calls.entries()) {
                // Check if this UnicastRTP channel belongs to an active snoop session
                if (data.snoopChannel && data.state === 'external_media_read_active') {
                    // This is a heuristic. A more robust way might be needed if multiple snoops happen at once.
                    // For now, assume the first one we find is the right one.
                    parentId = callId;
                    logger.info(`[ARI] Found parent call ${parentId} for inbound RTP stream ${channel.id}`);
                    break;
                }
            }

            if (!parentId) {
                logger.warn(`[ARI] No parent call found for RTP channel ${channel.id} during SSRC mapping.`);
                return;
            }

            const callData = this.tracker.getCall(parentId);
            if (!callData) {
                logger.warn(`[ARI] No call data found for parent ${parentId}`);
                return;
            }

            // Get the Twilio SID to use as the primary identifier
            const twilioSid = callData.twilioCallSid;
            if (!twilioSid) {
                logger.error(`[ARI] No Twilio SID found for call ${parentId}, using Asterisk ID as fallback`);
                // Fallback to Asterisk ID if no Twilio SID
                rtpListenerService.addSsrcMapping(event.ssrc, parentId);
            } else {
                // Use Twilio SID as the primary identifier
                rtpListenerService.addSsrcMapping(event.ssrc, twilioSid);
                logger.info(`[ARI] Mapped SSRC ${event.ssrc} → Twilio SID ${twilioSid}`);
            }
            
            // Still update the tracker with the SSRC
            this.tracker.updateCall(parentId, { 
                rtp_ssrc: event.ssrc,
                awaitingSsrcForRtp: false // No longer awaiting SSRC
            });
        });

        this.client.on('ChannelDtmfReceived', (event, channel) => {
            const digit = event.digit;
            const channelId = channel.id;
            const callData = this.tracker.getCall(channelId) || Array.from(this.tracker.calls.values()).find(cd => cd.snoopChannelId === channelId);
            const primarySid = callData?.twilioCallSid || callData?.asteriskChannelId || channelId;
            logger.info(`[ARI] DTMF '${digit}' on ${channelId} (CallID: ${primarySid})`);
        });

        this.client.on('error', (err) => {
            logger.error(`[ARI] Client error: ${err.message}`, err);
        });

        logger.info('[ARI] Event handlers set up successfully.');
    }

    async setupMediaPipeline(channel, twilioCallSid, patientId) {
        const asteriskChannelId = channel.id;
        logger.info(`[ARI Pipeline] Setting up for Asterisk ID: ${asteriskChannelId}, Twilio SID: ${twilioCallSid}, PatientID: ${patientId}`);
        this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_setup' });
        let mainBridge = null;
        let dbConversationId = null;

        await require('./rtp.listener.service').ensureReady();

        try {
            if (!patientId) {
                logger.error(`[ARI Pipeline] Critical: PatientID is missing for main channel ${asteriskChannelId}`);
                throw new Error('PatientID is missing, cannot create conversation record for media pipeline.');
            }
            if (!twilioCallSid) {
                logger.error(`[ARI Pipeline] Critical: twilioCallSid is missing for main channel ${asteriskChannelId}`);
                throw new Error('twilioCallSid is missing, cannot create conversation record for media pipeline.');
            }

            const conversationRecordKey = twilioCallSid;
            const conversationData = {
                callSid: conversationRecordKey,
                asteriskChannelId,
                startTime: new Date(),
                callType: 'asterisk-call',
                status: 'active',
                patientId: null
            };

            const patientDoc = await Patient.findById(patientId).select('_id name').lean().catch((err) => {
                logger.error(`[ARI Pipeline] Error finding patient with ID ${patientId}: ${err.message}`);
                return null;
            });

            if (patientDoc && patientDoc._id) {
                conversationData.patientId = patientDoc._id;
                logger.info(`[ARI Pipeline] Found patient ${patientDoc._id} for patientId ${patientId}.`);
            } else {
                logger.error(`[ARI Pipeline] Patient with ID ${patientId} not found or error fetching.`);
            }
            
            if (conversationData.patientId) {
                const conversation = await Conversation.findOneAndUpdate(
                    { callSid: conversationRecordKey },
                    { $set: conversationData, $setOnInsert: { createdAt: new Date() } },
                    { new: true, upsert: true, runValidators: true }
                ).catch(dbErr => {
                    logger.error(`[ARI Pipeline] DB Conversation error for ${conversationRecordKey}: ${dbErr.message}`, dbErr);
                    return null;
                });

                if (conversation && conversation._id) {
                    dbConversationId = conversation._id.toString();
                    this.tracker.updateCall(asteriskChannelId, { conversationId: dbConversationId });
                    logger.info(`[ARI Pipeline] Conversation record ${dbConversationId} created/updated for call ${conversationRecordKey}`);
                } else {
                    logger.warn(`[ARI Pipeline] Failed to create/update conversation record for ${conversationRecordKey}.`);
                }
            } else {
                logger.warn(`[ARI Pipeline] Skipping DB Conversation record for ${conversationRecordKey} due to missing patientId link.`);
            }

            const initialPrompt = "You are Bianca, a helpful AI assistant from the patient's care team.";

            const initialized = await openAIService.initialize(
                asteriskChannelId,
                twilioCallSid,
                dbConversationId,
                initialPrompt
            );
            if (!initialized) {
                throw new Error('OpenAI service failed to initialize');
            }

            mainBridge = await this.client.bridges.create({ type: 'mixing', name: `call-${asteriskChannelId}` });
            this.tracker.updateCall(asteriskChannelId, { mainBridge, mainBridgeId: mainBridge.id });
            logger.info(`[ARI Pipeline] Created main bridge ${mainBridge.id} for ${asteriskChannelId}`);

            await this.client.bridges.addChannel({
                bridgeId: mainBridge.id,
                channel: asteriskChannelId
            });
            this.tracker.updateCall(asteriskChannelId, { state: 'main_bridged' });
            logger.info(`[ARI Pipeline] Added main channel ${asteriskChannelId} to bridge ${mainBridge.id}`);

            const recordingName = `recording-${asteriskChannelId.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            try {
                mainBridge.record({ name: recordingName, format: 'wav', maxDurationSeconds: 3600, beep: false, ifExists: 'overwrite' });
                this.tracker.updateCall(asteriskChannelId, { recordingName });
                logger.info(`[ARI Pipeline] Started recording ${recordingName} on bridge ${mainBridge.id}`);
            } catch (recordErr) {
                logger.error(`[ARI Pipeline] Main bridge record failed: ${recordErr.message}`);
            }

            openAIService.setNotificationCallback((callbackId, type, data) => {
                if (type === 'audio_chunk' && data?.audio) {
                    // Check if this is an asterisk channel ID
                    let targetChannelId = callbackId;
                    let callData = this.tracker.getCall(callbackId);
                    
                    // If not found, try as Twilio SID
                    if (!callData) {
                        const foundCall = this.tracker.findCallByTwilioCallSid(callbackId);
                        if (foundCall) {
                            targetChannelId = foundCall.asteriskChannelId;
                            callData = foundCall;  // Now callData has the full object
                        }
                    }
                    
                    if (targetChannelId) {
                        this.handleOpenAIAudio(targetChannelId, data.audio);
                    } else {
                        logger.warn(`[ARI] Received audio for unknown call ID: ${callbackId}`);
                    }
                } else if (type === 'openai_session_expired') {
                    // Find the right channel
                    let callData = this.tracker.getCall(callbackId);
                    if (!callData) {
                        callData = this.tracker.findCallByTwilioCallSid(callbackId);
                    }
                    
                    if (callData) {
                        logger.warn(`[ARI] OpenAI session expired for ${callData.asteriskChannelId}`);
                        // For now, let's just log it and let OpenAI handle reconnection
                    }
                } else if (type === 'openai_max_reconnect_failed') {
                    // This definitely should trigger cleanup
                    let callData = this.tracker.getCall(callbackId);
                    if (!callData) {
                        callData = this.tracker.findCallByTwilioCallSid(callbackId);
                    }
                    
                    if (callData) {
                        logger.error(`[ARI] OpenAI max reconnection attempts failed for ${callData.asteriskChannelId}`);
                        this.cleanupChannel(callData.asteriskChannelId, "OpenAI connection failed");
                    }
                }
            });
            logger.info(`[ARI Pipeline] OpenAI initialized and callback set for Asterisk ID: ${asteriskChannelId}.`);

            await this.initiateSnoopForExternalMedia(asteriskChannelId, channel);
            this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_active_extmedia' });

        } catch (err) {
            logger.error(`[ARI Pipeline] Error in setupMediaPipeline for ${asteriskChannelId}: ${err.message}`, err);
            if (mainBridge && mainBridge.id) {
                await mainBridge.destroy().catch(e => logger.warn(`[ARI Pipeline] Error destroying mainBridge: ${e.message}`));
            }
            throw err;
        }
    }

    async initiateSnoopForExternalMedia(asteriskChannelId, mainChannelObject) {
        logger.info(`[ExternalMedia Setup] Starting for main channel: ${asteriskChannelId}`);
        let snoopChannel = null;
        let playbackChannel = null;
        
        try {
            const rtpSessionId = `rtp-${uuidv4()}`;
            const snoopId = `snoop-extmedia-${uuidv4()}`;
            const playbackId = `playback-extmedia-${uuidv4()}`;
            
            // Set up tracking BEFORE creating the snoop
            this.tracker.updateCall(asteriskChannelId, {
                rtpSessionId: rtpSessionId,
                expectingRtpChannel: true,
                pendingSnoopId: snoopId,
                pendingPlaybackId: playbackId
            });
            
            // 1. Create snoop channel
            snoopChannel = await this.client.channels.snoopChannel({
                channelId: asteriskChannelId,
                snoopId: snoopId,
                spy: 'in',
                app: 'myphonefriend'
            });
            
            logger.info(`[ExternalMedia Setup] Created snoop channel ${snoopChannel.id}`);
            
            // 2. Set up listener for playback channel BEFORE creating it
            const playbackPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for playback channel'));
                }, 5000);
                
                // Listen for StasisStart events on the ARI client
                const checkStasisStart = (event, channel) => {
                    // Check if this is a playback channel for our call
                    if (channel.name && 
                        channel.name.includes(`playback-${asteriskChannelId}`) && 
                        channel.name.includes('@playback-context')) {
                        
                        // Look for ;2 in the channel name to identify leg 2
                        if (channel.name.includes(';2')) {
                            logger.info(`[ExternalMedia Setup] Found playback leg 2: ${channel.id} (${channel.name})`);
                            clearTimeout(timeout);
                            this.client.removeListener('StasisStart', checkStasisStart);
                            resolve(channel);
                        } else if (channel.name.includes(';1')) {
                            logger.info(`[ExternalMedia Setup] Saw playback leg 1: ${channel.id} (${channel.name}), waiting for leg 2...`);
                        }
                    }
                };
                
                this.client.on('StasisStart', checkStasisStart);
            });
            
            // 3. Create the playback channel
            const originateResult = await this.client.channels.originate({
                endpoint: `Local/playback-${asteriskChannelId}@playback-context`,
                app: 'myphonefriend',
                appArgs: `playback-for-${asteriskChannelId}`,
                callerId: 'OpenAI <openai>'
            });
            
            logger.info(`[ExternalMedia Setup] Originate started, initial channel: ${originateResult.id}`);
            
            // 4. Wait for leg 2 to enter Stasis
            const leg2Channel = await playbackPromise;
            logger.info(`[ExternalMedia Setup] Playback channel leg 2 ready: ${leg2Channel.id}`);
            
            // The leg2Channel from StasisStart is what we'll use for external media
            // Update tracking with the correct channel ID (leg 2)
            this.tracker.updateCall(asteriskChannelId, {
                snoopChannel: snoopChannel,
                snoopChannelId: snoopChannel.id,
                playbackChannel: leg2Channel, // Use the leg 2 channel
                playbackChannelId: leg2Channel.id,
                snoopMethod: 'externalMedia',
                state: 'external_media_channels_created',
                pendingSnoopId: null,
                pendingPlaybackId: null
            });
            
        } catch (err) {
            logger.error(`[ExternalMedia Setup] Failed to create channels for ${asteriskChannelId}: ${err.message}`, err);
            
            // Cleanup on error
            if (snoopChannel && snoopChannel.id && !snoopChannel.destroyed) {
                await snoopChannel.hangup().catch(e => 
                    logger.warn(`[ExternalMedia Setup] Error hanging up snoop channel: ${e.message}`)
                );
            }
            
            // Note: playbackChannel is not assigned in this scope, the leg2Channel is.
            // The cleanup logic will handle any orphaned channels via their main cleanup flow.
            
            this.tracker.updateCall(asteriskChannelId, {
                state: 'snoop_extmedia_failed',
                snoopChannel: null,
                snoopChannelId: null,
                playbackChannel: null,
                playbackChannelId: null
            });
            
            throw err;
        }
    }

    async initializeRtpSenderWithEndpoint(asteriskChannelId, rtpEndpoint) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) {
            logger.error(`[RTP Sender] No call data found for ${asteriskChannelId}`);
            return;
        }

        const twilioSid = callData.twilioCallSid || asteriskChannelId;
        logger.info(`[RTP Sender] Initializing RTP sender for ${twilioSid} to send to Asterisk at ${rtpEndpoint.host}:${rtpEndpoint.port}`);
        
        // Notify the RTP sender service with the CORRECT Asterisk endpoint
        const rtpSenderService = require('./rtp.sender.service');
        await rtpSenderService.initializeCall(twilioSid, {
            asteriskChannelId,
            rtpHost: rtpEndpoint.host,     // Use Asterisk's actual RTP endpoint!
            rtpPort: rtpEndpoint.port,     // Use Asterisk's actual RTP port!
            format: this.RTP_SEND_FORMAT
        });
    }

    // Enhanced StasisStart handler for both snoop and playback channels
    async handleStasisStartForSnoop(channel, currentChannelName) {
        const channelId = channel.id;
        
        if (currentChannelName.startsWith('Snoop/')) {
            logger.info(`[ARI] StasisStart for Snoop channel: ${channelId}`);

            // Regex now looks for the parent ID before the first dash.
            const match = currentChannelName.match(/^Snoop\/([^-]+)-/);
            const parentChannelId = match ? match[1] : null;
            
            if (!parentChannelId) {
                logger.error(`[ARI] Cannot extract parent ID from snoop channel name: ${currentChannelName}`);
                await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up snoop: ${e.message}`));
                return;
            }

            const parentCallData = this.tracker.getCall(parentChannelId);
            if (!parentCallData) {
                logger.error(`[ARI] Snoop channel ${channelId} entered Stasis, but parent call ${parentChannelId} not found. Hanging up.`);
                await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up orphaned snoop: ${e.message}`));
                return;
            }
            
            this.tracker.updateCall(parentChannelId, { 
                snoopChannel: channel, 
                snoopChannelId: channelId,
                pendingSnoopId: null
            });

            try {
                await channel.answer();
                logger.info(`[ARI] Answered snoop channel ${channelId}. Starting READ ExternalMedia.`);
                
                const rtpReadDest = `${this.RTP_BIANCA_HOST}:${this.RTP_BIANCA_RECEIVE_PORT}`;
                const rtpSessionId = parentCallData.rtpSessionId;
                
                this.tracker.updateCall(parentChannelId, { 
                    snoopToRtpMapping: rtpSessionId,
                    state: 'external_media_read_active',
                    awaitingSsrcForRtp: true 
                });

                await channel.externalMedia({
                    app: 'myphonefriend',
                    external_host: rtpReadDest,
                    format: this.RTP_SEND_FORMAT,
                    direction: 'read' // Asterisk sends TO our app
                });
                
                logger.info(`[ARI] READ ExternalMedia started: snoop ${channelId} → ${rtpReadDest}`);
            } catch (err) {
                logger.error(`[ARI] Failed to start READ ExternalMedia on snoop ${channelId}: ${err.message}`, err);
                await this.cleanupChannel(parentChannelId, `READ ExternalMedia setup failed for snoop ${channelId}`);
            }
        }
    }

    async handleStasisStartForPlayback(channel, currentChannelName, event) {
        const channelId = channel.id;
        
        if (currentChannelName.startsWith('Local/playback-')) {
            logger.info(`[ARI] StasisStart for Playback channel: ${channelId} (${currentChannelName})`);

            const match = currentChannelName.match(/^Local\/playback-([^@]+)@/);
            const parentChannelId = match ? match[1] : null;
            
            const isLeg2 = currentChannelName.includes(';2');
            
            if (!parentChannelId) {
                logger.error(`[ARI] Cannot extract parent ID from playback channel name: ${currentChannelName}`);
                await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up playback: ${e.message}`));
                return;
            }

            const parentCallData = this.tracker.getCall(parentChannelId);
            if (!parentCallData) {
                logger.error(`[ARI] Playback channel ${channelId} entered Stasis, but parent call ${parentChannelId} not found. Hanging up.`);
                await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up orphaned playback: ${e.message}`));
                return;
            }
            
            if (isLeg2) {
                this.tracker.updateCall(parentChannelId, { 
                    playbackChannel: channel, 
                    playbackChannelId: channelId,
                    pendingPlaybackId: null
                });

                try {
                    await channel.answer();
                    logger.info(`[ARI] Answered playback channel ${channelId}`);
                    
                    const rtpAsteriskSource = `${this.RTP_BIANCA_HOST}:${this.RTP_BIANCA_SEND_PORT}`;
                    
                    // Create the external media channel for playback (direction: 'write')
                    const unicastRtpChannel = await channel.externalMedia({
                        app: 'myphonefriend',
                        external_host: rtpAsteriskSource,
                        format: this.RTP_SEND_FORMAT,
                        direction: 'write'
                    });
                    
                    logger.info(`[ARI] WRITE ExternalMedia channel created: ${unicastRtpChannel.id} (${unicastRtpChannel.name})`);
                    
                    // The outbound media channel MUST be added to the bridge for the caller to hear it
                    logger.info(`[ARI] Adding outbound media channel ${unicastRtpChannel.id} to bridge ${parentCallData.mainBridgeId}`);
                    await this.client.bridges.addChannel({
                        bridgeId: parentCallData.mainBridgeId,
                        channel: unicastRtpChannel.id
                    });

                    // Now, get the endpoint where we need to send RTP audio TO
                    let asteriskRtpEndpoint = null;
                    try {
                        const addressVar = await this.client.channels.getChannelVar({ channelId: unicastRtpChannel.id, variable: 'UNICASTRTP_LOCAL_ADDRESS' });
                        const portVar = await this.client.channels.getChannelVar({ channelId: unicastRtpChannel.id, variable: 'UNICASTRTP_LOCAL_PORT' });
                        
                        if (!addressVar || !addressVar.value || !portVar || !portVar.value) {
                            throw new Error('UNICASTRTP_LOCAL_ADDRESS or UNICASTRTP_LOCAL_PORT variables not set on the channel by Asterisk.');
                        }
                        
                        asteriskRtpEndpoint = {
                            host: addressVar.value,
                            port: parseInt(portVar.value)
                        };
                        
                        logger.info(`[ARI] Got Asterisk RTP endpoint from channel variables: ${asteriskRtpEndpoint.host}:${asteriskRtpEndpoint.port}`);
                        
                    } catch (varErr) {
                        logger.error(`[ARI] CRITICAL: Failed to get UNICASTRTP variables from channel ${unicastRtpChannel.id}. This is required for audio playback. Error: ${varErr.message}`);
                        throw varErr;
                    }
                    
                    this.tracker.updateCall(parentChannelId, { 
                        state: 'external_media_write_active',
                        asteriskRtpEndpoint: asteriskRtpEndpoint,
                        unicastRtpChannel: unicastRtpChannel
                    });
                    
                    logger.info(`[ARI] WRITE ExternalMedia active: ${rtpAsteriskSource} → Asterisk at ${asteriskRtpEndpoint.host}:${asteriskRtpEndpoint.port}`);
                    
                    await this.initializeRtpSenderWithEndpoint(parentChannelId, asteriskRtpEndpoint);

                } catch (err) {
                    logger.error(`[ARI] Failed to start WRITE ExternalMedia on playback ${channelId}: ${err.message}`, err);
                    
                    await channel.hangup().catch(() => {});
                    
                    this.tracker.updateCall(parentChannelId, { 
                        playbackChannel: null, 
                        playbackChannelId: null,
                        state: 'external_media_read_only'
                    });
                    
                    logger.warn(`[ARI] Continuing call ${parentChannelId} in READ-only mode (no OpenAI audio playback)`);
                }
            }
        }
    }

    handleOpenAIAudio(asteriskChannelId, audioBase64Ulaw) {
        if (!audioBase64Ulaw) {
            logger.warn(`[ARI Playback] Received empty audio for ${asteriskChannelId}. Skipping.`);
            return;
        }
        
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) {
            logger.warn(`[ARI Playback] No call data found for ${asteriskChannelId}`);
            return;
        }

        const twilioSid = callData.twilioCallSid || asteriskChannelId;
        
        // Send audio via RTP instead of file playback
        const rtpSenderService = require('./rtp.sender.service');
        rtpSenderService.sendAudio(twilioSid, audioBase64Ulaw);
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

    // Enhanced cleanup to handle all related channels and resources
    async cleanupChannel(asteriskChannelIdToClean, reason = "Unknown") {
        logger.info(`[Cleanup] Initiating for Asterisk ID: ${asteriskChannelIdToClean}. Reason: ${reason}`);
        
        const resources = this.tracker.getResources(asteriskChannelIdToClean);
        if (!resources) {
            logger.warn(`[Cleanup] No resources found for ${asteriskChannelIdToClean} - may have already been cleaned up`);
            return;
        }
        
        const primarySidForOpenAI = resources.twilioCallSid || resources.asteriskChannelId || asteriskChannelIdToClean;
        const ssrcToRemove = resources.rtp_ssrc;
        
        // Remove from tracker first to prevent re-entry
        const removedSuccessfully = this.tracker.removeCall(asteriskChannelIdToClean);
        if (!removedSuccessfully) {
            logger.warn(`[Cleanup] Channel ${asteriskChannelIdToClean} was not in tracker during removal`);
        }
        
        // Clean up RTP sender
        if (primarySidForOpenAI) {
            const rtpSenderService = require('./rtp.sender.service');
            rtpSenderService.cleanupCall(primarySidForOpenAI);
        }
        
        // Remove SSRC mapping if exists
        if (ssrcToRemove) {
            try {
                rtpListenerService.removeSsrcMapping(ssrcToRemove);
                logger.info(`[Cleanup] Removed SSRC mapping for ${ssrcToRemove}`);
            } catch (e) {
                logger.warn(`[Cleanup] Error removing SSRC mapping for ${ssrcToRemove}: ${e.message}`);
            }
        }
        
        // Stop recordings
        if (resources.mainBridge && resources.recordingName) {
            try {
                await this.client.recordings.stop({ recordingName: resources.recordingName });
                logger.info(`[Cleanup] Successfully stopped recording ${resources.recordingName}`);
            } catch (e) {
                if (e.message && e.message.includes('404')) {
                    logger.info(`[Cleanup] Recording ${resources.recordingName} already stopped (404)`);
                } else {
                    logger.warn(`[Cleanup] Error stopping recording: ${e.message}`);
                }
            }
        }
        
        // Helper functions for safe cleanup
        const safeHangup = async (channel, type) => {
            if (!channel || typeof channel.hangup !== 'function') return;
            try {
                // Check if channel exists before trying to hangup
                await channel.get(); 
                await channel.hangup();
                logger.info(`[Cleanup] Hung up ${type} channel ${channel.id}`);
            } catch (e) {
                if (e.message && e.message.includes('404')) {
                    logger.info(`[Cleanup] ${type} channel ${channel.id} already gone (404)`);
                } else {
                    logger.warn(`[Cleanup] Error hanging up ${type} channel ${channel.id}: ${e.message}`);
                }
            }
        };

        const safeDestroy = async (bridge, type) => {
            if (!bridge || typeof bridge.destroy !== 'function') return;
            try {
                await bridge.destroy();
                logger.info(`[Cleanup] Destroyed ${type} bridge ${bridge.id}`);
            } catch (e) {
                if (e.message && e.message.includes('404')) {
                    logger.info(`[Cleanup] ${type} bridge ${bridge.id} already gone (404)`);
                } else {
                    logger.warn(`[Cleanup] Error destroying ${type} bridge ${bridge.id}: ${e.message}`);
                }
            }
        };
        
        // Clean up all channels
        await safeHangup(resources.snoopChannel, 'Snoop');
        await safeHangup(resources.playbackChannel, 'Playback');
        await safeHangup(resources.inboundRtpChannel, 'InboundRTP');
        await safeHangup(resources.unicastRtpChannel, 'UnicastRTP');
        
        // Clean up main channel and bridge last
        await safeHangup(resources.mainChannel, 'Main');
        await safeDestroy(resources.mainBridge, 'Main');
        
        // Disconnect OpenAI service
        if (primarySidForOpenAI) {
            try {
                logger.info(`[Cleanup] Disconnecting OpenAI service for: ${primarySidForOpenAI}`);
                await openAIService.disconnect(primarySidForOpenAI);
            } catch(e) {
                logger.warn(`[Cleanup] Error disconnecting OpenAI: ${e.message}`);
            }
        }
        
        // Update database conversation status
        if (resources.conversationId) {
            try {
                await Conversation.findByIdAndUpdate(
                    resources.conversationId, 
                    {
                        status: 'completed',
                        endTime: new Date(),
                        cleanupReason: reason
                    }
                );
            } catch (e) {
                logger.error(`[Cleanup] Error updating DB conversation: ${e.message}`);
            }
        }
        
        logger.info(`[Cleanup] Completed all cleanup operations for ${asteriskChannelIdToClean}`);
    }

    async shutdown() {
        logger.info('[ARI] Shutting down ARI client');
        
        // Clean up RTP sender service
        try {
            const rtpSenderService = require('./rtp.sender.service');
            rtpSenderService.cleanupAll();
        } catch (err) {
            logger.warn(`[ARI] Error cleaning up RTP sender: ${err.message}`);
        }
        
        if (this.client) {
            this.client.close();
            logger.info('[ARI] Client closed');
        }
        this.isConnected = false;
        global.ariClient = null;
        logger.info('[ARI] Shutdown complete');
    }
}

const ariClientInstance = new AsteriskAriClient();

module.exports = {
    startAriClient: async () => {
        if (!ariClientInstance.isConnected && ariClientInstance.retryCount === 0) {
            await ariClientInstance.start();
        } else if (ariClientInstance.isConnected) {
            logger.info('[ARI] Client already connected.');
        } else {
            logger.info('[ARI] Client is currently in a retry sequence.');
        }
        return ariClientInstance;
    },
    getAriClientInstance: () => ariClientInstance,
    
    // Add shutdown handler for graceful application termination
    shutdownAriClient: async () => {
        if (ariClientInstance.isConnected) {
            await ariClientInstance.shutdown();
            return true;
        }
        return false;
    }
};
