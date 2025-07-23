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
const portManager = require('./port.manager.service');
const rtpListenerService = require('./rtp.listener.service');
const { getAsteriskIP, getRTPAddress, getNetworkDebugInfo } = require('../utils/network.utils');

// Configuration constants
const CONFIG = {
    MAX_RETRIES: config.ari?.maxRetries || 10,
    RETRY_DELAY: config.ari?.retryDelay || 3000,
    MAX_RETRY_DELAY: config.ari?.maxRetryDelay || 30000,
    KEEP_ALIVE_INTERVAL: config.ari?.keepAliveInterval || 20000,
    OPERATION_TIMEOUT: config.ari?.operationTimeout || 30000,
    CHANNEL_SETUP_TIMEOUT: config.ari?.channelSetupTimeout || 10000,
    STASIS_APP_NAME: config.ari?.stasisAppName || 'myphonefriend',
    RTP_SEND_FORMAT: config.ari?.rtpSendFormat || 'ulaw',
    AUDIO_FORMAT: config.ari?.audioFormat || 'ulaw',
    FILE_EXTENSION: config.ari?.fileExtension || 'ulaw'
};

// --- REFACTOR 1: A simpler, high-level state machine ---
const VALID_STATE_TRANSITIONS = {
    'new': ['answered'],
    'answered': ['pending_media', 'cleanup'],
    'pending_media': ['pipeline_active', 'failed', 'cleanup'],
    'pipeline_active': ['cleanup', 'failed'],
    'failed': ['cleanup'],
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
        this.RTP_BIANCA_HOST = null;
        this.RTP_ASTERISK_HOST = getAsteriskIP();

        // Set global reference safely
        this.setGlobalReference();
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }

    // Add method to initialize network configuration
    async initializeNetworkConfiguration() {
        try {
            // Get our RTP address (private IP in hybrid mode)
            this.RTP_BIANCA_HOST = await getRTPAddress();
            logger.info(`[ARI Network] Bianca RTP Host: ${this.RTP_BIANCA_HOST}`);
            logger.info(`[ARI Network] Asterisk Host: ${this.RTP_ASTERISK_HOST}`);
            
            // Log network debug info
            const debugInfo = await getNetworkDebugInfo();
            logger.info(`[ARI Network] Network configuration:`, {
                networkMode: debugInfo.environment.NETWORK_MODE,
                usePrivateRTP: debugInfo.environment.USE_PRIVATE_NETWORK_FOR_RTP,
                rtpAddress: debugInfo.rtpAddress,
                asteriskIP: debugInfo.asteriskIP
            });
            
        } catch (err) {
            logger.error(`[ARI Network] Failed to initialize network configuration: ${err.message}`);
            throw err;
        }
    }

    checkMediaPipelineReady(asteriskChannelId) {
        const callData = this.tracker.getCall(asteriskChannelId);
        // Only proceed if we are in the pending state
        if (!callData || callData.state !== 'pending_media') {
            return;
        }

        // Check if both read (user->app) and write (app->user) streams are ready
        if (callData.isReadStreamReady && callData.isWriteStreamReady) {
            logger.info(`[ARI Pipeline] Bidirectional media pipeline is now active for ${asteriskChannelId}`);
            this.updateCallState(asteriskChannelId, 'pipeline_active');
            
            // FIX BRIDGE MEMBERSHIP BEFORE PROCEEDING
            setTimeout(async () => {
                await this.fixBridgeMembership(asteriskChannelId);
                await this.verifyAudioFlow(asteriskChannelId);
            }, 500);
            
            // Trigger the initial greeting from the AI
            const primarySid = callData.twilioCallSid || asteriskChannelId;
            
            logger.info(`[ARI Pipeline] Triggering initial AI greeting for ${primarySid}`);
            
            // Wait a bit longer to ensure OpenAI connection is fully established
            setTimeout(() => {
                // Check if OpenAI connection is ready
                if (!openAIService.isConnectionReady(primarySid)) {
                    logger.info(`[ARI Pipeline] OpenAI not ready yet, waiting for connection...`);
                    
                    // Set up a retry mechanism
                    let retries = 0;
                    const maxRetries = 10;
                    const retryInterval = setInterval(() => {
                        retries++;
                        if (openAIService.isConnectionReady(primarySid)) {
                            clearInterval(retryInterval);
                            logger.info(`[ARI Pipeline] OpenAI ready after ${retries} retries, sending comfort noise`);
                            
                            // Send comfort noise to establish audio pipeline
                            const comfortNoise = Buffer.alloc(1600); // 200ms at 8kHz
                            for (let i = 0; i < comfortNoise.length; i++) {
                                comfortNoise[i] = 0xFF + Math.floor(Math.random() * 4) - 2;
                            }
                            const comfortNoiseBase64 = comfortNoise.toString('base64');
                            openAIService.sendAudioChunk(primarySid, comfortNoiseBase64, true);
                            
                            // Don't trigger response.create automatically - wait for user to speak
                            logger.info(`[ARI Pipeline] Audio pipeline ready for ${primarySid} - waiting for user input`);
                        } else if (retries >= maxRetries) {
                            clearInterval(retryInterval);
                            logger.error(`[ARI Pipeline] OpenAI connection failed to establish after ${maxRetries} retries for ${primarySid}`);
                        }
                    }, 500); // Check every 500ms
                } else {
                    // OpenAI is ready, send comfort noise immediately
                    logger.info(`[ARI Pipeline] OpenAI ready, sending comfort noise for ${primarySid}`);
                    
                    const comfortNoise = Buffer.alloc(1600); // 200ms at 8kHz
                    for (let i = 0; i < comfortNoise.length; i++) {
                        comfortNoise[i] = 0xFF + Math.floor(Math.random() * 4) - 2;
                    }
                    const comfortNoiseBase64 = comfortNoise.toString('base64');
                    openAIService.sendAudioChunk(primarySid, comfortNoiseBase64, true);
                    
                    // Don't trigger response.create automatically - wait for user to speak
                    logger.info(`[ARI Pipeline] Audio pipeline ready for ${primarySid} - waiting for user input`);
                }
            }, 1000); // Initial delay of 1 second
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
        // Initialize network configuration first
        await this.initializeNetworkConfiguration();
        
        // Wait for Asterisk to be ready before attempting connection
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

    async waitForAsteriskReady() {
        const maxAttempts = 30; // 30 attempts = 60 seconds with 2s delay
        const delayMs = 2000;
        const { url: ariUrl, username, password } = config.asterisk;
        
        logger.info('[ARI] Waiting for Asterisk to be ready...');
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Try to fetch the swagger documentation
                const response = await fetch(`${ariUrl}/ari/api-docs/resources.json`, {
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
                    }
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
            
            // --- REFACTOR 4: Initialize the call with readiness flags ---
            this.tracker.addCall(channelId, {
                channel: channel,
                mainChannel: channel,
                twilioCallSid: null,
                patientId: null,
                state: 'answered', // Initial high-level state
                isReadStreamReady: false,
                isWriteStreamReady: false,
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

    // Update your handleStasisStartForUnicastRTP method with better detection logic:
async handleStasisStartForUnicastRTP(channel) {
    logger.info(`[ARI] Processing UnicastRTP channel: ${channel.id}`);

    const parentCallData = this.findParentCallForRtpChannel(channel);
    if (!parentCallData) {
        logger.warn(`[ARI] No parent call found for RTP channel ${channel.id}. Hanging up.`);
        await this.safeHangup(channel, 'Orphaned UnicastRTP');
        return;
    }

    const { parentId, callData } = parentCallData;
    
    // Determine if this is inbound or outbound based on channel name and existing channels
    const channelName = channel.name || '';
    
    // FIXED: Better channel detection logic
    // Port 0 indicates this is an outbound channel (Asterisk will allocate the actual port)
    const portMatch = channelName.match(/:(\d+)-/);
    const port = portMatch ? parseInt(portMatch[1]) : null;
    const isOutboundChannel = port === 0 || !portMatch;
    
    logger.info(`[ARI] Channel ${channel.id} detection: name="${channelName}", port=${port}, isOutbound=${isOutboundChannel}`);
    
    logger.info(`[ARI] Channel ${channel.id} analysis: name="${channelName}", isOutbound=${isOutboundChannel}, existingInbound=${!!callData.inboundRtpChannelId}, existingOutbound=${!!callData.outboundRtpChannelId}`);
    
    // Route based on channel type and existing channels
    if (isOutboundChannel) {
        // This is the outbound channel (WRITE stream - app->user)
        if (!callData.outboundRtpChannelId) {
            logger.info(`[ARI] Routing channel ${channel.id} to OUTBOUND handler`);
            await this.handleOutboundRtpChannel(channel, parentId, callData);
        } else {
            logger.warn(`[ARI] Duplicate outbound RTP channel ${channel.id} - hanging up`);
            await this.safeHangup(channel, 'Duplicate Outbound RTP');
        }
    } else {
        // This is the inbound channel (READ stream - user->app)
        if (!callData.inboundRtpChannelId) {
            logger.info(`[ARI] Routing channel ${channel.id} to INBOUND handler`);
            await this.handleInboundRtpChannel(channel, parentId, callData);
        } else {
            logger.warn(`[ARI] Duplicate inbound RTP channel ${channel.id} - hanging up`);
            await this.safeHangup(channel, 'Duplicate Inbound RTP');
        }
    }
}

    findParentCallForRtpChannel(channel) {
        const channelName = channel.name || '';
        logger.info(`[ARI] Attempting to find parent for RTP channel: ${channel.id} (${channelName})`);
        
        // Method 1: Check if this channel is already tracked as an RTP channel for any call
        const existingCallData = this.tracker.findCallByUnicastRtpChannelId(channel.id);
        if (existingCallData) {
            logger.info(`[ARI] Found parent call ${existingCallData.asteriskChannelId} for RTP channel ${channel.id} (already tracked)`);
            return { parentId: existingCallData.asteriskChannelId, callData: existingCallData };
        }
        
        // Method 1b: Check other RTP channel IDs
        for (const [callId, callData] of this.tracker.calls.entries()) {
            if (callData.inboundRtpChannelId === channel.id || 
                callData.outboundRtpChannelId === channel.id) {
                logger.info(`[ARI] Found parent call ${callId} for RTP channel ${channel.id} (by other RTP channel ID)`);
                return { parentId: callId, callData: callData };
            }
        }
        
        // Method 2: Extract port from channel name (e.g., "UnicastRTP/3.21.122.60:16384-...")
        const portMatch = channelName.match(/:(\d+)/);
        if (portMatch) {
            const port = parseInt(portMatch[1]);
            
            // Use channel tracker's existing method
            const callData = this.tracker.findCallByRtpPort(port);
            if (callData) {
                logger.info(`[ARI] Found parent call ${callData.asteriskChannelId} for RTP channel ${channel.id} by port ${port}`);
                return { 
                    parentId: callData.asteriskChannelId, 
                    callData: callData 
                };
            }
            
            logger.warn(`[ARI] No call found with RTP port ${port} for channel ${channel.id}`);
        }
        
        // Method 3: For outbound RTP channels, look for calls expecting an outbound channel
        const hasPortInName = channelName.match(/:\d+-/);
        const isOutboundChannel = !hasPortInName;
        
        if (isOutboundChannel) {
            logger.info(`[ARI] Detected outbound RTP channel ${channel.id} (no port in name)`);
            
            // Find a call that's expecting an outbound RTP channel
            for (const [callId, data] of this.tracker.calls.entries()) {
                if (data.state === 'pending_media' && !data.outboundRtpChannelId) {
                    logger.info(`[ARI] Found parent call ${callId} expecting outbound RTP channel`);
                    return { parentId: callId, callData: data };
                }
            }
            
            logger.warn(`[ARI] No call found expecting outbound RTP channel`);
        }
        
        // Method 4: Check if this is an inbound RTP channel by looking for our read port
        for (const [callId, data] of this.tracker.calls.entries()) {
            if (data.rtpReadPort && data.state === 'pending_media' && !data.inboundRtpChannelId) {
                // This could be the inbound RTP channel for this call
                logger.info(`[ARI] Found potential parent call ${callId} for inbound RTP channel ${channel.id}`);
                return { parentId: callId, callData: data };
            }
        }
        
        logger.warn(`[ARI] Could not identify parent for RTP channel: ${channelName}`);
        return null;
    }

    isChannelForCall(channel, callId, callData) {
        // Determine if an RTP channel belongs to a specific call
        const channelName = channel.name || '';
        
        // Check various ways the channel might be associated
        if (channelName.includes(callId)) return true;
        if (callData.twilioCallSid && channelName.includes(callData.twilioCallSid)) return true;
        if (callData.pendingSnoopId && channelName.includes(callData.pendingSnoopId)) return true;
        
        // You can add more sophisticated checks here based on your channel naming conventions
        return false;
    }

    async handleInboundRtpChannel(channel, parentId, callData) {
        logger.info(`[ARI] Setting up INBOUND RTP channel ${channel.id} for call ${parentId}`);
        
        try {
            // Answer the RTP channel
            await channel.answer();
            logger.info(`[ARI] Answered inbound RTP channel ${channel.id}`);
            
            // Wait a bit for snoop bridge to be created
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get the latest call data to check if snoop bridge was created
            const latestCallData = this.tracker.getCall(parentId);
            
            // Try up to 10 times to wait for snoop bridge
            let attempts = 0;
            while (!latestCallData.snoopBridgeId && attempts < 10) {
                logger.info(`[ARI] Waiting for snoop bridge... attempt ${attempts + 1}`);
                await new Promise(resolve => setTimeout(resolve, 100));
                const updatedData = this.tracker.getCall(parentId);
                if (updatedData.snoopBridgeId) {
                    latestCallData.snoopBridgeId = updatedData.snoopBridgeId;
                    break;
                }
                attempts++;
            }
            
            // Now add to the correct bridge
            if (latestCallData.snoopBridgeId) {
                // Snoop bridge exists, add directly
                await this.client.bridges.addChannel({
                    bridgeId: latestCallData.snoopBridgeId,
                    channel: channel.id
                });
                logger.info(`[ARI] Added inbound RTP channel ${channel.id} directly to snoop bridge ${latestCallData.snoopBridgeId}`);
            } else {
                // Snoop bridge still doesn't exist, add to main bridge temporarily
                logger.warn(`[ARI] Snoop bridge not found after waiting, adding to main bridge temporarily`);
                if (callData.mainBridgeId) {
                    await this.client.bridges.addChannel({
                        bridgeId: callData.mainBridgeId,
                        channel: channel.id
                    });
                    logger.info(`[ARI] Added inbound RTP channel ${channel.id} to main bridge ${callData.mainBridgeId} (temporary)`);
                    
                    // Set flag to move this channel when snoop bridge is ready
                    this.tracker.updateCall(parentId, { 
                        pendingInboundRtpChannelMove: true,
                        inboundRtpChannelNeedsMove: channel.id
                    });
                    
                    // Schedule another check in 1 second
                    setTimeout(async () => {
                        const finalData = this.tracker.getCall(parentId);
                        if (finalData && finalData.snoopBridgeId && finalData.pendingInboundRtpChannelMove) {
                            try {
                                logger.info(`[ARI] Late move: Moving inbound RTP ${channel.id} to snoop bridge`);
                                
                                await this.client.bridges.removeChannel({
                                    bridgeId: finalData.mainBridgeId,
                                    channel: channel.id
                                });
                                
                                await this.client.bridges.addChannel({
                                    bridgeId: finalData.snoopBridgeId,
                                    channel: channel.id
                                });
                                
                                logger.info(`[ARI] Late move: Successfully moved inbound RTP to snoop bridge`);
                                
                                this.tracker.updateCall(parentId, {
                                    pendingInboundRtpChannelMove: false,
                                    inboundRtpChannelNeedsMove: null
                                });
                            } catch (err) {
                                logger.error(`[ARI] Late move failed: ${err.message}`);
                            }
                        }
                    }, 1000);
                }
            }
            
            // Get and log the RTP endpoint info for debugging
            try {
                const [localAddr, localPort, remoteAddr, remotePort] = await Promise.all([
                    channel.getChannelVar({ variable: 'UNICASTRTP_LOCAL_ADDRESS' }).catch(() => ({ value: 'unknown' })),
                    channel.getChannelVar({ variable: 'UNICASTRTP_LOCAL_PORT' }).catch(() => ({ value: 'unknown' })),
                    channel.getChannelVar({ variable: 'UNICASTRTP_REMOTE_ADDRESS' }).catch(() => ({ value: 'unknown' })),
                    channel.getChannelVar({ variable: 'UNICASTRTP_REMOTE_PORT' }).catch(() => ({ value: 'unknown' }))
                ]);
                
                logger.info(`[ARI] Inbound RTP channel ${channel.id} configuration:`, {
                    local: `${localAddr.value}:${localPort.value}`,
                    remote: `${remoteAddr.value}:${remotePort.value}`,
                    expectedRemotePort: callData.rtpReadPort
                });
                
                // Verify the remote endpoint matches what we expect
                if (remotePort.value !== 'unknown' && parseInt(remotePort.value) !== callData.rtpReadPort) {
                    logger.warn(`[ARI] RTP remote port mismatch! Expected ${callData.rtpReadPort}, got ${remotePort.value}`);
                }
            } catch (err) {
                logger.warn(`[ARI] Could not get RTP channel variables: ${err.message}`);
            }
            
            // Update tracking
            this.tracker.updateCall(parentId, { 
                inboundRtpChannel: channel,
                inboundRtpChannelId: channel.id,
                unicastRtpChannel: channel, // Track as the main UnicastRTP channel
                unicastRtpChannelId: channel.id,
                isReadStreamReady: true
            });
            
            logger.info(`[ARI Pipeline] READ stream is ready for ${parentId}`);
            
            // Verify RTP listener is active
            const rtpListenerService = require('./rtp.listener.service');
            const listenerStatus = rtpListenerService.getListenerStatus?.(callData.rtpReadPort);
            if (listenerStatus?.found) {
                logger.info(`[ARI] RTP Listener confirmed active on port ${callData.rtpReadPort}`);
            } else {
                logger.error(`[ARI] WARNING: No RTP listener found on port ${callData.rtpReadPort}!`);
            }
            
            this.checkMediaPipelineReady(parentId);
            
        } catch (err) {
            logger.error(`[ARI] Error setting up inbound RTP channel: ${err.message}`, err);
            this.updateCallState(parentId, 'failed');
            throw err;
        }
    }

    async handleOutboundRtpChannel(channel, parentId, callData) {
        logger.info(`[ARI] Setting up OUTBOUND RTP channel ${channel.id} for call ${parentId}`);
        
        try {
            // Answer the channel
            await channel.answer();
            logger.info(`[ARI] Answered outbound RTP channel ${channel.id}`);
            
            // Get the RTP endpoint where Asterisk expects to receive audio
            const [addressVar, portVar] = await Promise.all([
                channel.getChannelVar({ variable: 'UNICASTRTP_LOCAL_ADDRESS' }),
                channel.getChannelVar({ variable: 'UNICASTRTP_LOCAL_PORT' })
            ]);
            
            if (!addressVar?.value || !portVar?.value) {
                throw new Error('Could not get RTP endpoint from outbound channel');
            }
            
            const asteriskRtpEndpoint = {
                host: addressVar.value,
                port: parseInt(portVar.value)
            };
            
            logger.info(`[ARI] Asterisk RTP endpoint for WRITE: ${asteriskRtpEndpoint.host}:${asteriskRtpEndpoint.port}`);
            
            // CRITICAL: Add outbound RTP channel to main bridge for audio routing to phone
            // This channel receives audio from our app and routes it to the user's phone
            if (callData.mainBridgeId) {
                await this.client.bridges.addChannel({
                    bridgeId: callData.mainBridgeId,
                    channel: channel.id
                });
                logger.info(`[ARI] Added outbound RTP channel ${channel.id} to main bridge ${callData.mainBridgeId} for audio routing`);
            } else {
                logger.error(`[ARI] No main bridge found for call ${parentId}!`);
            }
            
            // Update tracking
            this.tracker.updateCall(parentId, { 
                outboundRtpChannel: channel,
                outboundRtpChannelId: channel.id,
                unicastRtpChannel: channel, // Track as the main UnicastRTP channel
                unicastRtpChannelId: channel.id,
                asteriskRtpEndpoint: asteriskRtpEndpoint,
                isWriteStreamReady: true
            });
            
            // Initialize RTP sender with the correct endpoint
            await this.initializeRtpSenderWithEndpoint(parentId, asteriskRtpEndpoint);
            
            logger.info(`[ARI Pipeline] WRITE stream is ready for ${parentId}`);
            this.checkMediaPipelineReady(parentId);
            
        } catch (err) {
            logger.error(`[ARI] Error setting up outbound RTP channel: ${err.message}`, err);
            this.updateCallState(parentId, 'failed');
            throw err;
        }
    }

    // Update the network debug function to use new utilities
    async diagnoseAudioFlow(asteriskChannelId) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) {
            logger.error('[Audio Diagnose] No call data found');
            return;
        }
        
        // Get comprehensive network debug info
        const networkDebug = await getNetworkDebugInfo();
        
        logger.info('[Audio Diagnose] ===== AUDIO FLOW DIAGNOSTIC =====');
        logger.info('[Audio Diagnose] Network Configuration:', {
            networkMode: networkDebug.environment.NETWORK_MODE,
            usePrivateRTP: networkDebug.environment.USE_PRIVATE_NETWORK_FOR_RTP,
            rtpAddress: networkDebug.rtpAddress,
            asteriskIP: networkDebug.asteriskIP,
            currentIPs: networkDebug.currentIPs
        });
        
        logger.info('[Audio Diagnose] Call State:', {
            asteriskChannelId,
            twilioCallSid: callData.twilioCallSid,
            state: callData.state,
            isReadStreamReady: callData.isReadStreamReady,
            isWriteStreamReady: callData.isWriteStreamReady
        });
        
        // Check bridges
        logger.info('[Audio Diagnose] Bridges:', {
            mainBridgeId: callData.mainBridgeId,
            snoopBridgeId: callData.snoopBridgeId,
            hasSnoopBridge: !!callData.snoopBridgeId
        });
        
        // Check channels
        logger.info('[Audio Diagnose] Channels:', {
            mainChannel: !!callData.mainChannel,
            snoopChannel: !!callData.snoopChannel,
            inboundRtpChannel: !!callData.inboundRtpChannel,
            outboundRtpChannel: !!callData.outboundRtpChannel,
            playbackChannel: !!callData.playbackChannel
        });
        
        // Check RTP ports
        logger.info('[Audio Diagnose] RTP Ports:', {
            readPort: callData.rtpReadPort,
            writePort: callData.rtpWritePort
        });
        
        // Check RTP listener
        const rtpListener = require('./rtp.listener.service');
        const listenerStatus = rtpListener.getFullStatus?.();
        const ourListener = listenerStatus?.listeners?.find(l => l.port === callData.rtpReadPort);
        
        if (ourListener) {
            logger.info('[Audio Diagnose] RTP Listener:', {
                port: ourListener.port,
                packetsReceived: ourListener.packetsReceived,
                bytesReceived: ourListener.bytesReceived,
                packetsPerSecond: ourListener.packetsPerSecond,
                source: ourListener.source
            });
        } else {
            logger.error('[Audio Diagnose] NO RTP LISTENER FOUND!');
        }
        
        // Check RTP sender
        const rtpSender = require('./rtp.sender.service');
        const senderStatus = rtpSender.getStatus();
        const ourSender = senderStatus.calls.find(c => 
            c.callId === callData.twilioCallSid || c.callId === asteriskChannelId
        );
        
        if (ourSender) {
            logger.info('[Audio Diagnose] RTP Sender:', {
                target: `${ourSender.rtpHost}:${ourSender.rtpPort}`,
                packetsSent: ourSender.stats.packetsSent,
                bytesSent: ourSender.stats.bytesSent,
                errors: ourSender.stats.errors
            });
        } else {
            logger.error('[Audio Diagnose] NO RTP SENDER FOUND!');
        }
        
        // Check OpenAI connection
        const openAIConnected = openAIService.isConnectionReady(callData.twilioCallSid || asteriskChannelId);
        logger.info('[Audio Diagnose] OpenAI Connection:', {
            isReady: openAIConnected
        });
        
        // NEW: Verify bridge connections
        await this.verifyBridgeConnections(asteriskChannelId);
        
        logger.info('[Audio Diagnose] =================================');
    }

    // Add a method to refresh network configuration if needed
    async refreshNetworkConfiguration() {
        try {
            await this.initializeNetworkConfiguration();
            logger.info('[ARI Network] Network configuration refreshed');
        } catch (err) {
            logger.error(`[ARI Network] Failed to refresh network configuration: ${err.message}`);
            throw err;
        }
    }

    // Update the health check to include network information
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
            
            const trackerStats = this.tracker.getStats();
            const portStats = portManager.getStats();
            const networkDebug = await getNetworkDebugInfo();
            
            return { 
                status: 'connected', 
                healthy: true,
                activeCalls: this.tracker.calls.size,
                retryCount: this.retryCount,
                portUtilization: `${portStats.leased}/${portStats.totalPorts} (${portStats.utilizationPercent}%)`,
                callsWithPorts: trackerStats.callsWithBothPorts,
                trackerStats,
                portStats,
                networkConfiguration: {
                    networkMode: networkDebug.environment.NETWORK_MODE,
                    usePrivateRTP: networkDebug.environment.USE_PRIVATE_NETWORK_FOR_RTP,
                    rtpAddress: networkDebug.rtpAddress,
                    asteriskIP: networkDebug.asteriskIP
                }
            };
        } catch (err) {
            return { 
                status: 'error', 
                healthy: false, 
                error: err.message 
            };
        }
    }

    async handleStasisStartForSnoop(channel, channelName) {
        const channelId = channel.id;
        const match = channelName.match(/^Snoop\/([^-]+)-/);
        const parentChannelId = match?.[1];
        
        const parentCallData = this.tracker.getCall(parentChannelId);
        if (!parentCallData || !parentCallData.rtpReadPort) {
            logger.error(`[ARI] No allocated read port for parent call ${parentChannelId}`);
            return this.safeHangup(channel, 'No allocated read port');
        }
        
        try {
            // Step 1: Answer the snoop channel
            await channel.answer();
            logger.info(`[ARI] Answered snoop channel ${channelId}`);
            
            // Step 2: Update tracking
            this.tracker.updateCall(parentChannelId, {
                snoopChannel: channel,
                snoopChannelId: channelId
            });
            
            // Step 3: Create a bridge for the snoop channel
            const snoopBridge = await this.client.bridges.create({
                type: 'mixing',
                name: `snoop-bridge-${parentChannelId}`
            });
            
            logger.info(`[ARI] Created snoop bridge ${snoopBridge.id} for call ${parentChannelId}`);
            
            // Step 4: Add the snoop channel to the bridge
            await this.client.bridges.addChannel({
                bridgeId: snoopBridge.id,
                channel: channelId
            });
            
            logger.info(`[ARI] Added snoop channel ${channelId} to bridge ${snoopBridge.id}`);
            
            // Step 5: Update tracking with bridge info
            this.tracker.updateCall(parentChannelId, {
                snoopBridge: snoopBridge,
                snoopBridgeId: snoopBridge.id
            });
            
            // Step 6: Check if we need to move the inbound RTP channel
            const updatedParentData = this.tracker.getCall(parentChannelId);
            if (updatedParentData.pendingInboundRtpChannelMove && updatedParentData.inboundRtpChannelId) {
                try {
                    logger.info(`[ARI] Moving inbound RTP channel ${updatedParentData.inboundRtpChannelId} from main to snoop bridge`);
                    
                    // Remove from main bridge
                    await this.client.bridges.removeChannel({
                        bridgeId: updatedParentData.mainBridgeId,
                        channel: updatedParentData.inboundRtpChannelId
                    });
                    
                    // Add to snoop bridge
                    await this.client.bridges.addChannel({
                        bridgeId: snoopBridge.id,
                        channel: updatedParentData.inboundRtpChannelId
                    });
                    
                    logger.info(`[ARI] Successfully moved inbound RTP channel ${updatedParentData.inboundRtpChannelId} to snoop bridge`);
                    
                    this.tracker.updateCall(parentChannelId, {
                        pendingInboundRtpChannelMove: false,
                        inboundRtpChannelNeedsMove: null
                    });
                } catch (err) {
                    logger.error(`[ARI] Failed to move inbound RTP channel: ${err.message}`);
                }
            }
            
            // Step 7: Create ExternalMedia for READ direction
            const rtpHost = this.RTP_BIANCA_HOST;
            const rtpIp = await this.resolveHostnameToIP(rtpHost);
            const rtpDest = `${rtpIp}:${parentCallData.rtpReadPort}`;
            
            logger.info(`[ARI] Creating ExternalMedia on snoop ${channelId} for RTP to ${rtpDest} (READ)`);
            
            const rtpChannel = await channel.externalMedia({
                app: CONFIG.STASIS_APP_NAME,
                external_host: rtpDest,
                format: CONFIG.RTP_SEND_FORMAT,
                direction: 'read'
            });
            
            logger.info(`[ARI] ExternalMedia READ created: ${rtpChannel.id} (${rtpChannel.name})`);
            
            // Step 8: Create ExternalMedia for WRITE direction
            // Use port 0 to let Asterisk allocate a port
            const rtpWriteDest = `${rtpIp}:0`;
            
            logger.info(`[ARI] Creating ExternalMedia on snoop ${channelId} for RTP WRITE`);
            
            const rtpWriteChannel = await channel.externalMedia({
                app: CONFIG.STASIS_APP_NAME,
                external_host: rtpWriteDest,
                format: CONFIG.RTP_SEND_FORMAT,
                direction: 'write'
            });
            
            logger.info(`[ARI] ExternalMedia WRITE created: ${rtpWriteChannel.id} (${rtpWriteChannel.name})`);
            
        } catch (err) {
            logger.error(`[ARI] Failed to setup snoop channel: ${err.message}`, err);
            await this.cleanupChannel(parentChannelId, `Snoop setup failed`);
        }
    }

    // And simplify the playback handler to NOT create ExternalMedia:
async handleStasisStartForPlayback(channel, channelName, event) {
    const channelId = channel.id;
    const isLeg2 = channelName.includes(';2');

    if (!isLeg2) {
        logger.info(`[ARI] Ignoring playback leg 1: ${channelId}`);
        return;
    }

    logger.info(`[ARI] StasisStart for Playback channel leg 2: ${channelId}`);
    const match = channelName.match(/^Local\/playback-([^@]+)@/);
    const parentChannelId = match?.[1];
    
    if (!parentChannelId || !this.tracker.getCall(parentChannelId)) {
        logger.error(`[ARI] Parent call ${parentChannelId} not found for playback ${channelId}. Hanging up.`);
        return this.safeHangup(channel, 'Orphaned playback channel');
    }
    
    const parentCallData = this.tracker.getCall(parentChannelId);

    try {
        // Update tracking first
        this.tracker.updateCall(parentChannelId, { 
            playbackChannel: channel, 
            playbackChannelId: channelId 
        });
        
        // Answer the channel
        await channel.answer();
        logger.info(`[ARI] Answered playback channel ${channelId}`);
        
        // CRITICAL: Add to main bridge so audio can flow to the phone
        await this.client.bridges.addChannel({ 
            bridgeId: parentCallData.mainBridgeId, 
            channel: channelId 
        });
        logger.info(`[ARI] Added playback channel ${channelId} to main bridge ${parentCallData.mainBridgeId}`);

        // The WRITE ExternalMedia is created on the snoop channel, not here
        
        // Update tracking to indicate playback channel is ready
        this.tracker.updateCall(parentChannelId, { 
            playbackChannelReady: true
        });
        
    } catch (err) {
        logger.error(`[ARI] Failed to setup playback channel ${channelId}: ${err.message}`, err);
        await this.cleanupChannel(parentChannelId, `Playback setup failed: ${err.message}`);
    }
}

    // Resolve hostname to IP address to avoid DNS caching issues in Asterisk
    async resolveHostnameToIP(hostname) {
        try {
            const dns = require('dns').promises;
            const addresses = await dns.resolve4(hostname);
            if (addresses && addresses.length > 0) {
                logger.info(`[ARI] Resolved ${hostname} to IP: ${addresses[0]}`);
                return addresses[0];
            } else {
                throw new Error(`No IP addresses found for hostname: ${hostname}`);
            }
        } catch (err) {
            logger.error(`[ARI] Failed to resolve hostname ${hostname}: ${err.message}`);
            // Fallback to hostname if DNS resolution fails
            return hostname;
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
            
            const endpoint = { host: addressVar.value, port: parseInt(portVar.value) };
            logger.info(`[ARI] Got Asterisk RTP endpoint for sending: ${endpoint.host}:${endpoint.port}`);
            
            // Register this port in the port manager to prevent conflicts
            const portManager = require('./port.manager.service');
            const callData = this.findParentCallForRtpChannel(unicastRtpChannel);
            if (callData) {
                const callId = callData.twilioCallSid || callData.asteriskChannelId;
                const registered = portManager.registerExternalPort(endpoint.port, callId, {
                    asteriskChannelId: callData.asteriskChannelId,
                    twilioCallSid: callData.twilioCallSid,
                    direction: 'write',
                    source: 'asterisk'
                });
                
                if (registered) {
                    logger.info(`[ARI] Registered Asterisk port ${endpoint.port} in port manager for call ${callId}`);
                } else {
                    logger.warn(`[ARI] Failed to register Asterisk port ${endpoint.port} - may be in conflict`);
                }
            }
            
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

        // Use Twilio SID as the primary identifier
        const callId = callData.twilioCallSid || asteriskChannelId;
        logger.info(`[RTP Sender] Initializing for ${callId} to ${rtpEndpoint.host}:${rtpEndpoint.port}`);
        
        try {
            // Ensure the Asterisk port is registered in port manager
            const portManager = require('./port.manager.service');
            const registered = portManager.registerExternalPort(rtpEndpoint.port, callId, {
                asteriskChannelId,
                twilioCallSid: callData.twilioCallSid,
                direction: 'write',
                source: 'asterisk'
            });
            
            if (!registered) {
                logger.warn(`[RTP Sender] Asterisk port ${rtpEndpoint.port} already registered by another call`);
            }
            
            const rtpSenderService = require('./rtp.sender.service');
            await rtpSenderService.initializeCall(callId, {
                asteriskChannelId,
                rtpHost: rtpEndpoint.host,
                rtpPort: rtpEndpoint.port,
                format: CONFIG.RTP_SEND_FORMAT
            });
            
            logger.info(`[RTP Sender] Successfully initialized for ${callId}`);
            
            // Set the flag and check for pipeline completion
            this.tracker.updateCall(asteriskChannelId, { isWriteStreamReady: true });
            logger.info(`[ARI Pipeline] WRITE stream is now ready for ${asteriskChannelId}.`);
            this.checkMediaPipelineReady(asteriskChannelId);

        } catch (err) {
            logger.error(`[RTP Sender] Failed to initialize: ${err.message}`, err);
            this.updateCallState(asteriskChannelId, 'failed');
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

        // Use Twilio SID as primary identifier for RTP sender
        const callId = callData.twilioCallSid || asteriskChannelId;
        
        try {
            const rtpSenderService = require('./rtp.sender.service');
            rtpSenderService.sendAudio(callId, audioBase64Ulaw);
        } catch (err) {
            logger.error(`[ARI Audio] Error sending audio: ${err.message}`, err);
        }
    }

    async cleanupChannel(asteriskChannelId, reason = "Unknown") {
        logger.info(`[Cleanup] Starting cleanup for ${asteriskChannelId}. Reason: ${reason}`);
        
        // Abort any ongoing operations for this channel
        this.resourceManager.abortOperations(asteriskChannelId);
        
        // Get all resources associated with this call
        const resources = this.tracker.getResources(asteriskChannelId);
        if (!resources) {
            logger.warn(`[Cleanup] No resources found for ${asteriskChannelId}, already cleaned up.`);
            return { success: true, errors: [] };
        }
        
        // Track cleanup errors but continue with other cleanup steps
        const cleanupErrors = [];
        
        try {
            // Step 1: Stop any active recordings
            if (resources.recordingName) {
                try {
                    await this.client.recordings.stop({ recordingName: resources.recordingName });
                    logger.info(`[Cleanup] Stopped recording ${resources.recordingName}`);
                } catch (err) {
                    if (!err.message?.includes('404')) {
                        logger.warn(`[Cleanup] Error stopping recording: ${err.message}`);
                        cleanupErrors.push(`Recording stop: ${err.message}`);
                    }
                }
            }
            
            // Step 2: Cleanup all channels in order (auxiliary first, then main)
            const channelsToCleanup = [
                { channel: resources.snoopChannel, channelId: resources.snoopChannelId, type: 'Snoop' },
                { channel: resources.playbackChannel, channelId: resources.playbackChannelId, type: 'Playback' },
                { channel: resources.localChannel, channelId: resources.localChannelId, type: 'Local' },
                { channel: resources.inboundRtpChannel, channelId: resources.inboundRtpChannelId, type: 'InboundRTP' },
                { channel: resources.outboundRtpChannel, channelId: resources.outboundRtpChannelId, type: 'OutboundRTP' },
                { channel: resources.unicastRtpChannel, channelId: resources.unicastRtpChannelId, type: 'UnicastRTP' },
                { channel: resources.mainChannel, channelId: asteriskChannelId, type: 'Main' }
            ];
            
            for (const { channel, channelId, type } of channelsToCleanup) {
                if (channel || channelId) {
                    try {
                        await this.safeHangup(channel || { id: channelId, hangup: async () => { 
                            await this.client.channels.hangup({ channelId }); 
                        }}, type);
                        logger.info(`[Cleanup] Hung up ${type} channel ${channelId || channel?.id}`);
                    } catch (err) {
                        if (!err.message?.includes('404')) {
                            cleanupErrors.push(`${type} channel hangup: ${err.message}`);
                        }
                    }
                }
            }
            
            // Step 3: Cleanup bridges
            const bridgesToCleanup = [
                { bridge: resources.snoopBridge, bridgeId: resources.snoopBridgeId, type: 'Snoop' },
                { bridge: resources.mainBridge, bridgeId: resources.mainBridgeId, type: 'Main' }
            ];
            
            for (const { bridge, bridgeId, type } of bridgesToCleanup) {
                if (bridge || bridgeId) {
                    try {
                        await this.safeDestroy(bridge || { id: bridgeId, destroy: async () => {
                            await this.client.bridges.destroy({ bridgeId });
                        }}, type);
                        logger.info(`[Cleanup] Destroyed ${type} bridge ${bridgeId || bridge?.id}`);
                    } catch (err) {
                        if (!err.message?.includes('404')) {
                            cleanupErrors.push(`${type} bridge destroy: ${err.message}`);
                        }
                    }
                }
            }
            
            // Step 4: Use centralized cleanup in tracker (handles RTP, OpenAI, ports, etc.)
            const trackerCleanupResult = await this.tracker.cleanupCall(asteriskChannelId, reason);
            
            // Combine errors
            const allErrors = [...cleanupErrors, ...trackerCleanupResult.errors];
            
            // Log summary
            if (allErrors.length > 0) {
                logger.warn(`[Cleanup] Completed with ${allErrors.length} errors for ${asteriskChannelId}: ${allErrors.join(', ')}`);
            } else {
                logger.info(`[Cleanup] Successfully completed all cleanup for ${asteriskChannelId}`);
            }
            
            return {
                success: allErrors.length === 0,
                errors: allErrors
            };
            
        } catch (err) {
            logger.error(`[Cleanup] Unexpected error during cleanup for ${asteriskChannelId}: ${err.message}`, err);
            
            // Even on error, try to use centralized cleanup
            try {
                const trackerCleanupResult = await this.tracker.cleanupCall(asteriskChannelId, `${reason} (emergency)`);
                return {
                    success: false,
                    errors: [`Unexpected error: ${err.message}`, ...trackerCleanupResult.errors]
                };
            } catch (trackerErr) {
                logger.error(`[Cleanup] Failed to use centralized cleanup: ${trackerErr.message}`);
                return {
                    success: false,
                    errors: [`Unexpected error: ${err.message}`, `Centralized cleanup failed: ${trackerErr.message}`]
                };
            }
        }
    }

    async shutdown() {
        logger.info('[ARI] Initiating graceful shutdown...');
        this.isShuttingDown = true;
        
        try {
            const activeCalls = Array.from(this.tracker.calls.keys());
            logger.info(`[ARI] Cleaning up ${activeCalls.length} active calls`);
            
            await Promise.allSettled(
                activeCalls.map(callId => 
                    this.cleanupChannel(callId, 'System shutdown')
                )
            );
            
            try {
                const rtpSenderService = require('./rtp.sender.service');
                rtpSenderService.cleanupAll();
            } catch (err) {
                logger.warn(`[ARI] Error cleaning up RTP sender: ${err.message}`);
            }
            
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            // Ensure channel tracker is properly shut down (this will release all remaining ports)
            await this.tracker.shutdown();
            
            // Log port manager final stats
            const portStats = portManager.getStats();
            logger.info(`[ARI] Port Manager final stats:`, portStats);
            
            if (this.client) {
                this.client.removeAllListeners();
                this.client = null;
                logger.info('[ARI] Client closed');
            }
            
            this.cleanup();
            this.isConnected = false;
            
            if (typeof global !== 'undefined') {
                global.ariClient = null;
            }
            
            logger.info('[ARI] Graceful shutdown completed');
            
        } catch (err) {
            logger.error(`[ARI] Error during shutdown: ${err.message}`, err);
            throw err;
        }
    }

    // DEPRECATED: Use centralized cleanup in channel tracker instead
    async cleanupExternalServices(primarySid, resources) {
        logger.warn(`[Cleanup] cleanupExternalServices is deprecated - use centralized cleanup instead`);
        // This method is kept for backward compatibility but cleanup is now handled by channel tracker
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
            await channel.get(); 
            await withTimeout(channel.hangup(), 5000, `${type} channel hangup`);
            logger.info(`[Cleanup] Hung up ${type} channel ${channel.id}`);
        } catch (err) {
            if (!err.message?.includes('404')) {
                logger.warn(`[Cleanup] Error hanging up ${type} channel ${channel.id}: ${err.message}`);
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
            logger.warn(`[State] No call data found for ${channelId} to update state`);
            return;
        }

        const oldState = callData.state;
        // You can re-introduce stricter validation here if needed
        // if (!VALID_STATE_TRANSITIONS[oldState]?.includes(newState)) { ... }
        this.tracker.updateCall(channelId, { state: newState });
        logger.info(`[State] ${channelId}: ${oldState} → ${newState}`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Additional helper method for port-related operations
    getAllocatedPortsForCall(asteriskChannelId) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) return { readPort: null, writePort: null };
        
        return {
            readPort: callData.rtpReadPort,
            writePort: null // No write port - will use Asterisk's RTP endpoint
        };
    }

    // Add method to force-fix the bridge membership
    async fixBridgeMembership(asteriskChannelId) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) {
            logger.error('[Bridge Fix] No call data found');
            return false;
        }
        
        logger.info('[Bridge Fix] Checking and fixing bridge membership for ' + asteriskChannelId);
        
        try {
            // Check if we have both bridges and the inbound RTP channel
            if (!callData.mainBridgeId || !callData.snoopBridgeId || !callData.inboundRtpChannelId) {
                logger.warn('[Bridge Fix] Missing required components:', {
                    mainBridge: !!callData.mainBridgeId,
                    snoopBridge: !!callData.snoopBridgeId,
                    inboundRtp: !!callData.inboundRtpChannelId
                });
                return false;
            }
            
            // Get current bridge memberships
            const [mainBridge, snoopBridge] = await Promise.all([
                this.client.bridges.get({ bridgeId: callData.mainBridgeId }),
                this.client.bridges.get({ bridgeId: callData.snoopBridgeId })
            ]);
            
            // Check if inbound RTP is in the wrong bridge
            if (mainBridge.channels.includes(callData.inboundRtpChannelId)) {
                logger.info('[Bridge Fix] Found inbound RTP channel in MAIN bridge - moving to SNOOP bridge');
                
                // Remove from main bridge
                await this.client.bridges.removeChannel({
                    bridgeId: callData.mainBridgeId,
                    channel: callData.inboundRtpChannelId
                });
                logger.info('[Bridge Fix] Removed inbound RTP from main bridge');
                
                // Add to snoop bridge
                await this.client.bridges.addChannel({
                    bridgeId: callData.snoopBridgeId,
                    channel: callData.inboundRtpChannelId
                });
                logger.info('[Bridge Fix] Added inbound RTP to snoop bridge');
                
                // Clear any pending move flags
                this.tracker.updateCall(asteriskChannelId, {
                    pendingInboundRtpChannelMove: false,
                    inboundRtpChannelNeedsMove: null
                });
                
                return true;
            } else if (snoopBridge.channels.includes(callData.inboundRtpChannelId)) {
                logger.info('[Bridge Fix] Inbound RTP channel already in correct bridge (snoop)');
                return true;
            } else {
                logger.error('[Bridge Fix] Inbound RTP channel not found in any bridge!');
                return false;
            }
            
        } catch (err) {
            logger.error('[Bridge Fix] Error fixing bridge membership:', err.message);
            return false;
        }
    }

    // Add a diagnostic method to verify audio flow after setup
    async verifyAudioFlow(asteriskChannelId) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) {
            logger.error('[Audio Flow] No call data found');
            return;
        }
        
        logger.info('[Audio Flow] ===== VERIFYING AUDIO FLOW =====');
        
        // Expected flow for USER -> OPENAI:
        // 1. Main channel (phone) -> Main bridge
        // 2. Snoop channel (spying on main) -> Snoop bridge
        // 3. Inbound RTP channel -> Snoop bridge (CRITICAL!)
        // 4. RTP packets flow to your listener
        
        logger.info('[Audio Flow] USER -> OPENAI Path:');
        logger.info('[Audio Flow] 1. Phone audio enters main channel:', !!callData.mainChannel);
        logger.info('[Audio Flow] 2. Snoop channel spying on main:', !!callData.snoopChannel);
        logger.info('[Audio Flow] 3. Inbound RTP in snoop bridge:', !!callData.inboundRtpChannelId);
        logger.info('[Audio Flow] 4. RTP listener active:', !!callData.rtpReadPort);
        
        // Expected flow for OPENAI -> USER:
        // 1. OpenAI sends to RTP sender
        // 2. RTP sender sends to Asterisk RTP endpoint
        // 3. Outbound RTP channel -> Main bridge
        // 4. Main bridge -> Phone
        
        logger.info('[Audio Flow] OPENAI -> USER Path:');
        logger.info('[Audio Flow] 1. RTP sender initialized:', !!callData.asteriskRtpEndpoint);
        logger.info('[Audio Flow] 2. Outbound RTP channel:', !!callData.outboundRtpChannelId);
        logger.info('[Audio Flow] 3. Playback channel in main bridge:', !!callData.playbackChannelId);
        logger.info('[Audio Flow] 4. Main channel connected:', !!callData.mainChannel);
        
        // Verify bridge membership
        if (callData.mainBridgeId && callData.snoopBridgeId) {
            try {
                const [mainBridge, snoopBridge] = await Promise.all([
                    this.client.bridges.get({ bridgeId: callData.mainBridgeId }),
                    this.client.bridges.get({ bridgeId: callData.snoopBridgeId })
                ]);
                
                logger.info('[Audio Flow] Main Bridge Members:', mainBridge.channels);
                logger.info('[Audio Flow] Snoop Bridge Members:', snoopBridge.channels);
                
                // Check critical memberships
                const inboundInSnoop = callData.inboundRtpChannelId && 
                                      snoopBridge.channels.includes(callData.inboundRtpChannelId);
                const outboundInMain = callData.outboundRtpChannelId && 
                                      mainBridge.channels.includes(callData.outboundRtpChannelId);
                
                if (!inboundInSnoop) {
                    logger.error('[Audio Flow] CRITICAL: Inbound RTP channel NOT in snoop bridge!');
                }
                if (!outboundInMain) {
                    logger.error('[Audio Flow] CRITICAL: Outbound RTP channel NOT in main bridge!');
                }
                
                logger.info('[Audio Flow] Bridge membership correct:', {
                    inboundInSnoop,
                    outboundInMain
                });
                
            } catch (err) {
                logger.error('[Audio Flow] Error checking bridges:', err.message);
            }
        }
        
        logger.info('[Audio Flow] =================================');
    }

    async verifyBridgeConnections(asteriskChannelId) {
        const callData = this.tracker.getCall(asteriskChannelId);
        if (!callData) {
            logger.error('[Bridge Verify] No call data found');
            return;
        }
        
        logger.info('[Bridge Verify] ===== BRIDGE CONNECTION VERIFICATION =====');
        
        try {
            // Check main bridge
            if (callData.mainBridgeId) {
                const mainBridge = await this.client.bridges.get({ bridgeId: callData.mainBridgeId });
                logger.info('[Bridge Verify] Main Bridge:', {
                    id: mainBridge.id,
                    channels: mainBridge.channels,
                    channelCount: mainBridge.channels.length,
                    technology: mainBridge.technology,
                    bridgeType: mainBridge.bridge_type
                });
                
                // Verify expected channels
                const hasMainChannel = mainBridge.channels.includes(asteriskChannelId);
                const hasPlaybackChannel = callData.playbackChannelId && mainBridge.channels.includes(callData.playbackChannelId);
                const hasOutboundRtp = callData.outboundRtpChannelId && mainBridge.channels.includes(callData.outboundRtpChannelId);
                
                logger.info('[Bridge Verify] Main Bridge Channel Status:', {
                    hasMainChannel,
                    hasPlaybackChannel,
                    hasOutboundRtp,
                    expectedChannels: [asteriskChannelId, callData.playbackChannelId, callData.outboundRtpChannelId].filter(Boolean),
                    actualChannels: mainBridge.channels
                });
            }
            
            // Check snoop bridge
            if (callData.snoopBridgeId) {
                const snoopBridge = await this.client.bridges.get({ bridgeId: callData.snoopBridgeId });
                logger.info('[Bridge Verify] Snoop Bridge:', {
                    id: snoopBridge.id,
                    channels: snoopBridge.channels,
                    channelCount: snoopBridge.channels.length,
                    technology: snoopBridge.technology,
                    bridgeType: snoopBridge.bridge_type
                });
                
                // Verify expected channels
                const hasSnoopChannel = callData.snoopChannelId && snoopBridge.channels.includes(callData.snoopChannelId);
                const hasInboundRtp = callData.inboundRtpChannelId && snoopBridge.channels.includes(callData.inboundRtpChannelId);
                
                logger.info('[Bridge Verify] Snoop Bridge Channel Status:', {
                    hasSnoopChannel,
                    hasInboundRtp,
                    expectedChannels: [callData.snoopChannelId, callData.inboundRtpChannelId].filter(Boolean),
                    actualChannels: snoopBridge.channels
                });
            }
            
        } catch (err) {
            logger.error('[Bridge Verify] Error verifying bridges:', err.message);
        }
        
        logger.info('[Bridge Verify] =========================================');
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
        // This handler becomes much simpler or can be removed entirely
        // since we no longer need SSRC mapping
        logger.info(`[ARI] RTP started on ${channel.id}`);
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
        
        let mainBridge = null;

        try {
            // Step 1: Allocate only READ port for receiving audio from Asterisk
            const { readPort, writePort } = this.tracker.allocatePortsForCall(asteriskChannelId);
            
            if (!readPort) {
                throw new Error('Failed to allocate RTP read port for media pipeline');
            }
            
            logger.info(`[ARI Pipeline] Allocated read port - READ: ${readPort} (write will use Asterisk's RTP endpoint)`);

            // Step 2: Start RTP listener for receiving audio from Asterisk
            const rtpListenerService = require('./rtp.listener.service');
            
            // Listener for READ (from Asterisk)
            await rtpListenerService.startRtpListenerForCall(
                readPort,
                twilioCallSid || asteriskChannelId,
                asteriskChannelId
            );

            // Step 3: Update call tracking - ports are already set by allocatePortsForCall
            this.tracker.updateCall(asteriskChannelId, {
                state: 'setting_up_media'
            });

            // Step 4: Get call type from SIP parameters or default to inbound
            const callType = this.extractCallTypeFromChannel(channel) || 'inbound';

            const conversationService = require('./conversation.service');
            const enhancedPrompt = await conversationService.buildEnhancedPrompt(patientId, callType);
            
            logger.info(`[ARI Pipeline] Built enhanced prompt for patient ${patientId} (${callType} call)`);

            
            // Step 4: Create conversation record in database
            const dbConversationId = await this.createConversationRecord(twilioCallSid, asteriskChannelId, patientId, callType);

            // Step 5: Initialize OpenAI service for this call
            await openAIService.initialize(asteriskChannelId, twilioCallSid, dbConversationId, enhancedPrompt);

            // Step 6: Create the main bridge for mixing audio
            mainBridge = await this.client.bridges.create({
                type: 'mixing',
                name: `call-${asteriskChannelId}`
            });
            
            this.tracker.updateCall(asteriskChannelId, {
                mainBridge: mainBridge,
                mainBridgeId: mainBridge.id,
                conversationId: dbConversationId,
                callType: callType // Store call type for later use
            });
            
            logger.info(`[ARI Pipeline] Created main bridge ${mainBridge.id}`);

            // Step 7: Add the main channel to the bridge
            await this.client.bridges.addChannel({
                bridgeId: mainBridge.id,
                channel: asteriskChannelId
            });
            
            logger.info(`[ARI Pipeline] Added main channel to bridge`);

            // Step 8: Start recording on the bridge
            await this.startRecording(mainBridge, asteriskChannelId);

            // Step 9: Setup OpenAI callback handlers
            this.setupOpenAICallback();

            // Step 10: Update state to indicate we're ready for media channels
            this.updateCallState(asteriskChannelId, 'pending_media');

            // Step 11: Initiate the creation of snoop and playback channels
            await this.initiateSnoopForExternalMedia(asteriskChannelId);
            
            logger.info(`[ARI Pipeline] Media pipeline setup completed for ${asteriskChannelId}`);
            
            // Return success indicators
            return {
                success: true,
                asteriskChannelId,
                twilioCallSid,
                readPort,
                writePort: null, // No write port - will use Asterisk's RTP endpoint
                bridgeId: mainBridge.id,
                conversationId: dbConversationId
            };

        } catch (err) {
            logger.error(`[ARI Pipeline] Error in setupMediaPipeline for ${asteriskChannelId}: ${err.message}`, err);
            
            // Update state to failed
            this.updateCallState(asteriskChannelId, 'failed');
            
            // Cleanup on error - the tracker will handle port release
            try {
                const rtpListenerService = require('./rtp.listener.service');
                rtpListenerService.stopRtpListenerForCall(twilioCallSid || asteriskChannelId);
            } catch (cleanupErr) {
                logger.error(`[ARI Pipeline] Error stopping RTP listeners during cleanup: ${cleanupErr.message}`);
            }
            
            if (mainBridge?.id) {
                await this.safeDestroy(mainBridge, 'Main bridge cleanup after error');
            }
            
            throw err;
        }
    }

    extractCallTypeFromChannel(channel) {
        try {
            // Try to get call type from channel variables or SIP headers
            const channelVars = channel.channelvars || {};
            
            // Check for call type in various possible locations
            if (channelVars.callType) return channelVars.callType;
            if (channelVars.CALL_TYPE) return channelVars.CALL_TYPE;
            
            // Parse from channel name if it contains parameters
            const channelName = channel.name || '';
            if (channelName.includes('wellness-check')) return 'wellness-check';
            
            // Default for inbound calls
            return 'inbound';
        } catch (err) {
            logger.warn(`[ARI Pipeline] Could not extract call type: ${err.message}`);
            return 'inbound';
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
            callType: 'inbound',
            status: 'in-progress',
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
                    case 'openai_api_error':
                        this.handleOpenAIApiError(callbackId, data);
                        break;
                    case 'openai_message_processing_error':
                        this.handleOpenAIMessageProcessingError(callbackId, data);
                        break;
                    case 'speech_started':
                        logger.debug(`[ARI] Speech started for ${callbackId}`);
                        break;
                    case 'speech_stopped':
                        logger.debug(`[ARI] Speech stopped for ${callbackId}`);
                        break;
                    case 'openai_text_delta':
                        logger.debug(`[ARI] Text delta for ${callbackId}: ${data.text}`);
                        break;
                    case 'response_done':
                        logger.debug(`[ARI] Response done for ${callbackId}`);
                        break;
                    default:
                        logger.warn(`[ARI] Unknown OpenAI callback type: ${type}`);
                }
            } catch (err) {
                logger.error(`[ARI] Error in OpenAI callback: ${err.message}`, err);
            }
        });
    }

    handleOpenAIAudio(callId, data) {
        if (!data?.audio) {
            logger.warn(`[ARI] Received empty audio for ${callId}`);
            return;
        }

        // ADD THIS DEBUG LOG
        if (!this.openAiAudioCount) this.openAiAudioCount = {};
        if (!this.openAiAudioCount[callId]) this.openAiAudioCount[callId] = 0;
        this.openAiAudioCount[callId]++;
        
        // Log more frequently - every chunk for first 20, then every 10
        if (this.openAiAudioCount[callId] <= 20 || this.openAiAudioCount[callId] % 10 === 0) {
            logger.info(`[ARI] Received audio chunk #${this.openAiAudioCount[callId]} from OpenAI for ${callId} (size: ${data.audio.length})`);
        }

        // The callId here is already the Twilio SID
        // Find the call data using the Twilio SID
        const callData = this.tracker.findCallByTwilioCallSid(callId);
        
        if (callData) {
            logger.debug(`[ARI] Sending audio to RTP sender for asterisk channel ${callData.asteriskChannelId}`);
            this.sendAudioToChannel(callData.asteriskChannelId, data.audio);
        } else {
            // Check if it's an Asterisk ID (backward compatibility)
            const directCallData = this.tracker.getCall(callId);
            if (directCallData) {
                logger.debug(`[ARI] Sending audio to RTP sender for direct channel ${callId}`);
                this.sendAudioToChannel(callId, data.audio);
            } else {
                logger.warn(`[ARI] Received audio for unknown call ID: ${callId}`);
            }
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

    handleOpenAIApiError(callbackId, data) {
        const callData = this.findCallData(callbackId);
        const errorCode = data?.code || 'UNKNOWN_CODE';
        const errorMessage = data?.message || 'Unknown error';
        
        logger.error(`[ARI] OpenAI API error for ${callbackId}: ${errorCode} - ${errorMessage}`);
        
        if (callData) {
            logger.error(`[ARI] OpenAI API error for channel ${callData.asteriskChannelId}: ${errorCode} - ${errorMessage}`);
            
            // Handle specific error types
            if (errorCode === 'input_audio_buffer_commit_empty') {
                logger.warn(`[ARI] Buffer too small error for ${callData.asteriskChannelId} - this should be handled by validation now`);
                
                // Log additional diagnostic information
                const openAIService = require('./openai.realtime.service');
                const openaiInstance = openAIService.getOpenAIServiceInstance();
                const conn = openaiInstance.connections.get(callbackId);
                
                if (conn) {
                    logger.warn(`[ARI] Diagnostic info for ${callData.asteriskChannelId}:`, {
                        audioChunksReceived: conn.audioChunksReceived || 0,
                        audioChunksSent: conn.audioChunksSent || 0,
                        validAudioChunksSent: conn.validAudioChunksSent || 0,
                        pendingCommit: conn.pendingCommit || false,
                        sessionReady: conn.sessionReady || false
                    });
                }
                
                // Don't cleanup the call for this error - let the validation fixes handle it
            } else if (errorCode === 'conversation_already_has_active_response') {
                logger.warn(`[ARI] Conversation already has active response for ${callData.asteriskChannelId} - this is usually harmless`);
                // Don't cleanup for this error either
            } else if (errorCode === 'session_not_found' || errorCode === 'session_expired_error') {
                logger.error(`[ARI] Session error for ${callData.asteriskChannelId} - OpenAI will handle reconnection`);
                // OpenAI service will handle reconnection automatically
            } else {
                logger.error(`[ARI] Unhandled OpenAI API error for ${callData.asteriskChannelId}: ${errorCode} - ${errorMessage}`);
                // For other errors, we might want to take action
            }
        }
    }

    handleOpenAIMessageProcessingError(callbackId, data) {
        const callData = this.findCallData(callbackId);
        const messageType = data?.messageType || 'unknown';
        const error = data?.error || 'Unknown error';
        
        logger.error(`[ARI] OpenAI message processing error for ${callbackId}: ${messageType} - ${error}`);
        
        if (callData) {
            logger.error(`[ARI] OpenAI message processing error for channel ${callData.asteriskChannelId}: ${messageType} - ${error}`);
        }
    }

    findCallData(callbackId) {
        let callData = this.tracker.getCall(callbackId);
        if (!callData) {
            callData = this.tracker.findCallByTwilioCallSid(callbackId);
        }
        return callData;
    }

    // --- REFACTOR 7: Greatly simplify this function to only create resources ---
    async initiateSnoopForExternalMedia(asteriskChannelId) {
        logger.info(`[ExternalMedia Setup] Starting resource creation for main channel: ${asteriskChannelId}`);
        
        try {
            const snoopId = `snoop-extmedia-${uuidv4()}`;
            this.tracker.updateCall(asteriskChannelId, {
                pendingSnoopId: snoopId,
                expectingRtpChannels: true,
            });
            
            // Fire and forget the creation commands. The event handlers will take over.
            this.client.channels.snoopChannel({
                channelId: asteriskChannelId,
                snoopId: snoopId,
                spy: 'in',
                app: CONFIG.STASIS_APP_NAME
            }).catch(err => logger.error(`[ARI] Snoop channel creation failed to initiate for ${asteriskChannelId}: ${err.message}`));

            this.client.channels.originate({
                endpoint: `Local/playback-${asteriskChannelId}@playback-context`,
                app: CONFIG.STASIS_APP_NAME,
                appArgs: `playback-for-${asteriskChannelId}`,
                callerId: 'OpenAI <openai>'
            }).catch(err => logger.error(`[ARI] Playback channel creation failed to initiate for ${asteriskChannelId}: ${err.message}`));

        } catch (err) {
            logger.error(`[ExternalMedia Setup] Failed for ${asteriskChannelId}: ${err.message}`, err);
            this.updateCallState(asteriskChannelId, 'failed');
            throw err;
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
    CONFIG
};