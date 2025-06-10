const AriClient = require('ari-client');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const config = require('../config/config');
const logger = require('../config/logger');
const openAIService = require('./openai.realtime.service');
const { Conversation, Patient } = require('../models');
const channelTracker = require('./channel.tracker');
const rtpListenerService = require('./rtp.listener.service');
const rtpSenderService = require('./rtp.sender.service');

// Configuration constants
const CONFIG = {
    MAX_RETRIES: config.ari?.maxRetries || 10,
    RETRY_DELAY: config.ari?.retryDelay || 3000,
    MAX_RETRY_DELAY: config.ari?.maxRetryDelay || 30000,
    KEEP_ALIVE_INTERVAL: config.ari?.keepAliveInterval || 20000,
    OPERATION_TIMEOUT: config.ari?.operationTimeout || 30000,
    CHANNEL_SETUP_TIMEOUT: config.ari?.channelSetupTimeout || 10000,
    STASIS_APP_NAME: config.ari?.stasisAppName || 'myphonefriend',
    RTP_SEND_FORMAT: config.ari?.rtpSendFormat || 'ulaw'
};

function sanitizeHost(raw) {
    try {
        if (!raw.startsWith('http')) raw = `http://${raw}`;
        const url = new URL(raw);
        return url.hostname;
    } catch {
        return raw;
    }
}

