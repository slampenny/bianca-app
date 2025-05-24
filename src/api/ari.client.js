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
    return u.hostname;    // includes port if present
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
        this.RTP_LISTENER_HOST = sanitizeHost(config.asterisk.rtpListenerHost);
        this.RTP_LISTENER_PORT = config.asterisk.rtpListenerPort;
        this.RTP_SEND_FORMAT = 'slin';
    }

    async waitForReady() {
    if (!this.isConnected) {
        throw new Error('ARI client not connected');
    }
    
    // Verify the Stasis app is registered by testing an API call
    try {
        const apps = await this.client.applications.list();
        const myApp = apps.find(app => app.name === 'myphonefriend');
        if (!myApp) {
            throw new Error('Stasis application myphonefriend not found');
        }
        logger.info('[ARI] Stasis application verified and ready');
        return true;
    } catch (err) {
        logger.error('[ARI] Stasis application not ready:', err.message);
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
                    keepAliveIntervalMs: 20000,      // send WebSocket-level PING every 20s
                    perMessageDeflate: false,        // avoid compression issues
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
                logger.warn('[ARI] WS reconnecting:', err.message || err);
            });
            this.client.on('WebSocketMaxRetries', err => {
                logger.error('[ARI] WS max retries:', err.message || err);
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
                logger.info(`[ARI] StasisStart for Snoop channel: ${channelId}`);
    
                // Extract parent channel ID from the snoop channel name
                // Format: "Snoop/1748064751.1-00000000"
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
                
                // Verify this is our expected snoop channel (optional check)
                if (parentCallData.pendingSnoopId && parentCallData.pendingSnoopId !== channelId) {
                    logger.warn(`[ARI] Snoop channel ID mismatch. Expected: ${parentCallData.pendingSnoopId}, Got: ${channelId}`);
                }
                
                this.tracker.updateCall(parentChannelId, { 
                    snoopChannel: channel, 
                    snoopChannelId: channelId,
                    pendingSnoopId: null // Clear pending ID
                });

                try {
                    await channel.answer();
                    logger.info(`[ARI] Answered snoop channel ${channelId}. Starting ExternalMedia.`);
                    const rtpDest = `${this.RTP_LISTENER_HOST}:${this.RTP_LISTENER_PORT}`;
                    logger.info(`[ARI] Instructing Asterisk to send ExternalMedia from snoop ${channelId} to: ${rtpDest}`);
                    
                    const rtpSessionId = parentCallData.rtpSessionId;
                    
                    this.tracker.updateCall(parentChannelId, { 
                        snoopToRtpMapping: rtpSessionId 
                    });

                    await channel.externalMedia({
                        app: 'myphonefriend',
                        external_host: rtpDest,
                        format: this.RTP_SEND_FORMAT,
                        direction: 'read',
                    });
                    
                    logger.info(`[ARI] ExternalMedia command sent for snoop ${channelId} -> ${rtpDest}`);
                    this.tracker.updateCall(parentChannelId, { 
                        state: 'external_media_active_awaiting_ssrc',
                        awaitingSsrcForRtp: true 
                    });
                } catch (err) {
                    logger.error(`[ARI] Failed to start ExternalMedia on snoop ${channelId}: ${err.message}`, err);
                    await this.cleanupChannel(parentChannelId, `ExternalMedia setup failed for snoop ${channelId}`);
                }
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
                logger.info('[ARI] 🔥 HIT UnicastRTP branch for', channel.id);

                // derive the “base” of the channel (e.g. “1748053672” from “1748053672.9”)
                const [base] = channel.id.split('.');
                // find whichever tracked call starts with that same base (whatever suffix it has)
                const parentId = Array.from(this.tracker.calls.keys())
                    .find(id => id.startsWith(`${base}.`));

                if (!parentId) {
                    logger.warn(`[ARI] No parent call found for RTP channel ${channel.id}`);
                    return;
                }

                const callData = this.tracker.getCall(parentId);
                logger.info(`[ARI] Bridging RTP ${channel.id} into bridge ${callData.mainBridgeId}`);

                await this.client.bridges.addChannel({
                    bridgeId: callData.mainBridgeId,
                    channel: channel.id
                });
                this.tracker.updateCall(parentId, { state: 'external_media_bridged' });
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

            logger.info('[ARI] 🔥 ChannelRtpStarted for', channel.id);

            // derive the same base as in your UnicastRTP branch
            const [base] = channel.id.split('.');
            const parentId = Array.from(this.tracker.calls.keys())
                .find(id => id.startsWith(`${base}.`));

            if (!parentId) {
                logger.warn(`[ARI] No parent call found for RTP channel ${channel.id}`);
                return;
            }

            // now map the SSRC as before
            this.tracker.updateCall(parentId, { rtp_ssrc: event.ssrc });
            rtpListenerService.addSsrcMapping(event.ssrc, parentId);
            logger.info(`[ARI] Mapped SSRC ${event.ssrc} → call ${parentId}`);
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

            const initialPrompt = "You are Bianca, a helpful AI assistant from the patient's care team.";
            await openAIService.initialize(asteriskChannelId, twilioCallSid, dbConversationId, initialPrompt);
            openAIService.setNotificationCallback((callbackId, type, data) => {
                if (type === 'audio_chunk' && data?.audio) {
                    // Check if this is an asterisk channel ID
                    let targetChannelId = callbackId;
                    let callData = this.tracker.getCall(callbackId);
                    
                    // If not found, try as Twilio SID
                    if (!callData) {
                        callData = this.tracker.findCallByTwilioSid(callbackId);
                        if (callData) {
                            targetChannelId = callData.asteriskChannelId;
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
                        // Option 1: Try to reinitialize OpenAI
                        // Option 2: Hang up the call
                        // Option 3: Play a message to the caller
                        
                        // For now, let's just log it and let OpenAI handle reconnection
                        // If you want to hang up:
                        // this.cleanupChannel(callData.asteriskChannelId, "OpenAI session expired");
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
        try {
            const rtpSessionId = `rtp-${uuidv4()}`;
            const snoopId = `snoop-extmedia-${uuidv4()}`;
            
            // Set up tracking BEFORE creating the snoop
            this.tracker.updateCall(asteriskChannelId, {
                rtpSessionId: rtpSessionId,
                expectingRtpChannel: true,
                pendingSnoopId: snoopId // Track the expected snoop ID
            });
            
            snoopChannel = await this.client.channels.snoopChannel({
                channelId: asteriskChannelId,
                snoopId: snoopId,
                spy: 'in',
                app: 'myphonefriend'
                // Remove appArgs - it doesn't work reliably
            });
            
            logger.info(`[ExternalMedia Setup] Created snoop channel ${snoopChannel.id}`);
            
            this.tracker.updateCall(asteriskChannelId, {
                snoopChannel: snoopChannel,
                snoopChannelId: snoopChannel.id,
                snoopMethod: 'externalMedia',
                state: 'external_media_snoop_created',
                pendingSnoopId: null // Clear the pending ID
            });
        } catch (err) {
            logger.error(`[ExternalMedia Setup] Failed to create snoop channel for ${asteriskChannelId}: ${err.message}`, err);
            if (snoopChannel && snoopChannel.id && !snoopChannel.destroyed) {
                await snoopChannel.hangup().catch(e => logger.warn(`[ExternalMedia Setup] Error hanging up snoop channel: ${e.message}`));
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
    
    // Get resources BEFORE removing from tracker
    const resources = this.tracker.getResources(asteriskChannelIdToClean);
    if (!resources) {
        logger.warn(`[Cleanup] No resources found for ${asteriskChannelIdToClean} - may have already been cleaned up`);
        return;
    }
    
    // Determine the primary identifier for OpenAI service
    const primarySidForOpenAI = resources.twilioCallSid || resources.asteriskChannelId || asteriskChannelIdToClean;
    const ssrcToRemove = resources.rtp_ssrc;
    
    // NOW remove from tracker (after we've extracted all needed info)
    const removedSuccessfully = this.tracker.removeCall(asteriskChannelIdToClean);
    if (!removedSuccessfully) {
        logger.warn(`[Cleanup] Channel ${asteriskChannelIdToClean} was not in tracker during removal`);
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
    
    // Stop any active recordings
    if (resources.mainBridge && resources.recordingName) {
        try {
            logger.info(`[Cleanup] Stopping recording ${resources.recordingName} on bridge ${resources.mainBridge.id}`);
            await resources.mainBridge.stopRecord({ recordingName: resources.recordingName });
            logger.info(`[Cleanup] Successfully stopped recording ${resources.recordingName}`);
        } catch (e) {
            if (e.message && e.message.includes('404')) {
                logger.info(`[Cleanup] Recording ${resources.recordingName} already stopped or bridge gone (404)`);
            } else {
                logger.warn(`[Cleanup] Error stopping recording: ${e.message}`);
            }
        }
    }
    
    // Helper function to safely hang up channels
    const safeHangup = async (channel, type) => {
        if (!channel || typeof channel.hangup !== 'function') {
            logger.debug(`[Cleanup] No ${type} channel to hang up`);
            return;
        }
        
        try {
            // Check if channel still exists in Asterisk
            await channel.get();
            await channel.hangup();
            logger.info(`[Cleanup] Hung up ${type} channel ${channel.id}`);
        } catch (e) {
            if (e.message && e.message.includes('404')) {
                logger.info(`[Cleanup] ${type} channel ${channel.id || 'unknown'} already gone (404)`);
            } else {
                logger.warn(`[Cleanup] Error hanging up ${type} channel: ${e.message}`);
            }
        }
    };
    
    // Helper function to safely destroy bridges
    const safeDestroy = async (bridge, type) => {
        if (!bridge || typeof bridge.destroy !== 'function') {
            logger.debug(`[Cleanup] No ${type} bridge to destroy`);
            return;
        }
        
        try {
            await bridge.destroy();
            logger.info(`[Cleanup] Destroyed ${type} bridge ${bridge.id}`);
        } catch (e) {
            if (e.message && e.message.includes('404')) {
                logger.info(`[Cleanup] ${type} bridge ${bridge.id || 'unknown'} already gone (404)`);
            } else {
                logger.warn(`[Cleanup] Error destroying ${type} bridge: ${e.message}`);
            }
        }
    };
    
    // Clean up channels and bridges in correct order
    await safeHangup(resources.snoopChannel, 'Snoop');
    await safeHangup(resources.localChannel, 'Local'); // For AudioSocket method
    await safeDestroy(resources.snoopBridge, 'Snoop'); // For AudioSocket method
    
    // Clean up FFmpeg process if exists
    if (resources.ffmpegTranscoder) {
        try {
            if (typeof resources.ffmpegTranscoder.kill === 'function') {
                resources.ffmpegTranscoder.kill('SIGTERM');
                logger.info('[Cleanup] Terminated FFmpeg transcoder process');
            }
        } catch (e) {
            logger.warn(`[Cleanup] Error terminating FFmpeg: ${e.message}`);
        }
    }
    
    // Hang up main channel and destroy main bridge
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
            logger.info(`[Cleanup] Updating DB conversation ${resources.conversationId} status to completed`);
            await Conversation.findByIdAndUpdate(
                resources.conversationId, 
                {
                    status: 'completed',
                    endTime: new Date(),
                    cleanupReason: reason
                },
                { new: true }
            );
        } catch (e) {
            logger.error(`[Cleanup] Error updating DB conversation: ${e.message}`);
        }
    }
    
    logger.info(`[Cleanup] Completed all cleanup operations for ${asteriskChannelIdToClean}`);
}

    async shutdown() {
        logger.info('[ARI] Shutting down ARI client');
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
