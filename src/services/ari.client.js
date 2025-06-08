const AriClient = require('ari-client');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const config = require('../config/config');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
const { Conversation, Patient } = require('../models');
const channelTracker = require('./channel.tracker');
const rtpListenerService = require('./rtp.listener.service');

// Configuration constants
const CONFIG = {
    MAX_RETRIES: config.asterisk?.maxRetries || 10,
    RETRY_DELAY: config.asterisk?.retryDelay || 3000,
    MAX_RETRY_DELAY: config.asterisk?.maxRetryDelay || 30000,
    KEEP_ALIVE_INTERVAL: config.asterisk?.keepAliveInterval || 20000,
    OPERATION_TIMEOUT: config.asterisk?.operationTimeout || 30000,
    CHANNEL_SETUP_TIMEOUT: config.asterisk?.channelSetupTimeout || 10000,
    STASIS_APP_NAME: config.asterisk?.stasisAppName || 'myphonefriend',
    RTP_SEND_FORMAT: config.asterisk?.rtpSendFormat || 'ulaw',
    AUDIO_FORMAT: config.asterisk?.audioFormat || 'ulaw',
    FILE_EXTENSION: config.asterisk?.fileExtension || 'ulaw'
};

// Valid state transitions
const VALID_STATE_TRANSITIONS = {
    'answered': ['pipeline_setup', 'cleanup'],
    'pipeline_setup': ['main_bridged', 'cleanup'],
    'main_bridged': ['external_media_channels_created', 'external_media_read_active', 'cleanup'], // Allow direct transition
    'external_media_channels_created': ['external_media_read_active', 'cleanup'],
    'external_media_read_active': ['external_media_write_pending', 'pipeline_active_extmedia', 'cleanup'],
    'external_media_write_pending': ['external_media_write_active', 'cleanup'],
    'external_media_write_active': ['pipeline_active_extmedia', 'cleanup'],
    'pipeline_active_extmedia': ['cleanup'],
    'cleanup': []
};

// Helper to strip protocol and ensure valid host
function sanitizeHost(raw) {
    try {
        const url = new URL(raw);
        return url.hostname;
    } catch {
        return raw;
    }
}

// Circuit breaker for connection management
class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.failureThreshold = threshold;
        this.timeout = timeout;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }

    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
}

// Timeout wrapper for async operations
function withTimeout(promise, timeoutMs, operationName = 'Operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

// State machine validator
class StateValidator {
    static validateTransition(currentState, newState) {
        const validTransitions = VALID_STATE_TRANSITIONS[currentState];
        if (!validTransitions || !validTransitions.includes(newState)) {
            throw new Error(`Invalid state transition from ${currentState} to ${newState}`);
        }
        return true;
    }
}

// Enhanced resource manager
class ResourceManager {
    constructor() {
        this.resources = new Map();
        this.abortControllers = new Map();
    }

    addResource(channelId, resource) {
        if (!this.resources.has(channelId)) {
            this.resources.set(channelId, new Set());
        }
        this.resources.get(channelId).add(resource);
    }

    removeResource(channelId, resource) {
        const resources = this.resources.get(channelId);
        if (resources) {
            resources.delete(resource);
            if (resources.size === 0) {
                this.resources.delete(channelId);
            }
        }
    }

    getAbortController(channelId) {
        if (!this.abortControllers.has(channelId)) {
            this.abortControllers.set(channelId, new AbortController());
        }
        return this.abortControllers.get(channelId);
    }

    abortOperations(channelId) {
        const controller = this.abortControllers.get(channelId);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(channelId);
        }
    }

    cleanupAll() {
        for (const controller of this.abortControllers.values()) {
            controller.abort();
        }
        this.abortControllers.clear();
        this.resources.clear();
    }
}

