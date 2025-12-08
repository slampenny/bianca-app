// src/services/audio.diagnostic.service.js
// Standalone audio diagnostic service to avoid ARI client conflicts

const logger = require('../config/logger');

class AudioDiagnosticService {
    constructor() {
        this.name = 'AudioDiagnosticService';
    }

    /**
     * Comprehensive audio flow diagnostic
     */
    async diagnoseAudioFlow(asteriskChannelId) {
        try {
            // Import services dynamically to avoid circular dependencies
            const channelTracker = require('./channel.tracker');
            const { getAriClientInstance } = require('./ari.client');
            const rtpListenerService = require('./rtp.listener.service');
            const rtpSenderService = require('./rtp.sender.service');
            const openAIService = require('./openai.realtime.service');

            const callData = channelTracker.getCall(asteriskChannelId);
            if (!callData) {
                logger.error('[Audio Diagnose] No call data found for:', asteriskChannelId);
                return { error: 'No call data found', asteriskChannelId };
            }

            const ariClient = getAriClientInstance();
            const networkConfig = this.getNetworkConfig(ariClient);

            logger.info('[Audio Diagnose] ===== COMPREHENSIVE AUDIO FLOW DIAGNOSTIC =====');
            
            // 1. BASIC CALL INFORMATION
            const callInfo = {
                asteriskChannelId,
                twilioCallSid: callData.twilioCallSid,
                state: callData.state,
                isReadStreamReady: callData.isReadStreamReady,
                isWriteStreamReady: callData.isWriteStreamReady,
                duration: Math.round((Date.now() - callData.startTime) / 1000) + 's',
                startTime: new Date(callData.startTime).toISOString()
            };
            
            logger.info('[Audio Diagnose] Call Info:', callInfo);

            // 2. ASTERISK RESOURCES
            const asteriskResources = {
                mainChannel: !!callData.mainChannel,
                mainChannelId: callData.mainChannel?.id,
                mainBridge: !!callData.mainBridge,
                mainBridgeId: callData.mainBridgeId,
                
                snoopChannel: !!callData.snoopChannel,
                snoopChannelId: callData.snoopChannelId,
                snoopBridge: !!callData.snoopBridge,
                snoopBridgeId: callData.snoopBridgeId,
                
                playbackChannel: !!callData.playbackChannel,
                playbackChannelId: callData.playbackChannelId,
                
                inboundRtpChannel: !!callData.inboundRtpChannel,
                inboundRtpChannelId: callData.inboundRtpChannelId,
                outboundRtpChannel: !!callData.outboundRtpChannel,
                outboundRtpChannelId: callData.outboundRtpChannelId
            };
            
            logger.info('[Audio Diagnose] Asterisk Resources:', asteriskResources);

            // 3. RTP CONFIGURATION
            const rtpConfig = {
                rtpReadPort: callData.rtpReadPort,
                rtpWritePort: callData.rtpWritePort,
                asteriskRtpEndpoint: callData.asteriskRtpEndpoint,
                biancaHost: networkConfig.biancaHost,
                asteriskHost: networkConfig.asteriskHost
            };
            
            logger.info('[Audio Diagnose] RTP Configuration:', rtpConfig);

            // 4. RTP LISTENER STATUS (Asterisk -> OpenAI)
            let listenerStatus = null;
            try {
                listenerStatus = rtpListenerService.getListenerStatus?.(callData.rtpReadPort);
                
                if (listenerStatus?.found) {
                    logger.info('[Audio Diagnose] ✅ RTP Listener (Asterisk->OpenAI):', {
                        port: listenerStatus.port,
                        active: listenerStatus.active,
                        packetsReceived: listenerStatus.stats?.packetsReceived || 0,
                        packetsSent: listenerStatus.stats?.packetsSent || 0,
                        errors: listenerStatus.stats?.errors || 0,
                        uptime: listenerStatus.stats?.uptime ? Math.round(listenerStatus.stats.uptime / 1000) + 's' : 'unknown'
                    });
                } else {
                    logger.error('[Audio Diagnose] ❌ NO RTP LISTENER FOUND!', {
                        expectedPort: callData.rtpReadPort,
                        allListeners: rtpListenerService.getFullStatus?.()?.listeners?.map(l => l.port) || []
                    });
                }
            } catch (err) {
                logger.error('[Audio Diagnose] Error checking RTP listener:', err.message);
            }

            // 5. RTP SENDER STATUS (OpenAI -> Asterisk)
            let senderStatus = null;
            let rtpSenderIssues = [];
            
            try {
                const allSenders = rtpSenderService.getStatus();
                senderStatus = allSenders.calls?.find(c => 
                    c.callId === callData.twilioCallSid || c.callId === asteriskChannelId
                );
                
                if (senderStatus) {
                    logger.info('[Audio Diagnose] ✅ RTP Sender (OpenAI->Asterisk):', {
                        callId: senderStatus.callId,
                        target: `${senderStatus.rtpHost}:${senderStatus.rtpPort}`,
                        hasTimer: senderStatus.hasTimer,
                        bufferSize: senderStatus.bufferSize,
                        format: senderStatus.format,
                        ssrc: senderStatus.ssrc,
                        packetsSent: senderStatus.stats?.packetsSent || 0,
                        audioChunksReceived: senderStatus.debugCounters?.audioChunks || 0,
                        errors: senderStatus.stats?.errors || 0
                    });
                    
                    // CRITICAL CHECK: Is RTP sender targeting the right endpoint?
                    const expectedEndpoint = callData.asteriskRtpEndpoint;
                    if (expectedEndpoint) {
                        const isCorrectTarget = (
                            senderStatus.rtpHost === expectedEndpoint.host &&
                            senderStatus.rtpPort === expectedEndpoint.port
                        );
                        
                        if (isCorrectTarget) {
                            logger.info('[Audio Diagnose] ✅ RTP Sender targeting correct Asterisk endpoint');
                        } else {
                            const issue = '❌ RTP SENDER TARGETING WRONG ENDPOINT!';
                            logger.error(`[Audio Diagnose] ${issue}`, {
                                senderTarget: `${senderStatus.rtpHost}:${senderStatus.rtpPort}`,
                                expectedTarget: `${expectedEndpoint.host}:${expectedEndpoint.port}`,
                                mismatch: 'THIS IS LIKELY THE PROBLEM!'
                            });
                            rtpSenderIssues.push(issue);
                        }
                    } else {
                        const issue = '❌ No asteriskRtpEndpoint found in call data!';
                        logger.error(`[Audio Diagnose] ${issue}`);
                        rtpSenderIssues.push(issue);
                    }
                    
                    // Check if timer is running
                    if (!senderStatus.hasTimer) {
                        const issue = '❌ RTP Sender timer not running!';
                        logger.error(`[Audio Diagnose] ${issue}`);
                        rtpSenderIssues.push(issue);
                    }
                    
                } else {
                    const issue = '❌ NO RTP SENDER FOUND!';
                    logger.error(`[Audio Diagnose] ${issue}`, {
                        expectedCallId: callData.twilioCallSid || asteriskChannelId,
                        availableSenders: allSenders.calls?.map(c => c.callId) || []
                    });
                    rtpSenderIssues.push(issue);
                }
            } catch (err) {
                logger.error('[Audio Diagnose] Error checking RTP sender:', err.message);
                rtpSenderIssues.push(`RTP Sender check failed: ${err.message}`);
            }

            // 6. OPENAI CONNECTION STATUS
            let openAIStatus = null;
            try {
                const callId = callData.twilioCallSid || asteriskChannelId;
                const isReady = openAIService.isConnectionReady(callId);
                const connections = openAIService.connections || new Map();
                const connection = connections.get(callId);
                
                openAIStatus = {
                    isReady,
                    status: connection?.status,
                    sessionReady: connection?.sessionReady,
                    audioChunksReceived: connection?.audioChunksReceived || 0,
                    audioChunksSent: connection?.audioChunksSent || 0,
                    lastActivity: connection?.lastActivity
                };
                
                logger.info('[Audio Diagnose] OpenAI Connection:', openAIStatus);
            } catch (err) {
                logger.error('[Audio Diagnose] Error checking OpenAI:', err.message);
            }

            // 7. BRIDGE INFORMATION
            const bridgeInfo = await this.checkBridges(callData);

            // 8. ANALYZE AUDIO FLOW
            const flowAnalysis = this.analyzeAudioFlow(listenerStatus, senderStatus, openAIStatus);
            logger.info('[Audio Diagnose] Flow Analysis:', flowAnalysis);

            // 9. IDENTIFY ISSUES
            const issues = this.identifyIssues(callData, listenerStatus, senderStatus, openAIStatus, rtpSenderIssues);
            
            if (issues.length === 0) {
                logger.info('[Audio Diagnose] ✅ No obvious issues found - audio should be working!');
            } else {
                logger.error('[Audio Diagnose] 🚨 ISSUES IDENTIFIED:', issues);
            }

            logger.info('[Audio Diagnose] ==========================================');

            // Return comprehensive diagnostic data
            return {
                success: true,
                timestamp: new Date().toISOString(),
                callInfo,
                asteriskResources,
                rtpConfig,
                networkConfig,
                listenerStatus,
                senderStatus,
                openAIStatus,
                bridgeInfo,
                flowAnalysis,
                issues,
                summary: {
                    healthy: issues.length === 0,
                    issueCount: issues.length,
                    ...flowAnalysis
                }
            };

        } catch (error) {
            logger.error('[Audio Diagnose] Diagnostic failed:', error.message);
            return {
                success: false,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get network configuration safely
     */
    getNetworkConfig(ariClient) {
        try {
            return {
                biancaHost: ariClient?.RTP_BIANCA_HOST || 'unknown',
                asteriskHost: ariClient?.RTP_ASTERISK_HOST || 'unknown'
            };
        } catch (err) {
            return {
                biancaHost: 'error',
                asteriskHost: 'error'
            };
        }
    }

    /**
     * Check bridge status
     */
    async checkBridges(callData) {
        const bridgeInfo = {
            mainBridge: null,
            snoopBridge: null,
            errors: []
        };

        try {
            if (callData.mainBridge) {
                const bridgeData = await callData.mainBridge.get();
                bridgeInfo.mainBridge = {
                    id: bridgeData.id,
                    channels: bridgeData.channels || [],
                    channelCount: bridgeData.channels?.length || 0
                };
                logger.info('[Audio Diagnose] Main Bridge:', bridgeInfo.mainBridge);
            }
        } catch (err) {
            bridgeInfo.errors.push(`Main bridge error: ${err.message}`);
            logger.error('[Audio Diagnose] Error getting main bridge info:', err.message);
        }

        try {
            if (callData.snoopBridge) {
                const snoopBridgeData = await callData.snoopBridge.get();
                bridgeInfo.snoopBridge = {
                    id: snoopBridgeData.id,
                    channels: snoopBridgeData.channels || [],
                    channelCount: snoopBridgeData.channels?.length || 0
                };
                logger.info('[Audio Diagnose] Snoop Bridge:', bridgeInfo.snoopBridge);
            }
        } catch (err) {
            bridgeInfo.errors.push(`Snoop bridge error: ${err.message}`);
            logger.error('[Audio Diagnose] Error getting snoop bridge info:', err.message);
        }

        return bridgeInfo;
    }

    /**
     * Analyze audio flow status
     */
    analyzeAudioFlow(listenerStatus, senderStatus, openAIStatus) {
        const inboundFlow = listenerStatus?.found && (listenerStatus.stats?.packetsReceived || 0) > 0;
        const outboundFlow = senderStatus && (senderStatus.stats?.packetsSent || 0) > 0;
        const openAIProcessing = openAIStatus?.audioChunksReceived > 0 && openAIStatus?.audioChunksSent > 0;

        return {
            inboundFlow,
            outboundFlow,
            openAIProcessing,
            summary: {
                '📞➡️🤖': inboundFlow ? 'Working' : 'Not working',
                '🤖➡️📞': outboundFlow ? 'Working' : 'Not working',
                '🧠 OpenAI': openAIProcessing ? 'Processing' : 'Not processing'
            }
        };
    }

    /**
     * Identify specific issues
     */
    identifyIssues(callData, listenerStatus, senderStatus, openAIStatus, rtpSenderIssues) {
        const issues = [];

        // Media pipeline readiness
        if (!callData.isReadStreamReady || !callData.isWriteStreamReady) {
            issues.push('❌ Media pipeline not fully ready');
        }

        // RTP Listener issues
        if (!listenerStatus?.found) {
            issues.push('❌ RTP Listener missing - no audio from Asterisk');
        }

        // RTP Sender issues
        if (rtpSenderIssues.length > 0) {
            issues.push(...rtpSenderIssues);
        }

        // OpenAI issues
        if (!openAIStatus?.isReady) {
            issues.push('❌ OpenAI connection not ready');
        }

        // Bridge issues
        if (callData.mainBridge && (!callData.snoopBridge || !callData.playbackChannel)) {
            issues.push('❌ Bridge setup incomplete');
        }

        return issues;
    }

    /**
     * Quick status check for all calls
     */
    async getAllCallsStatus() {
        try {
            const channelTracker = require('./channel.tracker');
            const rtpListenerService = require('./rtp.listener.service');
            const rtpSenderService = require('./rtp.sender.service');
            const openAIService = require('./openai.realtime.service');

            const results = [];

            for (const [channelId, callData] of channelTracker.calls.entries()) {
                try {
                    const rtpListenerStatus = rtpListenerService.getListenerStatus(callData.rtpReadPort);
                    const rtpSenderStatus = rtpSenderService.getStatus();
                    const ourSender = rtpSenderStatus.calls?.find(c => 
                        c.callId === callData.twilioCallSid || c.callId === channelId
                    );
                    const openAIConnected = openAIService.isConnectionReady(callData.twilioCallSid || channelId);

                    results.push({
                        channelId,
                        twilioCallSid: callData.twilioCallSid,
                        state: callData.state,
                        duration: Math.round((Date.now() - callData.startTime) / 1000),
                        mediaReady: callData.isReadStreamReady && callData.isWriteStreamReady,
                        rtpListener: {
                            found: rtpListenerStatus?.found || false,
                            packetsReceived: rtpListenerStatus?.stats?.packetsReceived || 0
                        },
                        rtpSender: {
                            found: !!ourSender,
                            packetsSent: ourSender?.stats?.packetsSent || 0,
                            target: ourSender ? `${ourSender.rtpHost}:${ourSender.rtpPort}` : null,
                            hasTimer: ourSender?.hasTimer || false
                        },
                        openAI: {
                            connected: openAIConnected
                        },
                        asteriskRtpEndpoint: callData.asteriskRtpEndpoint
                    });
                } catch (err) {
                    results.push({
                        channelId,
                        error: err.message
                    });
                }
            }

            return {
                success: true,
                callStatuses: results,
                totalCalls: results.length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Export singleton instance
module.exports = new AudioDiagnosticService();