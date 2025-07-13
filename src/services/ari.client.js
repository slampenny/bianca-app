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
// These states represent the major milestones of the call, not every single step.
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

// --- REFACTOR 2: StateValidator class is no longer needed for this simpler model ---
// class StateValidator { ... } // Removed

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
        // this.RTP_BIANCA_RECEIVE_PORT = config.asterisk.rtpBiancaReceivePort;
        // this.RTP_BIANCA_SEND_PORT = config.asterisk.rtpBiancaSendPort || (config.asterisk.rtpBiancaReceivePort + 1);

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
            
            // Trigger the initial greeting from the AI
            const primarySid = callData.twilioCallSid || asteriskChannelId;
            
            logger.info(`[ARI Pipeline] Triggering initial AI greeting for ${primarySid}`);
            
            // Delay the greeting slightly to ensure OpenAI connection is ready
            setTimeout(() => {
                // Check if OpenAI is ready before sending
                if (openAIService.isConnectionReady(primarySid)) {
                    openAIService.sendResponseCreate(primarySid);
                } else {
                    logger.info(`[ARI Pipeline] OpenAI not ready yet, sending silence to trigger connection`);
                    // Send silence to ensure the connection is active
                    const silenceBase64 = Buffer.alloc(160, 0xFF).toString('base64'); // 20ms of μ-law silence
                    openAIService.sendAudioChunk(primarySid, silenceBase64);
                    
                    // Try greeting again after a short delay
                    setTimeout(() => {
                        openAIService.sendResponseCreate(primarySid);
                    }, 500);
                }
            }, 100);
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
        logger.info(`[ARI] Using ARI URL: ${ariUrl}`);
        logger.info(`[ARI] Using username: ${username}`);
        
        // First, let's test basic network connectivity
        try {
            const urlObj = new URL(ariUrl);
            logger.info(`[ARI] Testing basic connectivity to ${urlObj.hostname}:${urlObj.port || 80}`);
            
            // Try a simple TCP connection test
            const net = require('net');
            const testConnection = () => {
                return new Promise((resolve, reject) => {
                    const socket = new net.Socket();
                    const timeout = setTimeout(() => {
                        socket.destroy();
                        reject(new Error('Connection timeout'));
                    }, 5000);
                    
                    socket.on('connect', () => {
                        clearTimeout(timeout);
                        socket.destroy();
                        resolve(true);
                    });
                    
                    socket.on('error', (err) => {
                        clearTimeout(timeout);
                        reject(err);
                    });
                    
                    socket.connect(parseInt(urlObj.port || 80), urlObj.hostname);
                });
            };
            
            await testConnection();
            logger.info(`[ARI] Basic network connectivity to ${urlObj.hostname}:${urlObj.port || 80} is working`);
        } catch (err) {
            logger.error(`[ARI] Network connectivity test failed: ${err.message}`);
            logger.error(`[ARI] This suggests a network or firewall issue`);
        }
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Try to fetch the swagger documentation
                const testUrl = `${ariUrl}/ari/api-docs/resources.json`;
                logger.debug(`[ARI] Attempting to fetch: ${testUrl}`);
                
                const response = await withTimeout(
                    fetch(testUrl, {
                        headers: {
                            'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
                        }
                    }),
                    10000,
                    'ARI readiness check'
                );
                
                if (response.ok) {
                    logger.info(`[ARI] Asterisk is ready (attempt ${attempt}/${maxAttempts})`);
                    return true;
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            } catch (err) {
                // More detailed error logging
                if (err.code === 'ENOTFOUND') {
                    logger.warn(`[ARI] DNS resolution failed (attempt ${attempt}/${maxAttempts}): ${err.message}`);
                } else if (err.code === 'ECONNREFUSED') {
                    logger.warn(`[ARI] Connection refused (attempt ${attempt}/${maxAttempts}): ${err.message}`);
                } else if (err.code === 'ETIMEDOUT') {
                    logger.warn(`[ARI] Connection timeout (attempt ${attempt}/${maxAttempts}): ${err.message}`);
                } else {
                    logger.warn(`[ARI] Asterisk not ready yet (attempt ${attempt}/${maxAttempts}): ${err.message}`);
                }
                
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

    async handleStasisStartForUnicastRTP(channel) {
        logger.info(`[ARI] Processing UnicastRTP channel: ${channel.id}`);

        const parentCallData = this.findParentCallForRtpChannel(channel);
        if (!parentCallData) {
            logger.warn(`[ARI] No parent call found for RTP channel ${channel.id}. Hanging up.`);
            await this.safeHangup(channel, 'Orphaned UnicastRTP');
            return;
        }

        const { parentId, callData } = parentCallData;
        
        // This UnicastRTP channel is for the READ stream (user->app)
        if (!callData.inboundRtpChannelId) {
             await this.handleInboundRtpChannel(channel, parentId, callData);
        } 
        // This UnicastRTP channel is for the WRITE stream (app->user)
        else if (!callData.outboundRtpChannelId) {
             await this.handleOutboundRtpChannel(channel, parentId, callData);
        }
    }

    findParentCallForRtpChannel(channel) {
        const channelName = channel.name || '';
        
        // Extract port from channel name (e.g., "UnicastRTP/3.21.122.60:16384-...")
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
            return null;
        }
        
        // For outbound RTP channels that don't have a port in the name
        // Check if this is an outbound channel by looking for our app host
        if (channelName.includes(this.RTP_BIANCA_HOST)) {
            logger.info(`[ARI] Detected outbound RTP channel ${channel.id} for host ${this.RTP_BIANCA_HOST}`);
            
            // Find a call that's expecting an outbound RTP channel
            for (const [callId, data] of this.tracker.calls.entries()) {
                if (data.state === 'pending_media' && !data.outboundRtpChannelId) {
                    logger.info(`[ARI] Found parent call ${callId} expecting outbound RTP channel`);
                    return { parentId: callId, callData: data };
                }
            }
            
            logger.warn(`[ARI] No call found expecting outbound RTP channel`);
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
        
        // CRITICAL: Add the RTP channel to the snoop bridge
        if (callData.snoopBridgeId) {
            await this.client.bridges.addChannel({
                bridgeId: callData.snoopBridgeId,
                channel: channel.id
            });
            logger.info(`[ARI] Added inbound RTP channel ${channel.id} to snoop bridge ${callData.snoopBridgeId}`);
        } else {
            logger.error(`[ARI] No snoop bridge found for call ${parentId}!`);
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
            isReadStreamReady: true
        });
        
        logger.info(`[ARI Pipeline] READ stream is ready for ${parentId}`);
        
        // Verify RTP listener is active
        const rtpListenerService = require('./rtp.listener.service');
        const listenerStatus = rtpListenerService.getListenerStatus?.(callData.rtpReadPort);
        if (listenerStatus) {
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

// Also fix handleOutboundRtpChannel to properly handle the WRITE direction:

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
        
        // Add to main bridge
        if (callData.mainBridgeId) {
            await this.client.bridges.addChannel({
                bridgeId: callData.mainBridgeId,
                channel: channel.id
            });
            logger.info(`[ARI] Added outbound RTP channel ${channel.id} to main bridge`);
        }
        
        // Update tracking
        this.tracker.updateCall(parentId, { 
            outboundRtpChannel: channel,
            outboundRtpChannelId: channel.id,
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
            // Step 1: Allocate TWO unique ports for this call via the tracker
            const { readPort, writePort } = this.tracker.allocatePortsForCall(asteriskChannelId);
            
            if (!readPort || !writePort) {
                throw new Error('Failed to allocate RTP ports for media pipeline');
            }
            
            logger.info(`[ARI Pipeline] Allocated ports - READ: ${readPort}, WRITE: ${writePort}`);

            // Step 2: Start RTP listeners on BOTH ports
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
                writePort,
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
                logger.error(`[ARI Pipeline] Error stopping RTP listener during cleanup: ${cleanupErr.message}`);
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
        
        // Step 3: Create a bridge for the snoop channel - THIS IS CRITICAL!
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
        
        // Step 6: Create ExternalMedia with BOTH direction
        // IMPORTANT: When using 'read' direction, Asterisk RECEIVES RTP, not sends it
        // We need to use 'both' and let the UnicastRTP channel handle the actual sending
        const rtpHost = this.RTP_BIANCA_HOST; 
        const rtpReadDest = `${rtpHost}:${parentCallData.rtpReadPort}`;
        
        logger.info(`[ARI] Creating ExternalMedia on snoop ${channelId} for RTP to ${rtpReadDest}`);
        
        const rtpChannel = await channel.externalMedia({
            app: CONFIG.STASIS_APP_NAME,
            external_host: rtpReadDest,
            format: CONFIG.RTP_SEND_FORMAT,
            direction: 'read' // Use 'both' instead of 'read'
        });
        
        logger.info(`[ARI] ExternalMedia created: ${rtpChannel.id} (${rtpChannel.name})`);
        
        // The UnicastRTP channel will enter Stasis and we'll handle it there
        
    } catch (err) {
        logger.error(`[ARI] Failed to setup snoop channel: ${err.message}`, err);
        await this.cleanupChannel(parentChannelId, `Snoop setup failed`);
    }
}

    // --- REFACTOR 9: Simplify playback handler ---
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
            this.tracker.updateCall(parentChannelId, { playbackChannel: channel, playbackChannelId: channelId });
            await channel.answer();
            logger.info(`[ARI] Answered playback channel ${channelId}`);
            
            await this.client.bridges.addChannel({ bridgeId: parentCallData.mainBridgeId, channel: channelId });
            logger.info(`[ARI] Added playback channel ${channelId} to bridge`);

            // USE DYNAMIC PORT INSTEAD OF STATIC CONFIG
            const rtpHost = this.RTP_BIANCA_HOST;
            const rtpAsteriskSource = `${rtpHost}:${parentCallData.rtpWritePort}`;
            
            logger.info(`[ARI] Creating WRITE ExternalMedia to ${rtpAsteriskSource}`);
            
            const unicastRtpChannel = await channel.externalMedia({
                app: CONFIG.STASIS_APP_NAME,
                external_host: rtpAsteriskSource,
                format: CONFIG.RTP_SEND_FORMAT,
                direction: 'write'
            });
            
            logger.info(`[ARI] WRITE ExternalMedia requested, created channel ${unicastRtpChannel.id}`);
            const asteriskRtpEndpoint = await this.getRtpEndpoint(unicastRtpChannel);
            
            this.tracker.updateCall(parentChannelId, { asteriskRtpEndpoint, unicastRtpChannel, unicastRtpChannelId: unicastRtpChannel.id });
            await this.initializeRtpSenderWithEndpoint(parentChannelId, asteriskRtpEndpoint);
            
        } catch (err) {
            logger.error(`[ARI] Failed to start WRITE ExternalMedia on playback ${channelId}: ${err.message}`, err);
            await this.cleanupChannel(parentChannelId, `WRITE ExternalMedia setup failed: ${err.message}`);
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
            return;
        }
        
        // Determine the primary identifier for external services
        const primarySid = resources.twilioCallSid || resources.asteriskChannelId || asteriskChannelId;
        
        // Track cleanup errors but continue with other cleanup steps
        const cleanupErrors = [];
        
        try {
            // Step 1: Stop and cleanup RTP listeners (BOTH read and write)
            if (resources.rtpReadPort || resources.rtpWritePort) {
                try {
                    const rtpListenerService = require('./rtp.listener.service');
                    rtpListenerService.stopRtpListenerForCall(primarySid);
                    rtpListenerService.stopRtpListenerForCall(`${primarySid}-write`);
                    logger.info(`[Cleanup] Stopped RTP listeners for ${primarySid}`);
                } catch (err) {
                    logger.error(`[Cleanup] Error stopping RTP listeners: ${err.message}`);
                    cleanupErrors.push(`RTP listeners: ${err.message}`);
                }
            }
            
            // Step 2: Cleanup RTP sender service
            try {
                const rtpSenderService = require('./rtp.sender.service');
                rtpSenderService.cleanupCall(primarySid);
                logger.info(`[Cleanup] Cleaned up RTP sender for ${primarySid}`);
            } catch (err) {
                logger.warn(`[Cleanup] Error cleaning up RTP sender: ${err.message}`);
                cleanupErrors.push(`RTP sender: ${err.message}`);
            }
            
            // Step 3: Disconnect OpenAI service
            try {
                await openAIService.disconnect(primarySid);
                logger.info(`[Cleanup] Disconnected OpenAI service for ${primarySid}`);
            } catch (err) {
                logger.warn(`[Cleanup] Error disconnecting OpenAI: ${err.message}`);
                cleanupErrors.push(`OpenAI disconnect: ${err.message}`);
            }
            
            // Step 4: Stop any active recordings
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
            
            // Step 5: Cleanup all channels in order (auxiliary first, then main)
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
            
            // Step 6: Cleanup bridges
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
            
            // Step 7: Update conversation record in database
            if (resources.conversationId) {
                try {
                    const Conversation = require('../models').Conversation;
                    await Conversation.findByIdAndUpdate(
                        resources.conversationId,
                        {
                            status: 'completed',
                            endTime: new Date(),
                            cleanupReason: reason,
                            cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined
                        }
                    );
                    logger.info(`[Cleanup] Updated conversation record ${resources.conversationId}`);
                } catch (err) {
                    logger.error(`[Cleanup] Error updating conversation record: ${err.message}`);
                    cleanupErrors.push(`Conversation update: ${err.message}`);
                }
            }
            
            // Step 8: Remove from tracker (this will also release ports automatically)
            this.tracker.removeCall(asteriskChannelId);
            logger.info(`[Cleanup] Removed call from tracker and released ports for ${asteriskChannelId}`);
            
            // Log summary
            if (cleanupErrors.length > 0) {
                logger.warn(`[Cleanup] Completed with ${cleanupErrors.length} errors for ${asteriskChannelId}: ${cleanupErrors.join(', ')}`);
            } else {
                logger.info(`[Cleanup] Successfully completed all cleanup for ${asteriskChannelId}`);
            }
            
            return {
                success: cleanupErrors.length === 0,
                errors: cleanupErrors
            };
            
        } catch (err) {
            logger.error(`[Cleanup] Unexpected error during cleanup for ${asteriskChannelId}: ${err.message}`, err);
            // Even on error, try to remove from tracker to release ports
            try {
                this.tracker.removeCall(asteriskChannelId);
                logger.info(`[Cleanup] Emergency removal from tracker completed for ${asteriskChannelId}`);
            } catch (trackerErr) {
                logger.error(`[Cleanup] Failed to remove from tracker: ${trackerErr.message}`);
            }
            throw err;
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

    async cleanupExternalServices(primarySid, resources) {
        try {
            const rtpSenderService = require('./rtp.sender.service');
            rtpSenderService.cleanupCall(primarySid);
        } catch (err) {
            logger.warn(`[Cleanup] Error cleaning up RTP sender: ${err.message}`);
        }
        
        if (resources.rtp_ssrc) {
            try {
                rtpListenerService.removeSsrcMapping(resources.rtp_ssrc);
                logger.info(`[Cleanup] Removed SSRC mapping for ${resources.rtp_ssrc}`);
            } catch (err) {
                logger.warn(`[Cleanup] Error removing SSRC mapping: ${err.message}`);
            }
        }
        
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
            writePort: callData.rtpWritePort
        };
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
    // Removed other exports that are no longer needed
};