class AsteriskAriClient extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.isConnected = false;
        this.tracker = channelTracker;
        this.retryCount = 0;
        this.circuitBreaker = new CircuitBreaker();
        this.resourceManager = new ResourceManager();
        this.reconnectTimer = null;
        this.healthCheckInterval = null;

        // Configuration for ExternalMedia
        this.RTP_BIANCA_HOST = sanitizeHost(config.asterisk.rtpBiancaHost);
        this.RTP_ASTERISK_HOST = sanitizeHost(config.asterisk.rtpAsteriskHost);
        this.RTP_BIANCA_RECEIVE_PORT = config.asterisk.rtpBiancaReceivePort;
        this.RTP_BIANCA_SEND_PORT = config.asterisk.rtpBiancaSendPort || (config.asterisk.rtpBiancaReceivePort + 1);

        // Set global reference safely
        this.setGlobalReference();
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }

    setGlobalReference() {
        if (typeof global !== 'undefined') {
            global.ariClient = this;
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`[ARI] Received ${signal}, initiating graceful shutdown`);
            await this.shutdown();
            process.exit(0);
        };

        process.once('SIGINT', () => shutdown('SIGINT'));
        process.once('SIGTERM', () => shutdown('SIGTERM'));
    }

    async waitForReady() {
        logger.info('[ARI] Checking readiness...');
        
        if (!this.isConnected) {
            throw new Error('ARI client not connected');
        }
        
        if (!this.client) {
            throw new Error('ARI client object is null');
        }
        
        try {
            const apps = await withTimeout(
                this.client.applications.list(),
                5000,
                'Application list'
            );
            
            logger.info(`[ARI] Found ${apps.length} applications: ${apps.map(a => a.name).join(', ')}`);
            
            const myApp = apps.find(app => app.name === CONFIG.STASIS_APP_NAME);
            if (!myApp) {
                throw new Error(`Stasis application "${CONFIG.STASIS_APP_NAME}" not found in registered apps`);
            }
            
            logger.info(`[ARI] Stasis application "${CONFIG.STASIS_APP_NAME}" verified and ready`);
            return true;
        } catch (err) {
            logger.error('[ARI] Stasis application not ready:', err.message);
            throw err;
        }
    }

    async start() {
        return this.circuitBreaker.execute(async () => {
            try {
                logger.info('[ARI] Connecting to Asterisk ARI...');
                
                const { url: ariUrl, username, password } = config.asterisk;
                
                if (!ariUrl || !username || !password) {
                    throw new Error('ARI configuration incomplete - missing URL, username, or password');
                }

                this.client = await withTimeout(
                    AriClient.connect(ariUrl, username, password, {
                        keepAliveIntervalMs: CONFIG.KEEP_ALIVE_INTERVAL,
                        perMessageDeflate: false,
                        reconnect: { retries: Infinity, delay: 10000 }
                    }),
                    CONFIG.OPERATION_TIMEOUT,
                    'ARI Connection'
                );

                this.isConnected = true;
                this.retryCount = 0;
                
                logger.info('[ARI] Successfully connected to Asterisk ARI');

                this.setupWebSocketHandlers();
                this.setupEventHandlers();
                
                await this.client.start(CONFIG.STASIS_APP_NAME);
                logger.info(`[ARI] Subscribed to Stasis application: ${CONFIG.STASIS_APP_NAME}`);

                await this.performConnectionTest();
                this.startHealthCheck();
                
                this.emit('connected');

            } catch (err) {
                logger.error(`[ARI] Start error: ${err.message}`);
                this.isConnected = false;
                this.emit('error', err);
                throw err;
            }
        });
    }

    setupWebSocketHandlers() {
        this.client.on('WebSocketConnected', () => {
            logger.info('[ARI] WebSocket connected');
            this.emit('websocket_connected');
        });

        this.client.on('WebSocketReconnecting', (err) => {
            logger.warn('[ARI] WebSocket reconnecting:', err?.message || 'Unknown error');
            this.emit('websocket_reconnecting', err);
        });

        this.client.on('WebSocketMaxRetries', (err) => {
            logger.error('[ARI] WebSocket max retries exceeded:', err?.message || 'Unknown error');
            this.emit('websocket_max_retries', err);
        });

        this.client.on('WebSocketClosed', (code, reason) => {
            logger.warn(`[ARI] WebSocket closed ${code}: ${reason}`);
            this.isConnected = false;
            this.emit('websocket_closed', { code, reason });
            
            // Only reconnect on abnormal closures and if not shutting down
            if (code !== 1000 && !this.isShuttingDown) {
                this.scheduleReconnect();
            }
        });
    }

    async performConnectionTest() {
        try {
            const endpoints = await withTimeout(
                this.client.endpoints.list(),
                5000,
                'Endpoint list test'
            );
            logger.info(`[ARI] Connection test successful: ${endpoints.length} endpoints`);
        } catch (err) {
            logger.warn(`[ARI] Connection test failed: ${err.message}`);
            throw err;
        }
    }

    startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            if (!this.isConnected) return;

            try {
                await withTimeout(
                    this.client.applications.list(),
                    5000,
                    'Health check'
                );
            } catch (err) {
                logger.error('[ARI] Health check failed:', err.message);
                this.handleDisconnection('Health check failure');
            }
        }, 30000); // Check every 30 seconds
    }

    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        if (this.retryCount >= CONFIG.MAX_RETRIES) {
            logger.error(`[ARI] Max reconnection attempts (${CONFIG.MAX_RETRIES}) exceeded`);
            this.emit('max_retries_exceeded');
            return;
        }

        this.retryCount++;
        const delay = Math.min(
            CONFIG.RETRY_DELAY * Math.pow(1.5, this.retryCount - 1) + Math.random() * 1000,
            CONFIG.MAX_RETRY_DELAY
        );

        logger.info(`[ARI] Scheduling reconnection in ${delay.toFixed(0)}ms (attempt ${this.retryCount}/${CONFIG.MAX_RETRIES})`);
        
        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.start();
            } catch (err) {
                logger.error(`[ARI] Reconnection attempt ${this.retryCount} failed:`, err.message);
                this.scheduleReconnect();
            }
        }, delay);
    }

    handleDisconnection(reason) {
        if (!this.isConnected || this.isShuttingDown) {
            return;
        }

        logger.warn(`[ARI] Handling disconnection: ${reason}`);
        this.isConnected = false;
        this.emit('disconnected', reason);

        this.cleanup();
        this.scheduleReconnect();
    }

    cleanup() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.resourceManager.cleanupAll();
    }

    setupEventHandlers() {
        if (!this.client) {
            throw new Error("Client not initialized. Cannot set up event handlers.");
        }

        logger.info('[ARI] Setting up event handlers...');

        this.client.on('StasisStart', this.handleStasisStart.bind(this));
        this.client.on('StasisEnd', this.handleStasisEnd.bind(this));
        this.client.on('ChannelDestroyed', this.handleChannelDestroyed.bind(this));
        this.client.on('ChannelHangupRequest', this.handleChannelHangupRequest.bind(this));
        this.client.on('ChannelTalkingStarted', this.handleChannelTalkingStarted.bind(this));
        this.client.on('ChannelTalkingFinished', this.handleChannelTalkingFinished.bind(this));
        this.client.on('ChannelRtpStarted', this.handleChannelRtpStarted.bind(this));
        this.client.on('ChannelDtmfReceived', this.handleChannelDtmfReceived.bind(this));
        this.client.on('error', this.handleClientError.bind(this));

        logger.info('[ARI] Event handlers set up successfully');
    }

    async handleStasisStart(event, channel) {
        const channelId = channel.id;
        const channelName = channel.name || 'Unknown';
        
        logger.info(`[ARI] StasisStart event for ${channelId} (${channelName})`);

        try {
            if (channelName.startsWith('Snoop/')) {
                await this.handleStasisStartForSnoop(channel, channelName);
            } else if (channelName.startsWith('Local/playback-')) {
                await this.handleStasisStartForPlayback(channel, channelName, event);
            } else if (channelName.startsWith('PJSIP/twilio-trunk-')) {
                await this.handleStasisStartForMainChannel(channel, event);
            } else if (channelName.startsWith('UnicastRTP/')) {
                await this.handleStasisStartForUnicastRTP(channel);
            } else if (channelName.startsWith('Local/')) {
                logger.warn(`[ARI] Unexpected Local channel ${channelId}. Hanging up.`);
                await this.safeHangup(channel, 'Unexpected Local channel');
            } else {
                logger.warn(`[ARI] Unhandled channel type: ${channelId} (${channelName}). Hanging up.`);
                await this.safeHangup(channel, 'Unhandled channel type');
            }
        } catch (err) {
            logger.error(`[ARI] Error in StasisStart handler for ${channelId}: ${err.message}`, err);
            await this.safeHangup(channel, `StasisStart error: ${err.message}`);
        }
    }

    async handleStasisStartForMainChannel(channel, event) {
        const channelId = channel.id;
        
        try {
            await channel.answer();
            
            this.tracker.addCall(channelId, {
                channel: channel,
                mainChannel: channel,
                twilioCallSid: null,
                patientId: null,
                state: 'answered'
            });
            
            logger.info(`[ARI] Answered main channel: ${channelId}`);

            const { twilioCallSid, patientId } = await this.extractCallParameters(channel, event);
            
            if (!twilioCallSid || !patientId) {
                throw new Error('Missing twilioCallSid or patientId');
            }

            this.tracker.updateCall(channelId, { twilioCallSid, patientId });
            await this.setupMediaPipeline(channel, twilioCallSid, patientId);
            
        } catch (err) {
            logger.error(`[ARI] Error in main channel setup for ${channelId}: ${err.message}`, err);
            await this.cleanupChannel(channelId, `Main channel setup error: ${err.message}`);
        }
    }

    async extractCallParameters(channel, event) {
        let rawUri = event.args[0] || '';
        
        if (!rawUri) {
            try {
                const result = await channel.getChannelVar({ variable: 'RAW_SIP_URI_FOR_ARI' });
                rawUri = result.value;
            } catch (err) {
                logger.warn(`[ARI] Could not get RAW_SIP_URI_FOR_ARI: ${err.message}`);
            }
        }

        if (!rawUri) {
            throw new Error('No SIP URI provided in StasisStart');
        }

        // Parse parameters
        rawUri = rawUri.replace(/^<|>$/g, '');
        const parts = rawUri.split(';');
        const paramMap = {};
        
        parts.slice(1).forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) {
                paramMap[key] = decodeURIComponent(value);
            }
        });

        return {
            twilioCallSid: paramMap.callSid,
            patientId: paramMap.patientId
        };
    }

    async handleStasisStartForUnicastRTP(channel) {
        logger.info('[ARI] Processing UnicastRTP channel:', channel.id);

        const parentCallData = this.findParentCallForRtpChannel(channel);
        if (!parentCallData) {
            logger.warn(`[ARI] No parent call found for RTP channel ${channel.id}`);
            return;
        }

        const { parentId, callData } = parentCallData;

        if (callData.state === 'external_media_read_active' && !callData.inboundRtpChannel) {
            await this.handleInboundRtpChannel(channel, parentId, callData);
        } else if (['external_media_write_pending', 'external_media_write_active'].includes(callData.state)) {
            await this.handleOutboundRtpChannel(channel, parentId, callData);
        }
    }

    findParentCallForRtpChannel(channel) {
        const [base] = channel.id.split('.');
        let parentId = Array.from(this.tracker.calls.keys())
            .find(id => id.startsWith(`${base}.`));
        
        if (parentId) {
            return { parentId, callData: this.tracker.getCall(parentId) };
        }

        // Fallback: look for calls expecting RTP channels
        for (const [callId, data] of this.tracker.calls.entries()) {
            if (data.state === 'external_media_channels_created' || 
                data.state === 'external_media_read_active' ||
                data.state === 'external_media_write_pending' ||
                data.expectingRtpChannel) {
                return { parentId: callId, callData: data };
            }
        }

        return null;
    }

    async handleInboundRtpChannel(channel, parentId, callData) {
        logger.info(`[ARI] Processing READ UnicastRTP channel ${channel.id}`);
        
        try {
            await channel.answer();
            this.tracker.updateCall(parentId, { 
                inboundRtpChannel: channel,
                inboundRtpChannelId: channel.id
            });
            logger.info(`[ARI] Answered READ RTP channel ${channel.id}`);
        } catch (err) {
            logger.error(`[ARI] Failed to answer READ UnicastRTP channel ${channel.id}: ${err.message}`);
            throw err;
        }
    }

    async handleOutboundRtpChannel(channel, parentId, callData) {
        if (!callData.mainBridgeId) {
            throw new Error(`No bridge found for parent ${parentId}`);
        }
        
        logger.info(`[ARI] Processing WRITE UnicastRTP channel ${channel.id}`);
        
        await this.client.bridges.addChannel({
            bridgeId: callData.mainBridgeId,
            channel: channel.id
        });
        
        this.tracker.updateCall(parentId, { 
            outboundRtpChannel: channel,
            outboundRtpChannelId: channel.id
        });
        
        logger.info(`[ARI] Bridged WRITE RTP channel ${channel.id}`);
    }

    async handleStasisEnd(event, channel) {
        const channelId = channel.id;
        const channelName = channel.name || 'Unknown';
        
        logger.info(`[ARI] StasisEnd for channel ${channelId} (${channelName})`);

        if (this.tracker.getCall(channelId)) {
            logger.info(`[ARI] StasisEnd for tracked main channel ${channelId}`);
            await this.cleanupChannel(channelId, "StasisEnd (Main Channel)");
        } else {
            const parentCallId = this.findParentCallForAuxiliaryChannel(channelId);
            if (parentCallId) {
                logger.info(`[ARI] StasisEnd for auxiliary channel ${channelId} (parent: ${parentCallId})`);
                this.updateParentCallForAuxiliaryChannelEnd(parentCallId, channelId);
            } else if (!channelName.startsWith('UnicastRTP/')) {
                logger.warn(`[ARI] StasisEnd for untracked channel ${channelId} (${channelName})`);
            }
        }
    }

    findParentCallForAuxiliaryChannel(channelId) {
        for (const [mainCallId, callData] of this.tracker.calls.entries()) {
            if (callData.snoopChannelId === channelId ||
                callData.playbackChannelId === channelId ||
                callData.inboundRtpChannelId === channelId ||
                callData.outboundRtpChannelId === channelId) {
                return mainCallId;
            }
        }
        return null;
    }

    updateParentCallForAuxiliaryChannelEnd(parentCallId, channelId) {
        const callData = this.tracker.getCall(parentCallId);
        if (!callData) return;

        const updates = {};
        if (callData.snoopChannelId === channelId) {
            updates.snoopChannel = null;
            updates.snoopChannelId = null;
        }
        if (callData.playbackChannelId === channelId) {
            updates.playbackChannel = null;
            updates.playbackChannelId = null;
        }
        if (callData.inboundRtpChannelId === channelId) {
            updates.inboundRtpChannel = null;
            updates.inboundRtpChannelId = null;
        }
        if (callData.outboundRtpChannelId === channelId) {
            updates.outboundRtpChannel = null;
            updates.outboundRtpChannelId = null;
        }

        if (Object.keys(updates).length > 0) {
            this.tracker.updateCall(parentCallId, updates);
        }
    }

    async handleChannelDestroyed(event, channel) {
        const channelId = channel.id;
        const channelName = channel.name || 'Unknown';
        
        logger.info(`[ARI] ChannelDestroyed event for: ${channelId} (${channelName})`);
        
        if (this.tracker.getCall(channelId)) {
            await this.cleanupChannel(channelId, "ChannelDestroyed (Main Channel)");
        } else {
            this.updateParentCallForAuxiliaryChannelEnd(
                this.findParentCallForAuxiliaryChannel(channelId),
                channelId
            );
        }
    }

    async handleChannelHangupRequest(event, channel) {
        const channelId = channel.id;
        const channelName = channel.name || 'Unknown';
        const cause = event.cause_txt || event.cause;
        
        logger.info(`[ARI] ChannelHangupRequest for: ${channelId} (${channelName}), Cause: ${cause}`);
        
        if (this.tracker.getCall(channelId)) {
            await this.cleanupChannel(channelId, `HangupRequest: ${cause}`);
        }
    }

    handleChannelTalkingStarted(event, channel) {
        const channelName = channel.name || 'Unknown';
        logger.info(`[ARI VAD] >>> Talking STARTED on channel ${channel.id} (${channelName})`);
    }

    handleChannelTalkingFinished(event, channel) {
        const channelName = channel.name || 'Unknown';
        logger.info(`[ARI VAD] <<< Talking FINISHED on channel ${channel.id} (${channelName}). Duration: ${event.duration}ms`);
    }

    async handleChannelRtpStarted(event, channel) {
        if (!channel.name.startsWith('UnicastRTP/')) return;

        logger.info('[ARI] ChannelRtpStarted for', channel.id, 'with SSRC', event.ssrc);

        const parentCallData = this.findParentCallForRtpChannel(channel);
        if (!parentCallData) {
            logger.warn(`[ARI] No parent call found for RTP channel ${channel.id}`);
            return;
        }

        const { parentId, callData } = parentCallData;
        const twilioSid = callData.twilioCallSid || parentId;

        try {
            rtpListenerService.addSsrcMapping(event.ssrc, twilioSid);
            this.tracker.updateCall(parentId, { 
                rtp_ssrc: event.ssrc,
                awaitingSsrcForRtp: false
            });
            
            logger.info(`[ARI] Mapped SSRC ${event.ssrc} → ${twilioSid}`);
        } catch (err) {
            logger.error(`[ARI] Error mapping SSRC: ${err.message}`);
        }
    }

    handleChannelDtmfReceived(event, channel) {
        const digit = event.digit;
        const channelId = channel.id;
        const callData = this.tracker.getCall(channelId) || 
            Array.from(this.tracker.calls.values()).find(cd => cd.snoopChannelId === channelId);
        const primarySid = callData?.twilioCallSid || callData?.asteriskChannelId || channelId;
        
        logger.info(`[ARI] DTMF '${digit}' on ${channelId} (CallID: ${primarySid})`);
    }

    handleClientError(err) {
        logger.error(`[ARI] Client error: ${err.message}`, err);
        this.emit('client_error', err);
    }

    async setupMediaPipeline(channel, twilioCallSid, patientId) {
        const asteriskChannelId = channel.id;
        logger.info(`[ARI Pipeline] Setting up for Asterisk ID: ${asteriskChannelId}, Twilio SID: ${twilioCallSid}, PatientID: ${patientId}`);
        
        this.updateCallState(asteriskChannelId, 'pipeline_setup');
        
        let mainBridge = null;
        let dbConversationId = null;

        try {
            await require('./rtp.listener.service').ensureReady();

            // Create conversation record
            dbConversationId = await this.createConversationRecord(twilioCallSid, asteriskChannelId, patientId);

            // Initialize OpenAI service
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

            // Create and setup bridge
            mainBridge = await this.client.bridges.create({ 
                type: 'mixing', 
                name: `call-${asteriskChannelId}` 
            });
            
            this.tracker.updateCall(asteriskChannelId, { 
                mainBridge, 
                mainBridgeId: mainBridge.id,
                conversationId: dbConversationId
            });
            
            logger.info(`[ARI Pipeline] Created main bridge ${mainBridge.id}`);

            await this.client.bridges.addChannel({
                bridgeId: mainBridge.id,
                channel: asteriskChannelId
            });
            
            this.updateCallState(asteriskChannelId, 'main_bridged');
            logger.info(`[ARI Pipeline] Added main channel to bridge`);

            // Start recording
            await this.startRecording(mainBridge, asteriskChannelId);

            // Setup OpenAI callback
            this.setupOpenAICallback();

            // Initialize external media pipeline
            await this.initiateSnoopForExternalMedia(asteriskChannelId, channel);
            this.updateCallState(asteriskChannelId, 'pipeline_active_extmedia');

            logger.info(`[ARI Pipeline] Media pipeline setup complete for ${asteriskChannelId}`);

        } catch (err) {
            logger.error(`[ARI Pipeline] Error in setupMediaPipeline for ${asteriskChannelId}: ${err.message}`, err);
            
            if (mainBridge?.id) {
                await this.safeDestroy(mainBridge, 'Main bridge cleanup after error');
            }
            
            throw err;
        }
    }

    async createConversationRecord(twilioCallSid, asteriskChannelId, patientId) {
        if (!patientId || !twilioCallSid) {
            throw new Error('PatientID and twilioCallSid are required for conversation record');
        }

        const conversationData = {
            callSid: twilioCallSid,
            asteriskChannelId,
            startTime: new Date(),
            callType: 'asterisk-call',
            status: 'active',
            patientId: null
        };

        try {
            const patientDoc = await Patient.findById(patientId).select('_id name').lean();
            
            if (patientDoc?._id) {
                conversationData.patientId = patientDoc._id;
                logger.info(`[ARI Pipeline] Found patient ${patientDoc._id} for patientId ${patientId}`);
            } else {
                throw new Error(`Patient with ID ${patientId} not found`);
            }

            const conversation = await Conversation.findOneAndUpdate(
                { callSid: twilioCallSid },
                { $set: conversationData, $setOnInsert: { createdAt: new Date() } },
                { new: true, upsert: true, runValidators: true }
            );

            if (conversation?._id) {
                logger.info(`[ARI Pipeline] Conversation record ${conversation._id} created/updated`);
                return conversation._id.toString();
            } else {
                throw new Error('Failed to create/update conversation record');
            }
        } catch (err) {
            logger.error(`[ARI Pipeline] Error creating conversation record: ${err.message}`);
            throw err;
        }
    }

    async startRecording(bridge, asteriskChannelId) {
        const recordingName = `recording-${asteriskChannelId.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        try {
            await bridge.record({ 
                name: recordingName, 
                format: 'wav', 
                maxDurationSeconds: 3600, 
                beep: false, 
                ifExists: 'overwrite' 
            });
            
            this.tracker.updateCall(asteriskChannelId, { recordingName });
            logger.info(`[ARI Pipeline] Started recording ${recordingName}`);
        } catch (err) {
            logger.error(`[ARI Pipeline] Recording failed: ${err.message}`);
            // Don't throw - recording failure shouldn't stop the call
        }
    }

    setupOpenAICallback() {
        openAIService.setNotificationCallback((callbackId, type, data) => {
            try {
                switch (type) {
                    case 'audio_chunk':
                        this.handleOpenAIAudio(callbackId, data);
                        break;
                    case 'openai_session_expired':
                        this.handleOpenAISessionExpired(callbackId);
                        break;
                    case 'openai_max_reconnect_failed':
                        this.handleOpenAIMaxReconnectFailed(callbackId);
                        break;
                    default:
                        logger.warn(`[ARI] Unknown OpenAI callback type: ${type}`);
                }
            } catch (err) {
                logger.error(`[ARI] Error in OpenAI callback: ${err.message}`, err);
            }
        });
    }

    handleOpenAIAudio(callbackId, data) {
        if (!data?.audio) {
            logger.warn(`[ARI] Received empty audio for ${callbackId}`);
            return;
        }

        let targetChannelId = callbackId;
        let callData = this.tracker.getCall(callbackId);
        
        if (!callData) {
            const foundCall = this.tracker.findCallByTwilioCallSid(callbackId);
            if (foundCall) {
                targetChannelId = foundCall.asteriskChannelId;
                callData = foundCall;
            }
        }
        
        if (targetChannelId && callData) {
            this.sendAudioToChannel(targetChannelId, data.audio);
        } else {
            logger.warn(`[ARI] Received audio for unknown call ID: ${callbackId}`);
        }
    }

    handleOpenAISessionExpired(callbackId) {
        const callData = this.findCallData(callbackId);
        if (callData) {
            logger.warn(`[ARI] OpenAI session expired for ${callData.asteriskChannelId}`);
            // Could implement session renewal here
        }
    }

    handleOpenAIMaxReconnectFailed(callbackId) {
        const callData = this.findCallData(callbackId);
        if (callData) {
            logger.error(`[ARI] OpenAI max reconnection attempts failed for ${callData.asteriskChannelId}`);
            this.cleanupChannel(callData.asteriskChannelId, "OpenAI connection failed");
        }
    }

    findCallData(callbackId) {
        let callData = this.tracker.getCall(callbackId);
        if (!callData) {
            callData = this.tracker.findCallByTwilioCallSid(callbackId);
        }
        return callData;
    }

    async initiateSnoopForExternalMedia(asteriskChannelId, mainChannelObject) {
        logger.info(`[ExternalMedia Setup] Starting for main channel: ${asteriskChannelId}`);
        
        const abortController = this.resourceManager.getAbortController(asteriskChannelId);
        
        try {
            const rtpSessionId = `rtp-${uuidv4()}`;
            const snoopId = `snoop-extmedia-${uuidv4()}`;
            const playbackId = `playback-extmedia-${uuidv4()}`;
            
            this.tracker.updateCall(asteriskChannelId, {
                rtpSessionId,
                expectingRtpChannel: true,
                pendingSnoopId: snoopId,
                pendingPlaybackId: playbackId
            });
            
            // Create snoop channel with timeout
            const snoopChannel = await withTimeout(
                this.client.channels.snoopChannel({
                    channelId: asteriskChannelId,
                    snoopId: snoopId,
                    spy: 'in',
                    app: CONFIG.STASIS_APP_NAME
                }),
                CONFIG.CHANNEL_SETUP_TIMEOUT,
                'Snoop channel creation'
            );
            
            logger.info(`[ExternalMedia Setup] Created snoop channel ${snoopChannel.id}`);
            
            // Setup playback channel with proper cleanup
            const playbackChannel = await this.createPlaybackChannelWithCleanup(
                asteriskChannelId, 
                abortController.signal
            );
            
            this.tracker.updateCall(asteriskChannelId, {
                snoopChannel,
                snoopChannelId: snoopChannel.id,
                playbackChannel,
                playbackChannelId: playbackChannel.id,
                snoopMethod: 'externalMedia',
                state: 'external_media_channels_created',
                pendingSnoopId: null,
                pendingPlaybackId: null
            });
            
            logger.info(`[ExternalMedia Setup] Channels created successfully`);
            
        } catch (err) {
            logger.error(`[ExternalMedia Setup] Failed for ${asteriskChannelId}: ${err.message}`, err);
            
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

    async createPlaybackChannelWithCleanup(asteriskChannelId, abortSignal) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for playback channel'));
            }, CONFIG.CHANNEL_SETUP_TIMEOUT);
            
            let eventListener = null;
            
            const cleanup = () => {
                clearTimeout(timeout);
                if (eventListener && this.client) {
                    this.client.removeListener('StasisStart', eventListener);
                }
            };
            
            // Handle abort signal
            if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                    cleanup();
                    reject(new Error('Operation aborted'));
                });
            }
            
            eventListener = (event, channel) => {
                if (channel.name && 
                    channel.name.includes(`playback-${asteriskChannelId}`) && 
                    channel.name.includes('@playback-context') &&
                    channel.name.includes(';2')) {
                    
                    logger.info(`[ExternalMedia Setup] Found playback leg 2: ${channel.id}`);
                    cleanup();
                    resolve(channel);
                }
            };
            
            this.client.on('StasisStart', eventListener);
            
            // Create the playback channel
            this.client.channels.originate({
                endpoint: `Local/playback-${asteriskChannelId}@playback-context`,
                app: CONFIG.STASIS_APP_NAME,
                appArgs: `playback-for-${asteriskChannelId}`,
                callerId: 'OpenAI <openai>'
            }).catch(err => {
                cleanup();
                reject(err);
            });
        });
    }

    async handleStasisStartForSnoop(channel, channelName) {
        const channelId = channel.id;
        logger.info(`[ARI] StasisStart for Snoop channel: ${channelId}`);

        const match = channelName.match(/^Snoop\/([^-]+)-/);
        const parentChannelId = match?.[1];
        
        if (!parentChannelId) {
            logger.error(`[ARI] Cannot extract parent ID from snoop channel name: ${channelName}`);
            await this.safeHangup(channel, 'Invalid snoop channel name');
            return;
        }

        const parentCallData = this.tracker.getCall(parentChannelId);
        if (!parentCallData) {
            logger.error(`[ARI] Parent call ${parentChannelId} not found for snoop ${channelId}`);
            await this.safeHangup(channel, 'Orphaned snoop channel');
            return;
        }
        
        try {
            this.tracker.updateCall(parentChannelId, { 
                snoopChannel: channel, 
                snoopChannelId: channelId,
                pendingSnoopId: null
            });

            await channel.answer();
            logger.info(`[ARI] Answered snoop channel ${channelId}`);
            
            const rtpReadDest = `${this.RTP_BIANCA_HOST}:${this.RTP_BIANCA_RECEIVE_PORT}`;
            
            this.updateCallState(parentChannelId, 'external_media_read_active');
            this.tracker.updateCall(parentChannelId, { 
                snoopToRtpMapping: parentCallData.rtpSessionId,
                awaitingSsrcForRtp: true 
            });

            await channel.externalMedia({
                app: CONFIG.STASIS_APP_NAME,
                external_host: rtpReadDest,
                format: CONFIG.RTP_SEND_FORMAT,
                direction: 'read'
            });
            
            logger.info(`[ARI] READ ExternalMedia started: snoop ${channelId} → ${rtpReadDest}`);
            
        } catch (err) {
            logger.error(`[ARI] Failed to start READ ExternalMedia on snoop ${channelId}: ${err.message}`, err);
            await this.cleanupChannel(parentChannelId, `READ ExternalMedia setup failed: ${err.message}`);
        }
    }

    async handleStasisStartForPlayback(channel, channelName, event) {
        const channelId = channel.id;
        logger.info(`[ARI] StasisStart for Playback channel: ${channelId} (${channelName})`);

        const match = channelName.match(/^Local\/playback-([^@]+)@/);
        const parentChannelId = match?.[1];
        const isLeg2 = channelName.includes(';2');
        
        if (!parentChannelId) {
            logger.error(`[ARI] Cannot extract parent ID from playback channel name: ${channelName}`);
            await this.safeHangup(channel, 'Invalid playback channel name');
            return;
        }

        if (!isLeg2) {
            logger.info(`[ARI] Ignoring playback leg 1: ${channelId}`);
            return;
        }

        const parentCallData = this.tracker.getCall(parentChannelId);
        if (!parentCallData) {
            logger.error(`[ARI] Parent call ${parentChannelId} not found for playback ${channelId}`);
            await this.safeHangup(channel, 'Orphaned playback channel');
            return;
        }
        
        try {
            this.tracker.updateCall(parentChannelId, { 
                playbackChannel: channel, 
                playbackChannelId: channelId,
                pendingPlaybackId: null
            });

            await channel.answer();
            logger.info(`[ARI] Answered playback channel ${channelId}`);
            
            // Small delay for stability
            await this.delay(100);
            
            await this.client.bridges.addChannel({
                bridgeId: parentCallData.mainBridgeId,
                channel: channelId
            });
            
            logger.info(`[ARI] Added playback channel to bridge`);
            
            // Another small delay
            await this.delay(100);

            this.updateCallState(parentChannelId, 'external_media_write_pending');

            const rtpAsteriskSource = `${this.RTP_BIANCA_HOST}:${this.RTP_BIANCA_SEND_PORT}`;
            
            const unicastRtpChannel = await channel.externalMedia({
                app: CONFIG.STASIS_APP_NAME,
                external_host: rtpAsteriskSource,
                format: CONFIG.RTP_SEND_FORMAT,
                direction: 'write'
            });
            
            logger.info(`[ARI] WRITE ExternalMedia created: ${unicastRtpChannel.id}`);
            
            await this.client.bridges.addChannel({
                bridgeId: parentCallData.mainBridgeId,
                channel: unicastRtpChannel.id
            });
            
            // Get RTP endpoint information
            const asteriskRtpEndpoint = await this.getRtpEndpoint(unicastRtpChannel);
            
            this.updateCallState(parentChannelId, 'external_media_write_active');
            this.tracker.updateCall(parentChannelId, { 
                asteriskRtpEndpoint,
                unicastRtpChannel,
                unicastRtpChannelId: unicastRtpChannel.id
            });
            
            logger.info(`[ARI] WRITE ExternalMedia active: ${rtpAsteriskSource} → ${asteriskRtpEndpoint.host}:${asteriskRtpEndpoint.port}`);
            
            await this.initializeRtpSenderWithEndpoint(parentChannelId, asteriskRtpEndpoint);
            
        } catch (err) {
            logger.error(`[ARI] Failed to start WRITE ExternalMedia on playback ${channelId}: ${err.message}`, err);
            
            await this.safeHangup(channel, 'WRITE ExternalMedia setup failed');
            
            this.tracker.updateCall(parentChannelId, { 
                playbackChannel: null, 
                playbackChannelId: null,
                state: 'external_media_read_only'
            });
            
            logger.warn(`[ARI] Continuing call ${parentChannelId} in READ-only mode`);
        }
    }

    async getRtpEndpoint(unicastRtpChannel) {
        try {
            const [addressVar, portVar] = await Promise.all([
                unicastRtpChannel.getChannelVar({ variable: 'UNICASTRTP_LOCAL_ADDRESS' }),
                unicastRtpChannel.getChannelVar({ variable: 'UNICASTRTP_LOCAL_PORT' })
            ]);
            
            if (!addressVar?.value || !portVar?.value) {
                throw new Error('UNICASTRTP_LOCAL_ADDRESS or UNICASTRTP_LOCAL_PORT variables not set');
            }
            
            const endpoint = {
                host: addressVar.value,
                port: parseInt(portVar.value)
            };
            
            logger.info(`[ARI] Got Asterisk RTP endpoint: ${endpoint.host}:${endpoint.port}`);
            return endpoint;
            
        } catch (err) {
            logger.error(`[ARI] Failed to get RTP endpoint: ${err.message}`);
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
        logger.info(`[RTP Sender] Initializing for ${twilioSid} to ${rtpEndpoint.host}:${rtpEndpoint.port}`);
        
        try {
            const rtpSenderService = require('./rtp.sender.service');
            await rtpSenderService.initializeCall(twilioSid, {
                asteriskChannelId,
                rtpHost: rtpEndpoint.host,
                rtpPort: rtpEndpoint.port,
                format: CONFIG.RTP_SEND_FORMAT
            });
            
            logger.info(`[RTP Sender] Successfully initialized for ${twilioSid}`);
        } catch (err) {
            logger.error(`[RTP Sender] Failed to initialize: ${err.message}`, err);
            throw err;
        }
    }

    sendAudioToChannel(asteriskChannelId, audioBase64Ulaw) {
        if (!audioBase64Ulaw) {
            logger.warn(`[ARI Audio] Empty audio for ${asteriskChannelId}`);
            return;
        }
        
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) {
            logger.warn(`[ARI Audio] No call data found for ${asteriskChannelId}`);
            return;
        }

        const twilioSid = callData.twilioCallSid || asteriskChannelId;
        
        try {
            const rtpSenderService = require('./rtp.sender.service');
            rtpSenderService.sendAudio(twilioSid, audioBase64Ulaw);
        } catch (err) {
            logger.error(`[ARI Audio] Error sending audio: ${err.message}`, err);
        }
    }

    async cleanupChannel(asteriskChannelId, reason = "Unknown") {
        logger.info(`[Cleanup] Starting cleanup for ${asteriskChannelId}. Reason: ${reason}`);
        
        // Abort any ongoing operations
        this.resourceManager.abortOperations(asteriskChannelId);
        
        const resources = this.tracker.getResources(asteriskChannelId);
        if (!resources) {
            logger.warn(`[Cleanup] No resources found for ${asteriskChannelId}`);
            return;
        }
        
        const primarySid = resources.twilioCallSid || resources.asteriskChannelId || asteriskChannelId;
        
        // Remove from tracker early to prevent new operations
        this.tracker.removeCall(asteriskChannelId);
        
        try {
            // Clean up external services
            await this.cleanupExternalServices(primarySid, resources);
            
            // Stop recordings
            await this.stopRecording(resources);
            
            // Clean up channels in proper order
            await this.cleanupChannels(resources);
            
            // Clean up bridges
            await this.cleanupBridges(resources);
            
            // Update database
            await this.updateConversationRecord(resources.conversationId, reason);
            
            logger.info(`[Cleanup] Completed cleanup for ${asteriskChannelId}`);
            
        } catch (err) {
            logger.error(`[Cleanup] Error during cleanup for ${asteriskChannelId}: ${err.message}`, err);
        }
    }

    async cleanupExternalServices(primarySid, resources) {
        // Clean up RTP sender
        try {
            const rtpSenderService = require('./rtp.sender.service');
            rtpSenderService.cleanupCall(primarySid);
        } catch (err) {
            logger.warn(`[Cleanup] Error cleaning up RTP sender: ${err.message}`);
        }
        
        // Remove SSRC mapping
        if (resources.rtp_ssrc) {
            try {
                rtpListenerService.removeSsrcMapping(resources.rtp_ssrc);
                logger.info(`[Cleanup] Removed SSRC mapping for ${resources.rtp_ssrc}`);
            } catch (err) {
                logger.warn(`[Cleanup] Error removing SSRC mapping: ${err.message}`);
            }
        }
        
        // Disconnect OpenAI
        try {
            await openAIService.disconnect(primarySid);
            logger.info(`[Cleanup] Disconnected OpenAI service`);
        } catch (err) {
            logger.warn(`[Cleanup] Error disconnecting OpenAI: ${err.message}`);
        }
    }

    async stopRecording(resources) {
        if (resources.recordingName) {
            try {
                await this.client.recordings.stop({ recordingName: resources.recordingName });
                logger.info(`[Cleanup] Stopped recording ${resources.recordingName}`);
            } catch (err) {
                if (!err.message?.includes('404')) {
                    logger.warn(`[Cleanup] Error stopping recording: ${err.message}`);
                }
            }
        }
    }

    async cleanupChannels(resources) {
        const channelsToCleanup = [
            { channel: resources.snoopChannel, type: 'Snoop' },
            { channel: resources.playbackChannel, type: 'Playback' },
            { channel: resources.localChannel, type: 'Local' },
            { channel: resources.inboundRtpChannel, type: 'InboundRTP' },
            { channel: resources.outboundRtpChannel, type: 'OutboundRTP' },
            { channel: resources.unicastRtpChannel, type: 'UnicastRTP' },
            { channel: resources.mainChannel, type: 'Main' }
        ];

        for (const { channel, type } of channelsToCleanup) {
            if (channel) {
                await this.safeHangup(channel, type);
            }
        }
    }

    async cleanupBridges(resources) {
        const bridgesToCleanup = [
            { bridge: resources.snoopBridge, type: 'Snoop' },
            { bridge: resources.mainBridge, type: 'Main' }
        ];

        for (const { bridge, type } of bridgesToCleanup) {
            if (bridge) {
                await this.safeDestroy(bridge, type);
            }
        }
    }

    async updateConversationRecord(conversationId, reason) {
        if (conversationId) {
            try {
                await Conversation.findByIdAndUpdate(conversationId, {
                    status: 'completed',
                    endTime: new Date(),
                    cleanupReason: reason
                });
                logger.info(`[Cleanup] Updated conversation record`);
            } catch (err) {
                logger.error(`[Cleanup] Error updating conversation: ${err.message}`);
            }
        }
    }

    async safeHangup(channel, type) {
        if (!channel || typeof channel.hangup !== 'function') return;
        
        try {
            await channel.get(); // Check if channel still exists
            await withTimeout(channel.hangup(), 5000, `${type} channel hangup`);
            logger.info(`[Cleanup] Hung up ${type} channel ${channel.id}`);
        } catch (err) {
            if (!err.message?.includes('404')) {
                logger.warn(`[Cleanup] Error hanging up ${type} channel: ${err.message}`);
            }
        }
    }

    async safeDestroy(bridge, type) {
        if (!bridge || typeof bridge.destroy !== 'function') return;
        
        try {
            await withTimeout(bridge.destroy(), 5000, `${type} bridge destroy`);
            logger.info(`[Cleanup] Destroyed ${type} bridge ${bridge.id}`);
        } catch (err) {
            if (!err.message?.includes('404')) {
                logger.warn(`[Cleanup] Error destroying ${type} bridge: ${err.message}`);
            }
        }
    }

    updateCallState(channelId, newState) {
        const callData = this.tracker.getCall(channelId);
        if (!callData) {
            logger.warn(`[State] No call data found for ${channelId}`);
            return;
        }

        try {
            StateValidator.validateTransition(callData.state, newState);
            this.tracker.updateCall(channelId, { state: newState });
            logger.info(`[State] ${channelId}: ${callData.state} → ${newState}`);
        } catch (err) {
            logger.error(`[State] Invalid transition for ${channelId}: ${err.message}`);
            throw err;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        logger.info('[ARI] Initiating graceful shutdown...');
        this.isShuttingDown = true;
        
        try {
            // Clean up all active calls
            const activeCalls = Array.from(this.tracker.calls.keys());
            logger.info(`[ARI] Cleaning up ${activeCalls.length} active calls`);
            
            await Promise.allSettled(
                activeCalls.map(callId => 
                    this.cleanupChannel(callId, 'System shutdown')
                )
            );
            
            // Clean up RTP sender service
            try {
                const rtpSenderService = require('./rtp.sender.service');
                rtpSenderService.cleanupAll();
            } catch (err) {
                logger.warn(`[ARI] Error cleaning up RTP sender: ${err.message}`);
            }
            
            // Stop health check
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            
            // Cancel reconnection timer
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            // Close ARI client
            if (this.client) {
                this.client.close();
                this.client = null;
                logger.info('[ARI] Client closed');
            }
            
            // Clean up resources
            this.cleanup();
            this.isConnected = false;
            
            // Clear global reference
            if (typeof global !== 'undefined') {
                global.ariClient = null;
            }
            
            logger.info('[ARI] Graceful shutdown completed');
            
        } catch (err) {
            logger.error(`[ARI] Error during shutdown: ${err.message}`, err);
            throw err;
        }
    }

    // Health check method
    async healthCheck() {
        if (!this.isConnected || !this.client) {
            return { status: 'disconnected', healthy: false };
        }

        try {
            await withTimeout(
                this.client.applications.list(),
                5000,
                'Health check'
            );
            
            return { 
                status: 'connected', 
                healthy: true,
                activeCalls: this.tracker.calls.size,
                retryCount: this.retryCount
            };
        } catch (err) {
            return { 
                status: 'error', 
                healthy: false, 
                error: err.message 
            };
        }
    }
}

// Factory function and module exports
let ariClientInstance = null;

const createAriClient = () => {
    if (!ariClientInstance) {
        ariClientInstance = new AsteriskAriClient();
    }
    return ariClientInstance;
};

module.exports = {
    startAriClient: async () => {
        const client = createAriClient();
        
        if (!client.isConnected && client.retryCount === 0) {
            await client.start();
        } else if (client.isConnected) {
            logger.info('[ARI] Client already connected');
        } else {
            logger.info('[ARI] Client is currently in retry sequence');
        }
        
        return client;
    },
    
    getAriClientInstance: () => {
        return ariClientInstance || createAriClient();
    },
    
    shutdownAriClient: async () => {
        if (ariClientInstance?.isConnected) {
            await ariClientInstance.shutdown();
            ariClientInstance = null;
            return true;
        }
        return false;
    },
    
    // Export for testing
    AsteriskAriClient,
    CONFIG,
    StateValidator,
    CircuitBreaker,
    withTimeout
};