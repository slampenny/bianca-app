// src/services/ari.client.js

const AriClient = require('ari-client');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config/config'); // Your application's config file
const logger = require('../config/logger'); // Your application's logger
const openAIService = require('./openai.realtime.service'); // Your OpenAI service
const { Conversation, Patient } = require('../models'); // Your Mongoose models
const channelTracker = require('./channel.tracker'); // Your channel tracking utility
const rtpListenerService = require('./rtp.listener.service'); // Your RTP listener service

class AsteriskAriClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.tracker = channelTracker; // Use the shared tracker instance
        this.retryCount = 0;
        this.MAX_RETRIES = 10; // Max number of connection retries
        this.RETRY_DELAY = 3000; // Initial delay in ms, will increase with backoff
        this.keepAliveInterval = null; // For sending regular WebSocket pings
        global.ariClient = this; // Make instance globally accessible if needed by other modules
        this.lastPongTime = Date.now();
        this.PING_INTERVAL = 15000; // 15 seconds
        this.PONG_TIMEOUT = 45000;  // 45 seconds

        // Configuration for ExternalMedia, sourced from your main config file
        this.RTP_LISTENER_HOST = config.asterisk.rtpListenerHost;
        this.RTP_LISTENER_PORT = config.asterisk.rtpListenerPort; // Ensure this is the port your rtp.listener.service.js uses (e.g., 16384)
        this.RTP_SEND_FORMAT = 'slin'; // Asterisk sends 8kHz Signed Linear PCM
    }

    async start() {
        try {
            logger.info('[ARI] Connecting to Asterisk ARI...');
            const ariUrl = `${config.asterisk.url}/ari`; 
            const username = config.asterisk.username;
            const password = config.asterisk.password;

            if (!ariUrl || !username || !password) {
                logger.error('[ARI] Missing ARI connection details (URL, username, or password) in configuration.');
                throw new Error('ARI configuration incomplete.');
            }
            logger.info(`[ARI] Attempting connection to ${ariUrl} with user: ${username}`);

            // Add pre-connection diagnostic
            try {
                const testUrl = `${ariUrl}/applications`;
                logger.info(`[ARI] Testing ARI endpoint with HTTP request to: ${testUrl}`);
                
                // Using native fetch or another HTTP client you have available
                const response = await fetch(testUrl, {
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
                    }
                });
                
                if (response.ok) {
                    const data = await response.text();
                    logger.info(`[ARI] HTTP test successful - received ${data.length} bytes response`);
                } else {
                    logger.error(`[ARI] HTTP test failed with status ${response.status}: ${response.statusText}`);
                    logger.error(`[ARI] Response body: ${await response.text()}`);
                    throw new Error(`ARI endpoint test failed with status ${response.status}`);
                }
            } catch (testErr) {
                logger.error(`[ARI] Pre-connection test failed: ${testErr.message}`);
                if (testErr.code) {
                    logger.error(`[ARI] Error code: ${testErr.code}`);
                }
                // Log but continue - don't throw here to allow the actual connection attempt
            }

            // Main connection attempt with detailed error capture
            try {
                this.client = await AriClient.connect(ariUrl, username, password, {
                    webSocketHeaders: {
                        'User-Agent': 'Bianca-App/1.0',
                        'Connection': 'keep-alive',
                        'Keep-Alive': 'timeout=120'
                    },
                    reconnect: false
                });
                
                this.isConnected = true;
                this.retryCount = 0;
                logger.info('[ARI] Successfully connected to Asterisk ARI');
                
            } catch (connErr) {
                logger.error(`[ARI] Connection error details: ${connErr.message}`);
                logger.error(`[ARI] Error name: ${connErr.name}, code: ${connErr.code || 'N/A'}`);
                
                if (connErr.response) {
                    logger.error(`[ARI] Response status: ${connErr.response.status}`);
                    logger.error(`[ARI] Response body: ${JSON.stringify(connErr.response.data || {})}`);
                }
                
                // Check for specific error types
                if (connErr.message.includes('401')) {
                    logger.error('[ARI] Authentication failure - check username and password in config');
                } else if (connErr.code === 'ECONNREFUSED') {
                    logger.error('[ARI] Connection refused - Asterisk server may not be running or HTTP server not enabled');
                } else if (connErr.code === 'ENOTFOUND') {
                    logger.error('[ARI] Host not found - check hostname/DNS resolution for Asterisk server');
                }
                
                throw connErr; // Re-throw for the outer catch
            }

            // Set up WebSocket-specific event handlers
            this.setupWebSocketHandlers();
            
            // Setup application event handlers for Asterisk
            this.setupEventHandlers();

            // Register this Stasis application with Asterisk.
            // The name 'myphonefriend' must match the Stasis() app in your extensions.conf
            await this.client.start('myphonefriend');
            logger.info('[ARI] Subscribed to Stasis application: myphonefriend');

            // Start the keep-alive ping mechanism
            this.startKeepAlive();

        } catch (err) {
            logger.error(`[ARI] Connection error: ${err.message}`);
            this.isConnected = false;
            await this.reconnect();
        }
    }

    setupWebSocketHandlers() {
        if (!this.client || !this.client.ws) {
            logger.error('[ARI] Client WebSocket not available for event binding');
            return;
        }

        // Enhanced WebSocket error handling
        this.client.ws.on('error', (err) => {
            logger.error(`[ARI] WebSocket error: ${err.message}`);
            this.handleDisconnection('WebSocket error');
        });

        this.client.ws.on('close', (code, reason) => {
            const reasonStr = reason ? reason.toString() : 'No reason provided';
            logger.warn(`[ARI] WebSocket closed with code ${code}: ${reasonStr}`);
            this.handleDisconnection(`WebSocket closed: ${code} ${reasonStr}`);
        });

        this.client.ws.on('unexpected-response', (req, res) => {
            logger.error(`[ARI] WebSocket received unexpected response: ${res.statusCode}`);
            this.handleDisconnection('Unexpected WebSocket response');
        });

        this.client.ws.on('pong', () => {
            this.lastPongTime = Date.now();
            logger.debug('[ARI] Received WebSocket pong from Asterisk');
        });

        logger.info('[ARI] WebSocket event handlers set up');
    }

    startKeepAlive() {
        // Clear any existing interval first
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }

        this.lastPongTime = Date.now();

        // Setup ping interval to keep connection alive
        this.keepAliveInterval = setInterval(() => {
            try{
                if (Date.now() - this.lastPongTime > this.PONG_TIMEOUT) {
                    logger.warn(`[ARI] No pong received in ${this.PONG_TIMEOUT}ms, connection may be stale`);
                    this.handleDisconnection('Pong timeout');
                    return;
                }

                if (this.client && this.client.ws && this.client.ws.readyState === 1) { // 1 = OPEN
                    logger.debug('[ARI] Sending WebSocket ping to keep connection alive');
                    this.client.ws.ping('keepalive');
                } else if (this.isConnected) {
                    // WebSocket not open, but we think we're connected - handle inconsistency
                    logger.warn('[ARI] WebSocket not in OPEN state but client marked as connected. Fixing state...');
                    this.handleDisconnection('WebSocket not in OPEN state');
                }
            } catch (err) {
                logger.error(`[ARI] Error during WebSocket ping: ${err.message}`);
                this.handleDisconnection('Ping error');
            }
        }, 15000); // 30 seconds interval

        logger.info('[ARI] Started WebSocket keep-alive mechanism');
    }

    handleDisconnection(reason) {
        if (!this.isConnected) {
            // Already handled or handling disconnection
            return;
        }

        logger.warn(`[ARI] Handling disconnection: ${reason}`);
        this.isConnected = false;
        
        // Stop the keep-alive interval
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }

        // Attempt to close client gracefully if it exists
        if (this.client) {
            try {
                if (this.client.ws) {
                    this.client.ws.terminate();
                    logger.info('[ARI] WebSocket terminated');
                }
                this.client = null;
            } catch (err) {
                logger.error(`[ARI] Error during client cleanup: ${err.message}`);
            }
        }

        // Attempt to reconnect
        this.reconnect();
    }

    async reconnect() {
        if (this.retryCount >= this.MAX_RETRIES) {
            logger.error(`[ARI] Failed to reconnect after ${this.MAX_RETRIES} attempts. Giving up.`);
            return false;
        }

        this.retryCount++;
        
        // Exponential backoff with jitter and capped maximum
        const baseDelay = this.RETRY_DELAY * Math.pow(1.5, this.retryCount - 1);
        const jitter = Math.floor(Math.random() * 1000); // Add up to 1 second of jitter
        const delay = Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds max
        
        logger.info(`[ARI] Attempting reconnection in ${delay}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (!this.isConnected) { // Double-check we haven't reconnected through another path
            try {
                await this.start();
                return true;
            } catch (err) {
                logger.error(`[ARI] Reconnection attempt ${this.retryCount} failed: ${err.message}`);
                return false;
            }
        }
        return true;
    }

    setupEventHandlers() {
        if (!this.client) {
            logger.error("[ARI] Client not initialized. Cannot set up event handlers.");
            return;
        }
        logger.info('[ARI] Setting up event handlers...');

        this.client.on('StasisStart', async (event, channel) => {
            const channelId = channel.id;
            const currentChannelName = channel.name || 'Unknown'; // Get channel name from the event's channel object
            const appArgs = event.args || []; // StasisStart args from dialplan or snoop
            logger.info(`[ARI] StasisStart event for ${channelId} (${currentChannelName}), AppArgs: ${JSON.stringify(appArgs)}`);

            // Try to get parentCallId from appArgs (if this is a snoop channel)
            const parentIdArg = appArgs.find(arg => typeof arg === 'string' && arg.startsWith('snoop_parent_id='));
            const snoopParentIdFromArg = parentIdArg ? parentIdArg.split('=')[1] : null;

            if (snoopParentIdFromArg) { // This IS our snoop channel for ExternalMedia, identified by appArg
                logger.info(`[ARI] StasisStart for ExternalMedia snoop channel: ${channelId} (Parent ID from arg: ${snoopParentIdFromArg})`);
                const parentCallData = this.tracker.getCall(snoopParentIdFromArg);

                if (!parentCallData) {
                    logger.error(`[ARI] Snoop channel ${channelId} entered Stasis, but parent call ${snoopParentIdFromArg} not found in tracker. Hanging up snoop.`);
                    await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up orphaned snoop channel ${channelId}: ${e.message}`));
                    return;
                }
                // Ensure the current snoop channel object is associated with the parent in the tracker
                this.tracker.updateCall(snoopParentIdFromArg, { snoopChannel: channel, snoopChannelId: channelId });

                try {
                    await channel.answer();
                    logger.info(`[ARI] Answered snoop channel ${channelId}. Starting ExternalMedia.`);
                    const rtpDest = `${this.RTP_LISTENER_HOST}:${this.RTP_LISTENER_PORT}`;
                    logger.info(`[ARI] Instructing Asterisk to send ExternalMedia from snoop ${channelId} to: ${rtpDest}`);
                    await channel.externalMedia({
                        app: 'myphonefriend', // Stasis app for the internal UnicastRTP channel
                        external_host: rtpDest,
                        format: this.RTP_SEND_FORMAT, // e.g., 'slin'
                        direction: 'read', // Asterisk reads from the snoop channel and sends to external_host
                    });
                    logger.info(`[ARI] ExternalMedia command sent for snoop ${channelId} -> ${rtpDest}`);
                    this.tracker.updateCall(snoopParentIdFromArg, { state: 'external_media_active_awaiting_ssrc' });
                } catch (err) {
                    logger.error(`[ARI] Failed to start ExternalMedia on snoop ${channelId}: ${err.message}`, err);
                    // If snoop setup fails, we should clean up the parent call as the media pipeline is broken.
                    await this.cleanupChannel(snoopParentIdFromArg, `ExternalMedia setup failed for snoop ${channelId}`);
                }

            } else if (currentChannelName.startsWith('PJSIP/twilio-trunk-')) { // Main incoming call from Twilio
                logger.info(`[ARI] Handling StasisStart for Main incoming channel: ${channelId}`);
                let twilioCallSid = null;
                let patientId = null;

                try {
                    // Fetch the RAW_SIP_URI_FOR_ARI variable set by the dialplan
                    const channelVarResult = await channel.getChannelVar({ variable: 'RAW_SIP_URI_FOR_ARI' });
                    if (channelVarResult && typeof channelVarResult.value === 'string' && channelVarResult.value.length > 0) {
                        const rawSipUri = channelVarResult.value;
                        logger.info(`[ARI] Raw SIP URI for ${channelId} from channel var: ${rawSipUri}`);
                        
                        // Parse parameters from the raw SIP URI string
                        // Expected format: sip:user@host;param1=value1;param2=value2...
                        // Or: sip:user@host:port;param1=value1;param2=value2...
                        const uriParts = rawSipUri.split(';');
                        const params = {};
                        // Start from index 1 to skip the main sip:user@host or sip:user@host:port part
                        for (let i = 1; i < uriParts.length; i++) {
                            const [key, value] = uriParts[i].split('=');
                            if (key && value !== undefined) { // Check for value !== undefined in case of valueless params (though not expected here)
                                params[decodeURIComponent(key.trim())] = decodeURIComponent(value.trim());
                            }
                        }

                        if (params.patientId) patientId = params.patientId;
                        if (params.callSid) twilioCallSid = params.callSid;
                        
                        logger.info(`[ARI] Parsed from RAW_SIP_URI for ${channelId}: patientId=${patientId} (type: ${typeof patientId}), twilioCallSid=${twilioCallSid} (type: ${typeof twilioCallSid})`);
                    } else {
                        logger.warn(`[ARI] RAW_SIP_URI_FOR_ARI variable not found or empty for ${channelId}. Raw value: ${JSON.stringify(channelVarResult)}`);
                    }
                } catch (err) {
                    logger.warn(`[ARI] Error getting/parsing RAW_SIP_URI_FOR_ARI for ${channelId}: ${err.message}.`);
                }

                logger.info(`[ARI PRE-CHECK] For channel ${channelId}: twilioCallSid = "${twilioCallSid}" (type: ${typeof twilioCallSid}), patientId = "${patientId}" (type: ${typeof patientId})`);
                logger.info(`[ARI PRE-CHECK] Condition check: !twilioCallSid is ${!twilioCallSid}, !patientId is ${!patientId}, combined OR is ${!twilioCallSid || !patientId}`);

                if (!twilioCallSid || !patientId) {
                    logger.error(`[ARI] Critical: twilioCallSid or patientId is missing or invalid after parsing for main channel ${channelId}. Cannot proceed. TwilioSID: "${twilioCallSid}", PatientID: "${patientId}"`);
                    await channel.hangup().catch(e => logger.warn(`[ARI] Error hanging up main channel ${channelId} after missing/invalid params: ${e.message}`));
                    return;
                }

                this.tracker.addCall(channelId, {
                    channel: channel,       // Store the channel object itself
                    mainChannel: channel,   // Explicitly store as mainChannel for clarity
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
                logger.warn(`[ARI] StasisStart for unhandled/unknown channel type: ${channelId} (${currentChannelName}). Hanging up.`);
                await channel.hangup().catch(()=>{});
            }
        });

        this.client.on('StasisEnd', async (event, channel) => {
            const channelId = channel.id;
            const currentChannelName = channel.name || 'Unknown'; // Use channel.name
            logger.info(`[ARI] StasisEnd for channel ${channelId} (${currentChannelName})`);

            if (this.tracker.getCall(channelId)) { // Check if it's a main channel we are tracking
                logger.info(`[ARI] StasisEnd for tracked main channel ${channelId}. Initiating cleanup.`);
                this.cleanupChannel(channelId, "StasisEnd (Main Channel)").catch(err => {
                    logger.error(`[ARI] Error during cleanup from StasisEnd for ${channelId}: ${err.message}`);
                });
            } else {
                // Check if it's a snoop channel associated with a tracked main call
                let parentCallIdForSnoop = null;
                for (const [mainCallId, cData] of this.tracker.calls.entries()) {
                    if (cData.snoopChannelId === channelId) {
                        parentCallIdForSnoop = mainCallId;
                        logger.info(`[ARI] StasisEnd for ExternalMedia snoop channel ${channelId} (parent: ${mainCallId}).`);
                        // No immediate cleanup of parent call needed just because snoop ended stasis.
                        // Parent cleanup is handled by its own StasisEnd/ChannelDestroyed.
                        break;
                    }
                }
                 if (!parentCallIdForSnoop && currentChannelName.startsWith('UnicastRTP/')) {
                     logger.info(`[ARI] StasisEnd for internal UnicastRTP channel ${channelId}. Ignoring.`);
                } else if (!parentCallIdForSnoop && !currentChannelName.startsWith('Snoop/')) {
                    logger.warn(`[ARI] StasisEnd for untracked or non-snoop/UnicastRTP channel ${channelId} (${currentChannelName}).`);
                }
            }
        });

        this.client.on('ChannelDestroyed', async (event, channel) => {
            const channelId = channel.id;
            const currentChannelName = channel.name || 'Unknown'; // Use channel.name
            logger.info(`[ARI] ChannelDestroyed event for: ${channelId} (${currentChannelName})`);
            if (this.tracker.getCall(channelId)) { // If it's a tracked main channel
                logger.info(`[ARI] ChannelDestroyed for tracked main channel ${channelId}. Initiating cleanup.`);
                this.cleanupChannel(channelId, "ChannelDestroyed (Main Channel)").catch(err => {
                    logger.error(`[ARI] Error during cleanup from ChannelDestroyed for ${channelId}: ${err.message}`);
                });
            } else {
                // Check if it's a snoop channel being destroyed
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
            const currentChannelName = channel.name || 'Unknown'; // Use channel.name
            logger.info(`[ARI] ChannelHangupRequest for: ${channelId} (${currentChannelName}), Cause: ${event.cause_txt || event.cause}`);
            if (this.tracker.getCall(channelId)) { // If it's a tracked main channel
                logger.info(`[ARI] HangupRequest for tracked main channel ${channelId}. Initiating cleanup.`);
                this.cleanupChannel(channelId, `HangupRequest (Main Channel)`).catch(err => {
                    logger.error(`[ARI] Error during cleanup from ChannelHangupRequest for ${channelId}: ${err.message}`);
                });
            }
        });

        this.client.on('ChannelTalkingStarted', (event, channel) => {
            const currentChannelName = channel.name || 'Unknown'; // Use channel.name
            logger.info(`[ARI VAD] >>> Talking STARTED on channel ${channel.id} (${currentChannelName})`);
        });

        this.client.on('ChannelTalkingFinished', (event, channel) => {
            const currentChannelName = channel.name || 'Unknown'; // Use channel.name
            logger.info(`[ARI VAD] <<< Talking FINISHED on channel ${channel.id} (${currentChannelName}). Duration: ${event.duration}ms`);
        });

        this.client.on('ChannelDtmfReceived', (event, channel) => {
            const digit = event.digit;
            const channelId = channel.id;
            // const currentChannelName = channel.name || 'Unknown'; // Use channel.name if needed for logging
            const callData = this.tracker.getCall(channelId) || Array.from(this.tracker.calls.values()).find(cd => cd.snoopChannelId === channelId);
            const primarySid = callData?.twilioSid || callData?.asteriskChannelId || channelId;
            logger.info(`[ARI] DTMF '${digit}' on ${channelId} (CallID: ${primarySid})`);
        });


        this.client.on('error', (err) => {
            logger.error(`[ARI] Client error: ${err.message}`, err);
            // Don't trigger disconnect here, as the WebSocket handlers will handle it
        });

        logger.info('[ARI] Event handlers set up successfully.');
    } // End setupEventHandlers

    async setupMediaPipeline(channel, twilioCallSid, patientId) {
        const asteriskChannelId = channel.id;
        logger.info(`[ARI Pipeline] Setting up for Asterisk ID: ${asteriskChannelId}, Twilio SID: ${twilioCallSid}, PatientID: ${patientId}`);
        this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_setup' });
        let mainBridge = null;
        let dbConversationId = null;

        try {
            // These checks should be redundant now if StasisStart logic is correct for main channel
            if (!patientId) {
                logger.error(`[ARI Pipeline] Critical: PatientID is missing for main channel ${asteriskChannelId} at start of setupMediaPipeline.`);
                throw new Error('PatientID is missing, cannot create conversation record for media pipeline.');
            }
            if (!twilioCallSid) {
                logger.error(`[ARI Pipeline] Critical: twilioCallSid is missing for main channel ${asteriskChannelId} at start of setupMediaPipeline.`);
                throw new Error('twilioCallSid is missing, cannot create conversation record for media pipeline.');
            }

            const conversationRecordKey = twilioCallSid;
            const conversationData = {
                callSid: conversationRecordKey,
                asteriskChannelId,
                startTime: new Date(),
                callType: 'asterisk-call',
                status: 'active',
                patientId: null // Initialize, will be set after fetching Patient doc
            };

            const patientDoc = await Patient.findById(patientId).select('_id name').lean().catch((err) => {
                logger.error(`[ARI Pipeline] Error finding patient with ID ${patientId}: ${err.message}`);
                return null;
            });

            if (patientDoc && patientDoc._id) {
                conversationData.patientId = patientDoc._id; // Assign the ObjectId
                 logger.info(`[ARI Pipeline] Found patient ${patientDoc._id} for patientId ${patientId}.`);
            } else {
                logger.error(`[ARI Pipeline] Patient with ID ${patientId} not found or error fetching. Conversation will not be linked to a patient.`);
                // If patientId is strictly required by your Conversation schema, this will cause an error on save.
                // Consider if you want to throw new Error here or allow saving without patientId.
            }
            
            // Only proceed with DB if patientId was successfully linked (if it's mandatory for your schema)
            // Or adjust Conversation schema if patientId can be optional.
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
                    logger.warn(`[ARI Pipeline] Failed to create/update conversation record for ${conversationRecordKey}. This might be due to patientId validation if it's required and was not found/linked.`);
                }
            } else {
                 logger.warn(`[ARI Pipeline] Skipping DB Conversation record for ${conversationRecordKey} due to missing or invalid patientId link.`);
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
            await openAIService.initialize(asteriskChannelId, twilioCallSid, dbConversationId, initialPrompt);
            openAIService.setNotificationCallback((cbAsteriskChannelId, type, data) => {
                if (cbAsteriskChannelId === asteriskChannelId && type === 'audio_chunk' && data?.audio) {
                    this.handleOpenAIAudio(asteriskChannelId, data.audio);
                }
            });
            logger.info(`[ARI Pipeline] OpenAI initialized and callback set for Asterisk ID: ${asteriskChannelId}.`);

            // Pass the main channel object to initiateSnoopForExternalMedia
            await this.initiateSnoopForExternalMedia(asteriskChannelId, channel);
            this.tracker.updateCall(asteriskChannelId, { state: 'pipeline_active_extmedia' });

        } catch (err) {
            logger.error(`[ARI Pipeline] Error in setupMediaPipeline for ${asteriskChannelId}: ${err.message}`, err);
            if (mainBridge && mainBridge.id) { // Check if bridge was created before trying to destroy
                 await mainBridge.destroy().catch(e => logger.warn(`[ARI Pipeline] Error destroying mainBridge in setupMediaPipeline catch: ${e.message}`));
            }
            throw err; // Re-throw to be caught by the StasisStart handler for full channel cleanup
        }
    }

    async initiateSnoopForExternalMedia(asteriskChannelId, mainChannelObject) { // mainChannelObject is the channel object for PJSIP/twilio-trunk-...
        logger.info(`[ExternalMedia Setup] Starting for main channel: ${asteriskChannelId}`);
        let snoopChannel = null;
        try {
            const snoopId = `snoop-extmedia-${uuidv4()}`;
            // Pass the main channel ID as an appArg so the snoop channel can identify its parent
            const appArgsForSnoop = [`snoop_parent_id=${asteriskChannelId}`];
            snoopChannel = await this.client.channels.snoopChannel({
                channelId: asteriskChannelId, // ID of the channel to snoop (the main PJSIP channel)
                snoopId: snoopId,             // User-defined ID for this snoop instance
                spy: 'in',                    // Snoop incoming audio to the channel (what the user/Twilio sends)
                app: 'myphonefriend',         // Stasis app to send the snoop channel to
                appArgs: appArgsForSnoop      // Pass parent ID
            });
            logger.info(`[ExternalMedia Setup] Created snoop channel ${snoopChannel.id} with appArgs: ${JSON.stringify(appArgsForSnoop)}. It will enter Stasis app 'myphonefriend'.`);
            // Store snoop channel details in the tracker associated with the main call
            this.tracker.updateCall(asteriskChannelId, {
                snoopChannel: snoopChannel,       // The snoop channel object itself
                snoopChannelId: snoopChannel.id,  // The ID of the snoop channel
                snoopMethod: 'externalMedia',
                state: 'external_media_snoop_created'
            });
            // The actual channel.externalMedia() call will happen in the StasisStart handler
            // for this newly created snoopChannel.
        } catch (err) {
            logger.error(`[ExternalMedia Setup] Failed to create snoop channel for ${asteriskChannelId}: ${err.message}`, err);
            if (snoopChannel && snoopChannel.id && !snoopChannel.destroyed) { // Check if snoopChannel was created
                await snoopChannel.hangup().catch(e => logger.warn(`[ExternalMedia Setup] Error hanging up snoop channel in catch: ${e.message}`));
            }
            this.tracker.updateCall(asteriskChannelId, { state: 'snoop_extmedia_failed', snoopChannel: null, snoopChannelId: null });
            throw err; // Re-throw to allow StasisStart handler to cleanup main channel
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
        const resources = this.tracker.getResources(asteriskChannelIdToClean);
        const primarySidForOpenAI = resources?.twilioSid || resources?.asteriskChannelId || asteriskChannelIdToClean;
        const ssrcToRemove = resources?.rtp_ssrc;

        const removedCallData = this.tracker.removeCall(asteriskChannelIdToClean);
        
        const actualResources = resources || removedCallData || {
            asteriskChannelId: asteriskChannelIdToClean,
            twilioSid: primarySidForOpenAI,
            mainChannel: null, snoopChannel: null, localChannel: null,
            mainBridge: null, snoopBridge: null, conversationId: null, rtp_ssrc: null,
            recordingName: null // Ensure recordingName is part of this structure
        };

        if (ssrcToRemove) {
            try {
                rtpListenerService.removeSsrcMapping(ssrcToRemove);
            } catch (e) {
                logger.warn(`[Cleanup] Error calling removeSsrcMapping for SSRC ${ssrcToRemove}: ${e.message}`);
            }
        }
        
        if (actualResources.mainBridge && actualResources.recordingName) {
            try {
                logger.info(`[Cleanup] Attempting to stop recording ${actualResources.recordingName} on bridge ${actualResources.mainBridge.id}`);
                await actualResources.mainBridge.stopRecord();
                logger.info(`[Cleanup] Successfully stopped recording ${actualResources.recordingName}`);
            } catch (e) {
                if (!e.message || !e.message.includes(' 404 ')) {
                    logger.warn(`[Cleanup] Error stopping recording on bridge ${actualResources.mainBridge.id || 'unknown'}: ${e.message}`);
                } else {
                    logger.info(`[Cleanup] Recording on bridge ${actualResources.mainBridge.id || 'unknown'} likely already stopped or bridge gone (404).`);
                }
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
        await safeDestroy(actualResources.snoopBridge, 'Snoop'); // snoopBridge is not explicitly created/tracked, usually not needed to destroy separately
        await safeHangup(actualResources.mainChannel, 'Main');
        await safeDestroy(actualResources.mainBridge, 'Main');
        await safeHangup(actualResources.localChannel, 'Local'); // If local channels are used

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

    // Add a shutdown method for graceful termination
    async shutdown() {
        logger.info('[ARI] Shutting down ARI client...');
        
        // Stop the keep-alive interval
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        
        // Clean up any active calls
        const activeCalls = [...this.tracker.calls.keys()];
        logger.info(`[ARI] Cleaning up ${activeCalls.length} active calls during shutdown...`);
        
        for (const callId of activeCalls) {
            try {
                await this.cleanupChannel(callId, 'System shutdown');
            } catch (err) {
                logger.error(`[ARI] Error cleaning up call ${callId} during shutdown: ${err.message}`);
            }
        }
        
        // Close the WebSocket connection
        if (this.client && this.client.ws) {
            try {
                logger.info('[ARI] Closing WebSocket connection...');
                // Try a clean close first
                this.client.ws.close(1000, 'Controlled shutdown');
                
                // Set a timeout to force terminate if clean close doesn't work
                setTimeout(() => {
                    if (this.client && this.client.ws) {
                        this.client.ws.terminate();
                        logger.info('[ARI] WebSocket forcefully terminated after timeout');
                    }
                }, 2000);
            } catch (err) {
                logger.error(`[ARI] Error closing WebSocket: ${err.message}`);
            }
        }
        
        this.isConnected = false;
        this.client = null;
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