function withTimeout(promise, timeoutMs, operationName = 'Operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.failureThreshold = threshold;
        this.timeout = timeout;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED';
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

class ResourceManager {
    constructor() {
        this.resources = new Map();
        this.abortControllers = new Map();
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
        this.RTP_BIANCA_HOST = sanitizeHost(config.asterisk.rtpBiancaHost);
        this.RTP_BIANCA_SEND_PORT = config.asterisk.rtpBiancaSendPort || (config.asterisk.rtpBiancaReceivePort + 1);
        this.setGlobalReference();
        this.setupGracefulShutdown();
    }

    checkMediaPipelineReady(asteriskChannelId) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData || callData.state !== 'pending_media') {
            return;
        }
        if (callData.isReadStreamReady && callData.isWriteStreamReady) {
            logger.info(`[ARI Pipeline] Bidirectional media pipeline is now active for ${asteriskChannelId}`);
            this.updateCallState(asteriskChannelId, 'pipeline_active');
        }
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
        if (!this.isConnected) throw new Error('ARI client not connected');
        if (!this.client) throw new Error('ARI client object is null');
        try {
            const apps = await withTimeout(this.client.applications.list(), 5000, 'Application list');
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
        await this.waitForAsteriskReady();
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

    async waitForAsteriskReady() {
        const maxAttempts = 30;
        const delayMs = 2000;
        const { url: ariUrl, username, password } = config.asterisk;
        logger.info('[ARI] Waiting for Asterisk to be ready...');
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(`${ariUrl}/ari/api-docs/resources.json`, {
                    headers: { 'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64') }
                });
                if (response.ok) {
                    logger.info(`[ARI] Asterisk is ready (attempt ${attempt}/${maxAttempts})`);
                    return true;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            } catch (err) {
                logger.warn(`[ARI] Asterisk not ready yet (attempt ${attempt}/${maxAttempts}): ${err.message}`);
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                } else {
                    throw new Error(`Asterisk not ready after ${maxAttempts} attempts`);
                }
            }
        }
    }

    setupWebSocketHandlers() {
        this.client.on('WebSocketConnected', () => logger.info('[ARI] WebSocket connected'));
        this.client.on('WebSocketReconnecting', (err) => logger.warn('[ARI] WebSocket reconnecting:', err?.message || 'Unknown error'));
        this.client.on('WebSocketMaxRetries', (err) => logger.error('[ARI] WebSocket max retries exceeded:', err?.message || 'Unknown error'));
        this.client.on('WebSocketClosed', (code, reason) => {
            logger.warn(`[ARI] WebSocket closed ${code}: ${reason}`);
            this.isConnected = false;
            if (code !== 1000 && !this.isShuttingDown) {
                this.scheduleReconnect();
            }
        });
    }

    async performConnectionTest() {
        try {
            await withTimeout(this.client.endpoints.list(), 5000, 'Endpoint list test');
            logger.info(`[ARI] Connection test successful`);
        } catch (err) {
            logger.warn(`[ARI] Connection test failed: ${err.message}`);
            throw err;
        }
    }

    startHealthCheck() {
        if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = setInterval(async () => {
            if (!this.isConnected) return;
            try {
                await withTimeout(this.client.applications.list(), 5000, 'Health check');
            } catch (err) {
                logger.error('[ARI] Health check failed:', err.message);
                this.handleDisconnection('Health check failure');
            }
        }, 30000);
    }

    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.retryCount >= CONFIG.MAX_RETRIES) {
            logger.error(`[ARI] Max reconnection attempts (${CONFIG.MAX_RETRIES}) exceeded`);
            return;
        }
        this.retryCount++;
        const delay = Math.min(CONFIG.RETRY_DELAY * Math.pow(1.5, this.retryCount - 1), CONFIG.MAX_RETRY_DELAY);
        logger.info(`[ARI] Scheduling reconnection in ${delay.toFixed(0)}ms (attempt ${this.retryCount})`);
        this.reconnectTimer = setTimeout(() => this.start().catch(err => {
            logger.error(`[ARI] Reconnection attempt ${this.retryCount} failed:`, err.message);
            this.scheduleReconnect();
        }), delay);
    }

    handleDisconnection(reason) {
        if (!this.isConnected || this.isShuttingDown) return;
        logger.warn(`[ARI] Handling disconnection: ${reason}`);
        this.isConnected = false;
        this.emit('disconnected', reason);
        this.cleanup();
        this.scheduleReconnect();
    }

    cleanup() {
        if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.healthCheckInterval = null;
        this.reconnectTimer = null;
        this.resourceManager.cleanupAll();
    }

    setupEventHandlers() {
        if (!this.client) throw new Error("Client not initialized for event handlers.");
        logger.info('[ARI] Setting up event handlers...');
        this.client.on('StasisStart', this.handleStasisStart.bind(this));
        this.client.on('StasisEnd', (e, c) => this.cleanupChannel(c.id, 'StasisEnd'));
        this.client.on('ChannelDestroyed', (e, c) => this.cleanupChannel(c.id, 'ChannelDestroyed'));
        this.client.on('ChannelHangupRequest', (e, c) => this.cleanupChannel(c.id, `HangupRequest: ${e.cause_txt}`));
        this.client.on('error', this.handleClientError.bind(this));
        logger.info('[ARI] Event handlers set up successfully');
    }

    async handleStasisStart(event, channel) {
        const { id: channelId, name: channelName = 'Unknown' } = channel;
        logger.info(`[ARI] StasisStart event for ${channelId} (${channelName})`);
        try {
            if (channelName.startsWith('PJSIP/twilio-trunk-')) {
                await this.handleStasisStartForMainChannel(channel, event);
            } else if (channelName.startsWith('Snoop/')) {
                await this.handleStasisStartForSnoop(channel);
            } else if (channelName.startsWith('Local/playback-')) {
                await this.handleStasisStartForPlayback(channel);
            } else {
                logger.warn(`[ARI] Unhandled StasisStart for channel type: ${channelName}.`);
            }
        } catch (err) {
            logger.error(`[ARI] Error in StasisStart handler for ${channelId}: ${err.message}`, err);
            await this.safeHangup(channel);
        }
    }

    async handleStasisStartForMainChannel(channel, event) {
        const { id: channelId } = channel;
        try {
            await channel.answer();
            this.tracker.addCall(channelId, { channel, state: 'answered' });
            logger.info(`[ARI] Answered main channel: ${channelId}`);
            const { twilioCallSid, patientId } = await this.extractCallParameters(event);
            if (!twilioCallSid || !patientId) throw new Error('Missing twilioCallSid or patientId');
            this.tracker.updateCall(channelId, { twilioCallSid, patientId });
            await this.setupMediaPipeline(channel, twilioCallSid, patientId);
        } catch (err) {
            logger.error(`[ARI] Error in main channel setup for ${channelId}: ${err.message}`, err);
            await this.cleanupChannel(channelId, `Main channel setup error`);
        }
    }

    async extractCallParameters(event) {
        const rawUri = event.args[0] || '';
        if (!rawUri) throw new Error('No SIP URI provided in StasisStart');
        const parts = rawUri.replace(/^<|>$/g, '').split(';');
        const paramMap = {};
        parts.slice(1).forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) paramMap[key] = decodeURIComponent(value);
        });
        return { twilioCallSid: paramMap.callSid, patientId: paramMap.patientId };
    }

    async setupMediaPipeline(channel, twilioCallSid, patientId) {
        const { id: asteriskChannelId } = channel;
        logger.info(`[ARI Pipeline] Setting up for Asterisk ID: ${asteriskChannelId}`);
        let mainBridge = null;
        let rtpPort = null;
        try {
            const { port } = await rtpListenerService.createListenerForCall(twilioCallSid);
            rtpPort = port;
            this.tracker.updateCall(asteriskChannelId, { rtpPort });

            const dbConversationId = await this.createConversationRecord(twilioCallSid, asteriskChannelId, patientId);
            await openAIService.initialize(asteriskChannelId, twilioCallSid, dbConversationId, "You are Bianca, a helpful AI assistant.");
            
            mainBridge = await this.client.bridges.create({ type: 'mixing', name: `call-${asteriskChannelId}` });
            this.tracker.updateCall(asteriskChannelId, { mainBridge, mainBridgeId: mainBridge.id, conversationId: dbConversationId });
            await this.client.bridges.addChannel({ bridgeId: mainBridge.id, channel: asteriskChannelId });
            
            await this.startRecording(mainBridge, asteriskChannelId);
            this.setupOpenAICallback();

            this.updateCallState(asteriskChannelId, 'pending_media');
            await this.initiateSnoopForExternalMedia(asteriskChannelId, rtpPort);
            logger.info(`[ARI Pipeline] External media creation initiated on port ${rtpPort}`);
        } catch (err) {
            logger.error(`[ARI Pipeline] CRITICAL ERROR in setupMediaPipeline for ${asteriskChannelId}: ${err.message}`, err);
            this.updateCallState(asteriskChannelId, 'failed');
            if (mainBridge) await this.safeDestroy(mainBridge);
            if (rtpPort) rtpListenerService.stopListenerForCall(twilioCallSid, rtpPort);
            throw err;
        }
    }

    async initiateSnoopForExternalMedia(asteriskChannelId, rtpPort) {
        logger.info(`[ExternalMedia Setup] Firing commands for channel: ${asteriskChannelId}`);
        try {
            this.client.channels.snoopChannel({
                channelId: asteriskChannelId,
                spy: 'in',
                app: CONFIG.STASIS_APP_NAME,
                appArgs: rtpPort.toString()
            }).catch(err => logger.error(`[ARI] Snoop initiation failed for ${asteriskChannelId}: ${err.message}`));

            this.client.channels.originate({
                endpoint: `Local/playback-${asteriskChannelId}@playback-context`,
                app: CONFIG.STASIS_APP_NAME,
            }).catch(err => logger.error(`[ARI] Playback initiation failed for ${asteriskChannelId}: ${err.message}`));
        } catch (err) {
            this.updateCallState(asteriskChannelId, 'failed');
            throw err;
        }
    }

    async handleStasisStartForSnoop(channel) {
        const { id: channelId, name: channelName, dialplan } = channel;
        const rtpPort = dialplan?.app_data;
        logger.info(`[ARI] StasisStart for Snoop channel ${channelId} with assigned port ${rtpPort}`);

        const match = channelName.match(/^Snoop\/([^-]+)-/);
        const parentChannelId = match?.[1];

        if (!parentChannelId || !this.tracker.getCall(parentChannelId) || !rtpPort) {
            logger.error(`[ARI] Invalid snoop context. Parent: ${parentChannelId}, Port: ${rtpPort}. Hanging up.`);
            return this.safeHangup(channel);
        }
        try {
            this.tracker.updateCall(parentChannelId, { snoopChannel: channel, snoopChannelId: channelId });
            await channel.answer();
            
            const rtpReadDest = `${this.RTP_BIANCA_HOST}:${rtpPort}`;
            await channel.externalMedia({
                app: CONFIG.STASIS_APP_NAME,
                external_host: rtpReadDest,
                format: CONFIG.RTP_SEND_FORMAT,
                direction: 'read'
            });
            logger.info(`[ARI] READ ExternalMedia requested: snoop ${channelId} -> ${rtpReadDest}`);
            this.tracker.updateCall(parentChannelId, { isReadStreamReady: true });
            this.checkMediaPipelineReady(parentChannelId);
        } catch (err) {
            logger.error(`[ARI] Failed to start READ ExternalMedia on snoop ${channelId}: ${err.message}`, err);
            await this.cleanupChannel(parentChannelId, `READ ExternalMedia setup failed`);
        }
    }

    async handleStasisStartForPlayback(channel) {
        if (!channel.name.includes(';2')) return; // Ignore leg 1
        logger.info(`[ARI] StasisStart for Playback channel leg 2: ${channel.id}`);
        const match = channel.name.match(/^Local\/playback-([^@]+)@/);
        const parentChannelId = match?.[1];

        if (!parentChannelId || !this.tracker.getCall(parentChannelId)) {
            logger.error(`[ARI] Parent call ${parentChannelId} not found for playback ${channel.id}. Hanging up.`);
            return this.safeHangup(channel);
        }
        const parentCallData = this.tracker.getCall(parentChannelId);
        try {
            this.tracker.updateCall(parentChannelId, { playbackChannel: channel, playbackChannelId: channel.id });
            await channel.answer();
            await this.client.bridges.addChannel({ bridgeId: parentCallData.mainBridgeId, channel: channel.id });
            
            const rtpAsteriskSource = `${this.RTP_BIANCA_HOST}:${this.RTP_BIANCA_SEND_PORT}`;
            const unicastRtpChannel = await channel.externalMedia({
                app: CONFIG.STASIS_APP_NAME,
                external_host: rtpAsteriskSource,
                format: CONFIG.RTP_SEND_FORMAT,
                direction: 'write'
            });
            
            await this.client.bridges.addChannel({ bridgeId: parentCallData.mainBridgeId, channel: unicastRtpChannel.id });
            logger.info(`[ARI] Created and bridged WRITE channel ${unicastRtpChannel.id}`);
            
            const asteriskRtpEndpoint = await this.getRtpEndpoint(unicastRtpChannel);
            await this.initializeRtpSenderWithEndpoint(parentChannelId, asteriskRtpEndpoint);
        } catch (err) {
            logger.error(`[ARI] Failed to start WRITE ExternalMedia on playback ${channel.id}: ${err.message}`, err);
            await this.cleanupChannel(parentChannelId, `WRITE ExternalMedia setup failed`);
        }
    }

    async getRtpEndpoint(unicastRtpChannel) {
        try {
            const [addressVar, portVar] = await Promise.all([
                unicastRtpChannel.getChannelVar({ variable: 'UNICASTRTP_LOCAL_ADDRESS' }),
                unicastRtpChannel.getChannelVar({ variable: 'UNICASTRTP_LOCAL_PORT' })
            ]);
            if (!addressVar?.value || !portVar?.value) {
                throw new Error('UNICASTRTP variables not set');
            }
            const endpoint = { host: addressVar.value, port: parseInt(portVar.value) };
            logger.info(`[ARI] Got Asterisk RTP endpoint for sending: ${endpoint.host}:${endpoint.port}`);
            return endpoint;
        } catch (err) {
            logger.error(`[ARI] Failed to get RTP endpoint: ${err.message}`);
            throw err;
        }
    }
    
    async initializeRtpSenderWithEndpoint(asteriskChannelId, rtpEndpoint) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) return;
        const twilioSid = callData.twilioCallSid;
        logger.info(`[RTP Sender] Initializing for ${twilioSid} to ${rtpEndpoint.host}:${rtpEndpoint.port}`);
        try {
            await rtpSenderService.initializeCall(twilioSid, {
                asteriskChannelId,
                rtpHost: rtpEndpoint.host,
                rtpPort: rtpEndpoint.port,
                format: CONFIG.RTP_SEND_FORMAT
            });
            this.tracker.updateCall(asteriskChannelId, { isWriteStreamReady: true });
            logger.info(`[ARI Pipeline] WRITE stream is now ready for ${asteriskChannelId}.`);
            this.checkMediaPipelineReady(asteriskChannelId);
        } catch (err) {
            logger.error(`[RTP Sender] Failed to initialize: ${err.message}`, err);
            this.updateCallState(asteriskChannelId, 'failed');
            throw err;
        }
    }

    async cleanupChannel(asteriskChannelId, reason = "Unknown") {
        const parentCallId = this.findParentCallForAuxiliaryChannel(asteriskChannelId) || asteriskChannelId;
        
        logger.info(`[Cleanup] Starting for call ${parentCallId} (triggered by channel ${asteriskChannelId}). Reason: ${reason}`);
        this.resourceManager.abortOperations(parentCallId);
        const resources = this.tracker.getResources(parentCallId);
        if (!resources) {
            logger.warn(`[Cleanup] No resources found for call ${parentCallId}, likely already cleaned.`);
            return;
        }
        const primarySid = resources.twilioCallSid || parentCallId;
        if (resources.rtpPort) {
            rtpListenerService.stopListenerForCall(primarySid, resources.rtpPort);
        }
        this.tracker.removeCall(parentCallId);
        try {
            await this.cleanupExternalServices(primarySid);
            await this.stopRecording(resources.recordingName);
            await this.cleanupAriResources(resources);
            await this.updateConversationRecord(resources.conversationId, reason);
            logger.info(`[Cleanup] Completed for call ${parentCallId}`);
        } catch (err) {
            logger.error(`[Cleanup] Error during cleanup for ${parentCallId}: ${err.message}`, err);
        }
    }
    
    findParentCallForAuxiliaryChannel(channelId) {
        for (const [mainCallId, callData] of this.tracker.calls.entries()) {
            if (callData.snoopChannelId === channelId ||
                callData.playbackChannelId === channelId
            ) {
                return mainCallId;
            }
        }
        return null;
    }

    async cleanupExternalServices(primarySid) {
        try {
            rtpSenderService.cleanupCall(primarySid);
            await openAIService.disconnect(primarySid);
        } catch(err) {
            logger.warn(`[Cleanup] Error during external service cleanup for ${primarySid}: ${err.message}`);
        }
    }
    
    async stopRecording(recordingName) {
        if (!recordingName) return;
        try {
            await this.client.recordings.stop({ recordingName });
            logger.info(`[Cleanup] Stopped recording ${recordingName}`);
        } catch (err) {
            if (!err.message?.includes('404')) logger.warn(`[Cleanup] Error stopping recording: ${err.message}`);
        }
    }

    async cleanupAriResources(resources) {
        const channels = [resources.snoopChannel, resources.playbackChannel, resources.mainChannel].filter(Boolean);
        for (const channel of channels) {
            await this.safeHangup(channel);
        }
        if (resources.mainBridge) await this.safeDestroy(resources.mainBridge);
    }
    
    async safeHangup(channel) {
        if (!channel || typeof channel.hangup !== 'function') return;
        try {
            await channel.hangup();
            logger.info(`[Cleanup] Hung up channel ${channel.id}`);
        } catch (err) {
            if (!err.message?.includes('404')) logger.warn(`[Cleanup] Error hanging up channel ${channel.id}: ${err.message}`);
        }
    }

    async safeDestroy(bridge) {
        if (!bridge || typeof bridge.destroy !== 'function') return;
        try {
            await bridge.destroy();
            logger.info(`[Cleanup] Destroyed bridge ${bridge.id}`);
        } catch (err) {
            if (!err.message?.includes('404')) logger.warn(`[Cleanup] Error destroying bridge ${bridge.id}: ${err.message}`);
        }
    }

    updateCallState(channelId, newState) {
        const callData = this.tracker.getCall(channelId);
        if (!callData) {
            logger.warn(`[State] No call data to update state for ${channelId}`);
            return;
        }
        const oldState = callData.state;
        this.tracker.updateCall(channelId, { state: newState });
        logger.info(`[State] ${channelId}: ${oldState} -> ${newState}`);
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

    setupOpenAICallback() {
        openAIService.setNotificationCallback((callbackId, type, data) => {
            try {
                switch (type) {
                    case 'audio_chunk':
                        this.handleOpenAIAudio(callbackId, data);
                        break;
                    case 'openai_session_ready':
                        logger.info(`[ARI] OpenAI session is ready for ${callbackId}`);
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
        const callData = this.findCallData(callbackId);
        if (callData) {
            this.sendAudioToChannel(callData.asteriskChannelId, data.audio);
        } else {
            logger.warn(`[ARI] Received audio for unknown call ID: ${callbackId}`);
        }
    }

    handleOpenAISessionExpired(callbackId) {
        const callData = this.findCallData(callbackId);
        if (callData) {
            logger.warn(`[ARI] OpenAI session expired for ${callData.asteriskChannelId}`);
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

    sendAudioToChannel(asteriskChannelId, audioBase64Ulaw) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) {
            logger.warn(`[ARI Audio] No call data found for ${asteriskChannelId}`);
            return;
        }
        const twilioSid = callData.twilioCallSid || asteriskChannelId;
        try {
            rtpSenderService.sendAudio(twilioSid, audioBase64Ulaw);
        } catch (err) {
            logger.error(`[ARI Audio] Error sending audio for ${twilioSid}: ${err.message}`);
        }
    }

    handleClientError(err) {
        logger.error(`[ARI] Client error: ${err.message}`, err);
        this.emit('client_error', err);
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
    
    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    
    async shutdown() {
        logger.info('[ARI] Initiating graceful shutdown...');
        this.isShuttingDown = true;
        const activeCalls = Array.from(this.tracker.calls.keys());
        logger.info(`[ARI] Cleaning up ${activeCalls.length} active calls`);
        await Promise.allSettled(activeCalls.map(callId => this.cleanupChannel(callId, 'System shutdown')));
        try {
            rtpSenderService.cleanupAll();
        } catch (err) {
            logger.warn(`[ARI] Error cleaning up RTP sender: ${err.message}`);
        }
        if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.client) this.client.close();
        this.cleanup();
        this.isConnected = false;
        if (typeof global !== 'undefined') global.ariClient = null;
        logger.info('[ARI] Graceful shutdown completed');
    }

    async healthCheck() {
        if (!this.isConnected || !this.client) return { status: 'disconnected', healthy: false };
        try {
            await withTimeout(this.client.applications.list(), 5000, 'Health check');
            return {
                status: 'connected',
                healthy: true,
                activeCalls: this.tracker.calls.size,
                retryCount: this.retryCount
            };
        } catch (err) {
            return { status: 'error', healthy: false, error: err.message };
        }
    }
}

let ariClientInstance = null;
const createAriClient = () => {
    if (!ariClientInstance) ariClientInstance = new AsteriskAriClient();
    return ariClientInstance;
};

module.exports = {
    startAriClient: async () => {
        const client = createAriClient();
        if (!client.isConnected && client.retryCount === 0) await client.start();
        else if (client.isConnected) logger.info('[ARI] Client already connected');
        else logger.info('[ARI] Client is currently in retry sequence');
        return client;
    },
    getAriClientInstance: () => ariClientInstance || createAriClient(),
    shutdownAriClient: async () => {
        if (ariClientInstance?.isConnected) {
            await ariClientInstance.shutdown();
            ariClientInstance = null;
            return true;
        }
        return false;
    },
    AsteriskAriClient,
    CONFIG
};
