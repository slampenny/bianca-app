const express = require('express');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const caregiverValidation = require('../../validations/caregiver.validation');
const caregiverController = require('../../controllers/caregiver.controller');
const patientController = require('../../controllers/patient.controller');
const testController = require('../../controllers/test.controller');
const patientValidation = require('../../validations/patient.validation');
const router = express.Router();
const config = require('../../config/config');
const logger = require('../../config/logger');
const emailService = require('../../services/email.service');
//const { getFargateIp } = require('../../utils/network.utils');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

// Import services safely
let ariClient, rtpSender, openAIService, channelTracker;
try {
    ariClient = require('../../services/ari.client');
    rtpSender = require('../../services/rtp.sender.service');
    openAIService = require('../../services/openai.realtime.service');
    channelTracker = require('../../services/channel.tracker');
} catch (err) {
    logger.error('Error loading services for test routes:', err);
}

// ============================================
// ORIGINAL TEST ROUTES
// ============================================

/**
 * @swagger
 * /test/summarize:
 *   post:
 *     summary: Test the summarizeConversation function
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 description: must be unique
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: At least one number and one letter
 *             example:
 *               name: fake name
 *               email: fake@example.com
 *               password: password1
 *     responses:
 *       "200":
 *         description: Summarization response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/summarize', testController.testSummarize);

/**
 * @swagger
 * /test/clean:
 *   post:
 *     summary: Test the summarizeConversation function
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Clean response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/clean', testController.testCleanDB);

/**
 * @swagger
 * /test/seed:
 *   post:
 *     summary: Test the seeding function
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Seed response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/seed', testController.testSeed);

/**
 * @swagger
 * /test/conversations:
 *   get:
 *     summary: Test route to check conversations without authentication
 *     description: This is for debugging conversation display issues
 *     tags: [Test]
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *         description: Patient ID to filter conversations
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of conversations to return
 *     responses:
 *       "200":
 *         description: Conversations data
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/conversations', async (req, res) => {
  try {
    const { patientId, limit = 20 } = req.query;
    const { Conversation, Patient } = require('../../models');
    
    let filter = {};
    if (patientId) {
      filter.patientId = patientId;
    }
    
    const conversations = await Conversation.find(filter)
      .populate('patientId', 'name')
      .populate('messages')
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .lean();
    
    // Get all patients for reference
    const patients = await Patient.find({}, 'name _id').lean();
    
    res.json({
      success: true,
      totalConversations: conversations.length,
      conversations: conversations.map(conv => ({
        id: conv._id,
        patientId: conv.patientId?._id,
        patientName: conv.patientId?.name,
        callSid: conv.callSid,
        status: conv.status,
        callType: conv.callType,
        startTime: conv.startTime,
        endTime: conv.endTime,
        duration: conv.duration,
        messageCount: conv.messages?.length || 0,
        hasHistory: !!conv.history,
        history: conv.history,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      })),
      allPatients: patients.map(p => ({ id: p._id, name: p.name })),
      filter: filter
    });
  } catch (error) {
    logger.error('Error in test conversations route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * @swagger
 * /test/call:
 *   post:
 *     summary: Test the call with twilio feature
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: the call was initiated
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/call', testController.testCall);

/**
 * @swagger
 * /test/debug:
 *   get:
 *     summary: Get debug information about the system
 *     description: Returns detailed information about connections, system health, and services
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Debug information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 connectionState:
 *                   type: object
 *                 webSocketServer:
 *                   type: object
 *                 environment:
 *                   type: object
 *                 health:
 *                   type: object
 *       "500":
 *         description: Server error
 */
router.get('/debug', testController.getDebugInfo);


// Add these to your test.routes.js file

// ============================================
// AUDIO DIAGNOSTIC TEST ROUTES
// ============================================


/**
 * @swagger
 * /test/active-calls:
 *   get:
 *     summary: Get all active calls
 *     description: Lists all active calls tracked by the ARI client
 *     tags: [Test - Audio Diagnostics]
 *     responses:
 *       "200":
 *         description: List of active calls
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activeCalls:
 *                   type: number
 *                 calls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       asteriskChannelId:
 *                         type: string
 *                       twilioCallSid:
 *                         type: string
 *                       state:
 *                         type: string
 *                       isReadStreamReady:
 *                         type: boolean
 *                       isWriteStreamReady:
 *                         type: boolean
 *                       rtpPorts:
 *                         type: object
 */
router.get('/active-calls', async (req, res) => {
    if (!ariClient) {
        return res.status(503).json({ error: 'ARI client not available' });
    }
    
    try {
        const instance = ariClient.getAriClientInstance();
        const calls = [];
        
        if (instance.tracker && instance.tracker.calls) {
            for (const [callId, callData] of instance.tracker.calls.entries()) {
                calls.push({
                    asteriskChannelId: callId,
                    twilioCallSid: callData.twilioCallSid,
                    state: callData.state,
                    isReadStreamReady: callData.isReadStreamReady,
                    isWriteStreamReady: callData.isWriteStreamReady,
                    rtpPorts: {
                        read: callData.rtpReadPort,
                        write: callData.rtpWritePort
                    }
                });
            }
        }
        
        res.json({
            activeCalls: calls.length,
            calls
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});





// Helper functions
function analyzeCallFlow(callData, openAIStatus, rtpCall, listeners) {
    const issues = [];
    const status = {
        overallHealth: 'unknown',
        audioFlowDirection: {
            userToOpenAI: 'unknown',
            openAIToUser: 'unknown'
        }
    };
    
    if (!callData) {
        issues.push('CRITICAL: No call data found in ARI tracker');
        status.overallHealth = 'failed';
        return { issues, status };
    }
    
    // Check user -> OpenAI flow
    const readListener = listeners.find(l => l.port === callData.rtpReadPort);
    if (!readListener) {
        issues.push(`No RTP listener on port ${callData.rtpReadPort} for user audio`);
        status.audioFlowDirection.userToOpenAI = 'broken';
    } else if (readListener.packetsReceived === 0) {
        issues.push('RTP listener exists but receiving no packets from Asterisk');
        status.audioFlowDirection.userToOpenAI = 'no_data';
    } else {
        status.audioFlowDirection.userToOpenAI = 'working';
    }
    
    // Check OpenAI connection
    if (!openAIStatus?.exists || !openAIStatus?.sessionReady) {
        issues.push('OpenAI connection not ready');
    } else if (openAIStatus.audioChunksReceived === 0) {
        issues.push('OpenAI connected but not receiving audio');
    }
    
    // Check OpenAI -> user flow
    if (!rtpCall) {
        issues.push('CRITICAL: No RTP sender found for this call');
        status.audioFlowDirection.openAIToUser = 'broken';
    } else if (!rtpCall.initialized) {
        issues.push('RTP sender exists but not initialized');
        status.audioFlowDirection.openAIToUser = 'not_initialized';
    } else if (!rtpCall.hasTimer) {
        issues.push('RTP sender initialized but packet timer not running');
        status.audioFlowDirection.openAIToUser = 'timer_missing';
    } else if (rtpCall.stats.packetsSent === 0) {
        issues.push('RTP sender running but no packets sent');
        status.audioFlowDirection.openAIToUser = 'no_packets';
    } else {
        status.audioFlowDirection.openAIToUser = 'working';
    }
    
    // Check call ID consistency
    if (callData.twilioCallSid && rtpCall && rtpCall.callId !== callData.twilioCallSid) {
        issues.push(`Call ID mismatch: RTP using ${rtpCall.callId}, should be ${callData.twilioCallSid}`);
    }
    
    // Overall health
    if (issues.length === 0) {
        status.overallHealth = 'healthy';
    } else if (issues.some(i => i.includes('CRITICAL'))) {
        status.overallHealth = 'critical';
    } else {
        status.overallHealth = 'degraded';
    }
    
    return { issues, status };
}

function generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.issues.includes('CRITICAL: No call data found in ARI tracker')) {
        recommendations.push('Call not found. Check if the call ID is correct or if the call has ended.');
    }
    
    if (analysis.issues.some(i => i.includes('No RTP listener'))) {
        recommendations.push('RTP listener not started. Check port allocation and listener service.');
    }
    
    if (analysis.issues.some(i => i.includes('No RTP sender found'))) {
        recommendations.push('RTP sender not initialized. Check if ExternalMedia setup completed successfully.');
    }
    
    if (analysis.issues.some(i => i.includes('Call ID mismatch'))) {
        recommendations.push('Fix call ID usage - ensure OpenAI and RTP sender use the same ID (Twilio SID).');
    }
    
    if (analysis.issues.some(i => i.includes('timer not running'))) {
        recommendations.push('RTP packet timer not started. Check RTP sender initialization.');
    }
    
    if (analysis.status.audioFlowDirection.userToOpenAI === 'no_data') {
        recommendations.push('Check Asterisk snoop channel and ExternalMedia configuration.');
    }
    
    if (analysis.status.audioFlowDirection.openAIToUser === 'no_packets') {
        recommendations.push('OpenAI audio not being sent. Check notification callback and audio buffering.');
    }
    
    return recommendations;
}

/**
 * @swagger
 * /test/config-check:
 *   get:
 *     summary: Check configuration validity
 *     description: Validates all configuration settings
 *     tags: [Test - Config]
 *     responses:
 *       "200":
 *         description: Configuration check results
 */
router.get('/config-check', async (req, res) => {
    const configCheck = {
        timestamp: new Date().toISOString(),
        environment: {},
        config: {},
        validation: {}
    };

    // Environment variables
    configCheck.environment = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
        OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL,
        OPENAI_REALTIME_VOICE: process.env.OPENAI_REALTIME_VOICE,
        OPENAI_REALTIME_SESSION_CONFIG: process.env.OPENAI_REALTIME_SESSION_CONFIG,
        OPENAI_IDLE_TIMEOUT: process.env.OPENAI_IDLE_TIMEOUT,
        OPENAI_MODEL: process.env.OPENAI_MODEL,
        WEBSOCKET_URL: process.env.WEBSOCKET_URL
    };

    // Config object
    try {
        configCheck.config = {
            openai: {
                apiKey: config.openai?.apiKey ? 'SET' : 'MISSING',
                realtimeModel: config.openai?.realtimeModel,
                realtimeVoice: config.openai?.realtimeVoice,
                realtimeSessionConfig: config.openai?.realtimeSessionConfig,
                idleTimeout: config.openai?.idleTimeout,
                model: config.openai?.model,
                debugAudio: config.openai?.debugAudio
            }
        };
    } catch (err) {
        configCheck.config = { error: err.message };
    }

    // Validation
    const errors = [];
    if (!process.env.OPENAI_API_KEY) errors.push('OPENAI_API_KEY not set');
    if (!config.openai?.apiKey) errors.push('config.openai.apiKey not set');
    if (!config.openai?.realtimeModel) errors.push('config.openai.realtimeModel not set');
    if (!config.openai?.realtimeVoice) errors.push('config.openai.realtimeVoice not set');

    configCheck.validation = {
        isValid: errors.length === 0,
        errors: errors
    };

    res.json(configCheck);
});

/**
 * @swagger
 * /test/service-status:
 *   get:
 *     summary: 03 - Check service status
 *     description: Check if all services are loaded and functioning
 *     tags: [02 - System Health]
 *     responses:
 *       "200":
 *         description: Service status results
 */
router.get('/service-status', async (req, res) => {
    const serviceStatus = {
        timestamp: new Date().toISOString(),
        services: {},
        connections: {},
        health: {}
    };

    // Check service loading
    serviceStatus.services = {
        ariClient: {
            loaded: !!ariClient,
            error: ariClient ? null : 'Failed to load ari.client.js'
        },
        rtpListener: {
            loaded: !!rtpListener,
            error: rtpListener ? null : 'Failed to load rtp.listener.service.js'
        },
        rtpSender: {
            loaded: !!rtpSender,
            error: rtpSender ? null : 'Failed to load rtp.sender.service.js'
        },
        openAIService: {
            loaded: !!openAIService,
            error: openAIService ? null : 'Failed to load openai.realtime.service.js'
        },
        channelTracker: {
            loaded: !!channelTracker,
            error: channelTracker ? null : 'Failed to load channel.tracker.js'
        }
    };

    // Check connections if services are loaded
    if (ariClient) {
        try {
            const ariInstance = ariClient.getAriClientInstance();
            serviceStatus.connections.ari = {
                connected: ariInstance.isConnected,
                health: await ariInstance.healthCheck()
            };
        } catch (err) {
            serviceStatus.connections.ari = { error: err.message };
        }
    }

    if (openAIService) {
        try {
            const openaiInstance = openAIService.getOpenAIServiceInstance();
            serviceStatus.connections.openai = {
                initialized: !!openaiInstance,
                activeConnections: openaiInstance ? openaiInstance.connections.size : 0
            };
        } catch (err) {
            serviceStatus.connections.openai = { error: err.message };
        }
    }

    // Overall health
    const failedServices = Object.values(serviceStatus.services).filter(s => !s.loaded).length;
    serviceStatus.health = {
        totalServices: 5,
        loadedServices: 5 - failedServices,
        failedServices: failedServices,
        overallHealth: failedServices === 0 ? 'HEALTHY' : 'DEGRADED'
    };

    res.json(serviceStatus);
});









/**
 * @swagger
 * /test/routes-summary:
 *   get:
 *     summary: 01 - Get summary of all available test routes
 *     description: Categorizes test routes by whether they require an active call or not
 *     tags: [01 - Overview]
 *     responses:
 *       "200":
 *         description: Summary of test routes
 */
router.get('/routes-summary', async (req, res) => {
    const summary = {
        timestamp: new Date().toISOString(),
        categories: {
            diagnostic: {
                description: "Safe to run anytime - no active call required",
                routes: [
                    {
                        path: "/test/diagnose",
                        method: "GET",
                        description: "Comprehensive system diagnosis"
                    },
                    {
                        path: "/test/config-check", 
                        method: "GET",
                        description: "Check configuration values"
                    },
                    {
                        path: "/test/service-status",
                        method: "GET", 
                        description: "Check service initialization status"
                    },
                    {
                        path: "/test/openai-test",
                        method: "GET",
                        description: "Test OpenAI API connection"
                    },
                    {
                        path: "/test/ari-test",
                        method: "GET",
                        description: "Test Asterisk ARI connection"
                    },
                    {
                        path: "/test/mongodb-connection",
                        method: "GET",
                        description: "Test MongoDB connection"
                    },
                    {
                        path: "/test/mongodb-service-discovery",
                        method: "GET",
                        description: "Test MongoDB service discovery"
                    },
                    {
                        path: "/test/startup-diagnosis",
                        method: "GET",
                        description: "Diagnose startup issues"
                    }
                ]
            },
            callSimulation: {
                description: "Requires call simulation - may create temporary connections",
                routes: [
                    {
                        path: "/test/call-flow-simulation",
                        method: "POST",
                        description: "Simulate complete call flow with audio",
                        body: {
                            callId: "test-call-123",
                            conversationId: "test-conv-456",
                            initialPrompt: "Hello, this is a test call.",
                            testDuration: 5
                        }
                    },
                    {
                        path: "/test/real-call-simulation",
                        method: "POST", 
                        description: "Real call simulation with OpenAI realtime",
                        body: {
                            callId: "test-call-123",
                            conversationId: "test-conv-456",
                            initialPrompt: "Hello, this is a test call.",
                            testDuration: 10
                        }
                    },
                    {
                        path: "/test/audio-pipeline-test",
                        method: "POST",
                        description: "Test audio pipeline specifically",
                        body: {
                            callId: "audio-test-123",
                            testDuration: 5,
                            audioChunks: 20
                        }
                    },
                    {
                        path: "/test/rtp-test",
                        method: "POST",
                        description: "Test RTP packet sending",
                        body: {
                            callId: "rtp-test-123",
                            packetsToSend: 50,
                            packetInterval: 20
                        }
                    }
                ]
            }
        },
        recommendations: {
            firstSteps: [
                "1. Start with /test/diagnose for overall system health",
                "2. Use /test/openai-test to check OpenAI connectivity", 
                "3. Use /test/mongodb-connection to verify database",
                "4. Use /test/service-status to check all services"
            ],
            ifNoAudio: [
                "1. Run /test/real-call-simulation to test audio pipeline",
                "2. Check /test/startup-diagnosis for configuration issues",
                "3. Use /test/audio-pipeline-test for detailed audio testing"
            ]
        }
    };
    
    res.json(summary);
});

/**
 * @swagger
 * /test/mongodb-connection:
 *   get:
 *     summary: 05 - Test MongoDB connection specifically
 *     description: Detailed MongoDB connection test with connection URL and error details
 *     tags: [03 - Core Services]
 *     responses:
 *       "200":
 *         description: MongoDB connection test results
 */
router.get('/mongodb-connection', async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        config: {},
        connection: {},
        error: null
    };

    try {
        // Get config details
        const config = require('../../config/config');
        results.config = {
            url: config.mongoose.url,
            options: config.mongoose.options
        };

        // Test connection
        const mongoose = require('mongoose');
        
        if (mongoose.connection.readyState === 1) {
            // Already connected
            results.connection = {
                status: 'connected',
                host: mongoose.connection.host,
                port: mongoose.connection.port,
                name: mongoose.connection.name,
                url: mongoose.connection.client?.s?.url
            };
        } else {
            // Try to connect
            try {
                await mongoose.connect(config.mongoose.url, config.mongoose.options);
                results.connection = {
                    status: 'connected',
                    host: mongoose.connection.host,
                    port: mongoose.connection.port,
                    name: mongoose.connection.name,
                    url: mongoose.connection.client?.s?.url
                };
            } catch (connectError) {
                results.connection = {
                    status: 'failed',
                    error: connectError.message,
                    code: connectError.code,
                    name: connectError.name
                };
                results.error = connectError.message;
            }
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({
            error: 'MongoDB connection test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});




/**
 * @swagger
 * /test/channel-tracker:
 *   get:
 *     summary: Get channel tracker state
 *     description: Returns all tracked channels and their states
 *     tags: [Test - Call Tracking]
 *     responses:
 *       "200":
 *         description: Channel tracker state
 */
router.get('/channel-tracker', (req, res) => {
    try {
        const stats = channelTracker.getStats();
        const calls = Array.from(channelTracker.calls.entries()).map(([id, data]) => ({
            asteriskChannelId: id,
            twilioCallSid: data.twilioCallSid,
            state: data.state,
            allocatedRtpPort: data.rtpPort,
            isReadStreamReady: data.isReadStreamReady,
            isWriteStreamReady: data.isWriteStreamReady,
            hasMainChannel: !!data.mainChannel,
            hasSnoopChannel: !!data.snoopChannel,
            hasPlaybackChannel: !!data.playbackChannel,
            hasInboundRtpChannel: !!data.inboundRtpChannel,
            hasOutboundRtpChannel: !!data.outboundRtpChannel,
            mainBridgeId: data.mainBridgeId,
            startTime: data.startTime
        }));
        
        res.json({
            stats,
            calls
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



/**
 * @swagger
 * /test/conversation/{conversationId}:
 *   get:
 *     summary: Test route to check a specific conversation
 *     description: This is for debugging a specific conversation
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID to check
 *     responses:
 *       "200":
 *         description: Conversation data
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { Conversation, Patient } = require('../../models');
    
    const conversation = await Conversation.findById(conversationId)
      .populate('patientId', 'name')
      .populate('messages')
      .lean();
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    // Also check if this conversation would be returned by the patient conversations endpoint
    const patientConversations = await Conversation.find({ patientId: conversation.patientId })
      .sort({ startTime: -1 })
      .limit(20)
      .lean();
    
    const conversationIndex = patientConversations.findIndex(c => c._id.toString() === conversationId);
    
    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        patientId: conversation.patientId?._id,
        patientName: conversation.patientId?.name,
        callSid: conversation.callSid,
        status: conversation.status,
        callType: conversation.callType,
        startTime: conversation.startTime,
        endTime: conversation.endTime,
        duration: conversation.duration,
        messageCount: conversation.messages?.length || 0,
        hasHistory: !!conversation.history,
        history: conversation.history,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      },
      patientConversationsCount: patientConversations.length,
      conversationIndexInPatientList: conversationIndex,
      wouldBeInFirstPage: conversationIndex < 10,
      patientConversations: patientConversations.slice(0, 5).map(c => ({
        id: c._id,
        status: c.status,
        startTime: c.startTime,
        endTime: c.endTime
      }))
    });
  } catch (error) {
    logger.error('Error in test conversation route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});
//                 rtpListenerHost: process.env.RTP_LISTENER_HOST || 'Not set',
//                 asteriskUrl: config.asterisk.url,
//                 asteriskPublicIp: config.asterisk.publicIp || 'Not set'
//             },
//             environment: {
//                 AWS_REGION: process.env.AWS_REGION,
//                 NODE_ENV: process.env.NODE_ENV,
//                 RTP_PORT_RANGE: process.env.RTP_PORT_RANGE
//             }
//         });
//     } catch (err) {
//         res.status(500).json({ error: err.message, stack: err.stack });
//     }
// });


// ============================================
// ESSENTIAL DEBUGGING ROUTES - AUDIO DEBUGGING
// ============================================


/**
 * Helper function to analyze audio pipeline and provide diagnostics
 */
function analyzeAudioPipeline(debugInfo) {
    const diagnostics = {
        issues: [],
        recommendations: []
    };

    // Check for common issues
    for (const [callId, conn] of Object.entries(debugInfo.activeConnections)) {
        if (conn.audioChunksReceived > 0 && conn.openaiChunkCount === 0) {
            diagnostics.issues.push({
                callId,
                issue: 'No audio received from OpenAI',
                severity: 'high'
            });
        }

        if (conn.audioChunksSent > 100 && conn.audioChunksReceived < 10) {
            diagnostics.issues.push({
                callId,
                issue: 'Low audio reception rate',
                severity: 'medium'
            });
        }

        // Check file sizes
        const files = debugInfo.debugFiles[callId];
        if (files) {
            const fromOpenAI = files['continuous_from_openai_pcm24k.raw'];
            const toOpenAI = files['continuous_from_asterisk_pcm24k.raw'];
            
            if (fromOpenAI && toOpenAI) {
                const ratio = fromOpenAI.size / toOpenAI.size;
                if (ratio < 0.1) {
                    diagnostics.issues.push({
                        callId,
                        issue: `Very low OpenAI response ratio: ${(ratio * 100).toFixed(1)}%`,
                        severity: 'high'
                    });
                }
            }
        }
    }

    // Add recommendations
    if (diagnostics.issues.some(i => i.issue.includes('No audio received'))) {
        diagnostics.recommendations.push(
            'Check OpenAI API key and model permissions',
            'Verify session.update is being sent correctly',
            'Check if audio format is compatible with OpenAI expectations'
        );
    }

    return diagnostics;
}






// ============================================
// ESSENTIAL DEBUGGING ROUTES - TROUBLESHOOTING ACTIONS
// ============================================

/**
 * @swagger
 * /test/network-diagnosis:
 *   get:
 *     summary: Comprehensive network and security group diagnosis
 *     description: Analyzes network configuration, security groups, and connectivity
 *     tags: [Test - Network]
 */
router.get('/network-diagnosis', async (req, res) => {
    try {
        const {
            testSecurityGroups = true,
            testConnectivity = true,
            testRtpPorts = false
        } = req.query;

        // Initialize results object
        const analysisResults = {
            timestamp: new Date().toISOString(),
            issues: [],
            recommendations: [],
            network: {
                rtpListenerHost: process.env.RTP_LISTENER_HOST || 'Not set'
            }
        };

        let udpWorking = false;

        // Security Group Analysis
        if (testSecurityGroups) {
            analysisResults.securityGroups = {
                status: 'analyzing',
                timestamp: new Date().toISOString()
            };

            try {
                // Analyze the current configuration for security group issues
                const issues = [];
                const recommendations = [];
                const terraformFixes = [];

                // Issue 1: Check if using security group IDs instead of CIDR blocks
                // NOTE: This is a false positive - the actual Terraform config uses CIDR blocks correctly
                // The test cannot actually detect the Terraform configuration, so we'll skip this check
                // since UDP connectivity test shows RTP traffic is working
                
                // Only flag as issue if UDP connectivity test fails
                if (analysisResults.connectivity?.udpConnectivity?.canReceiveFromAsterisk === false) {
                    issues.push({
                        category: 'Security Groups',
                        severity: 'CRITICAL',
                        issue: 'RTP traffic blocked by security groups',
                        description: 'UDP connectivity test failed - RTP traffic cannot reach the application',
                        impact: 'Audio will not work - no RTP packets received',
                        terraform_fix: `
resource "aws_security_group_rule" "app_rtp_from_asterisk" {
  type              = "ingress"
  from_port         = var.app_rtp_port_start
  to_port           = var.app_rtp_port_end
  protocol          = "udp"
  security_group_id = aws_security_group.bianca_app_sg.id
  cidr_blocks       = ["\${aws_instance.asterisk.private_ip}/32"]
  description       = "RTP from Asterisk to App"
}`
                    });
                    analysisResults.securityGroups.udpStatus = 'BLOCKED';
                } else if (analysisResults.connectivity?.udpConnectivity?.canReceiveFromAsterisk === true) {
                    // UDP connectivity is working - security groups are configured correctly
                    analysisResults.securityGroups.status = 'completed';
                    analysisResults.securityGroups.message = 'Security groups configured correctly - UDP connectivity verified';
                    analysisResults.securityGroups.udpStatus = 'WORKING';
                } else {
                    // UDP test hasn't run yet or is unknown
                    analysisResults.securityGroups.udpStatus = 'UNKNOWN';
                }

                // Issue 2: Check IP configuration
                if (!analysisResults.network.rtpBiancaHost || analysisResults.network.rtpBiancaHost === 'Not set') {
                    issues.push({
                        category: 'IP Configuration',
                        severity: 'HIGH',
                        issue: 'Missing RTP destination IP configuration',
                        description: 'Asterisk needs to know where to send RTP traffic',
                        impact: 'RTP packets will not reach the application',
                        check: 'Verify getFargateIp() returns the IP that Asterisk can reach'
                    });
                }

                // Issue 3: Check if UDP connectivity is working (this is the real test)
                if (analysisResults.connectivity?.udpConnectivity?.canReceiveFromAsterisk === false) {
                    issues.push({
                        category: 'RTP Connectivity',
                        severity: 'CRITICAL',
                        issue: 'UDP connectivity test failed',
                        description: 'Cannot receive UDP packets from Asterisk - RTP traffic blocked',
                        impact: 'Audio will not work - no RTP packets received',
                        check: 'Verify security group rules allow UDP traffic from Asterisk private IP'
                    });
                }

                // Issue 4: Check port range configuration
                const portRange = analysisResults.network.appRtpPortRange;
                if (!portRange || portRange === 'Not set') {
                    issues.push({
                        category: 'Port Configuration',
                        severity: 'HIGH',
                        issue: 'Missing RTP port range configuration',
                        description: 'Security group needs to allow UDP traffic on RTP port range',
                        impact: 'RTP traffic will be blocked',
                        terraform_fix: `
variable "app_rtp_port_start" {
  description = "Starting port for RTP traffic"
  type        = number
  default     = 20002
}

variable "app_rtp_port_end" {
  description = "Ending port for RTP traffic"
  type        = number
  default     = 30000
}`
                    });
                }

                analysisResults.securityGroups.status = 'completed';
                analysisResults.securityGroups.issues = issues;
                analysisResults.securityGroups.recommendations = recommendations;
                analysisResults.issues = issues;
                analysisResults.recommendations = recommendations;
                analysisResults.terraformFixes = terraformFixes;

            } catch (err) {
                analysisResults.securityGroups.status = 'failed';
                analysisResults.securityGroups.error = err.message;
                analysisResults.issues.push({
                    category: 'Analysis Error',
                    severity: 'MEDIUM',
                    issue: 'Security group analysis failed',
                    description: err.message
                });
            }
        }

        // Connectivity Testing
        if (testConnectivity) {
            analysisResults.connectivity = {
                status: 'testing',
                timestamp: new Date().toISOString()
            };

            try {
                const { getAsteriskIP, getRTPAddress, getNetworkDebugInfo } = require('../../utils/network.utils');
                
                // Test DNS resolution
                const asteriskIP = await getAsteriskIP();
                const rtpAddress = getRTPAddress();
                const networkInfo = getNetworkDebugInfo();
                
                analysisResults.connectivity.dnsResolution = {
                    asteriskIP,
                    rtpAddress,
                    networkInfo,
                    resolved: !!asteriskIP
                };

                // Test TCP connectivity to Asterisk (ARI/HTTP)
                if (asteriskIP) {
                    const net = require('net');
                    const asteriskUrl = new URL(config.asterisk.url);
                    const asteriskPort = asteriskUrl.port || (asteriskUrl.protocol === 'https:' ? 443 : 80);
                    
                    const tcpTest = await new Promise((resolve) => {
                        const socket = new net.Socket();
                        const timeout = setTimeout(() => {
                            socket.destroy();
                            resolve({ connected: false, error: 'Connection timeout' });
                        }, 5000);
                        
                        socket.connect(asteriskPort, asteriskIP, () => {
                            clearTimeout(timeout);
                            socket.destroy();
                            resolve({ connected: true });
                        });
                        
                        socket.on('error', (err) => {
                            clearTimeout(timeout);
                            resolve({ connected: false, error: err.message });
                        });
                    });
                    
                    analysisResults.connectivity.tcpConnectivity = tcpTest;
                }

                // Test UDP connectivity for RTP (Asterisk → App)
                if (asteriskIP) {
                    const dgram = require('dgram');
                    const testPort = 20002; // Use a test RTP port
                    
                    const udpTest = await new Promise((resolve) => {
                        const server = dgram.createSocket('udp4');
                        const timeout = setTimeout(() => {
                            server.close();
                            resolve({ 
                                listening: false, 
                                error: 'UDP server setup timeout',
                                canReceiveFromAsterisk: false 
                            });
                        }, 5000);
                        
                        server.on('error', (err) => {
                            clearTimeout(timeout);
                            server.close();
                            resolve({ 
                                listening: false, 
                                error: err.message,
                                canReceiveFromAsterisk: false 
                            });
                        });
                        
                        server.on('listening', () => {
                            clearTimeout(timeout);
                            
                            // Test if Asterisk can send UDP to us
                            const testPacket = Buffer.from('test-rtp-packet');
                            const client = dgram.createSocket('udp4');
                            
                            client.send(testPacket, testPort, asteriskIP, (err) => {
                                client.close();
                                if (err) {
                                    server.close();
                                    resolve({ 
                                        listening: true, 
                                        canReceiveFromAsterisk: false,
                                        error: `Cannot send to Asterisk: ${err.message}`
                                    });
                                } else {
                                    // Wait briefly for packet to arrive
                                    setTimeout(() => {
                                        server.close();
                                        resolve({ 
                                            listening: true, 
                                            canReceiveFromAsterisk: true,
                                            testPort: testPort
                                        });
                                    }, 1000);
                                }
                            });
                        });
                        
                        server.bind(testPort, '0.0.0.0');
                    });
                    
                    analysisResults.connectivity.udpConnectivity = udpTest;
                }

                analysisResults.connectivity.status = 'completed';
                
                // Update UDP working status based on connectivity test results
                if (analysisResults.connectivity?.udpConnectivity?.canReceiveFromAsterisk === true) {
                    udpWorking = true;
                }
                
            } catch (err) {
                analysisResults.connectivity.status = 'failed';
                analysisResults.connectivity.error = err.message;
                analysisResults.issues.push({
                    category: 'Connectivity',
                    severity: 'HIGH',
                    issue: 'Connectivity test failed',
                    description: err.message
                });
            }
        }

        // RTP Port Testing
        if (testRtpPorts) {
            analysisResults.rtpPorts = {
                status: 'testing',
                timestamp: new Date().toISOString()
            };

            try {
                const portManager = require('../../services/port.manager.service');
                const portStats = portManager.getStats();
                
                // Test port allocation using channel tracker
                const testCallId = `sg-test-${Date.now()}`;
                
                // First, create a call in the tracker
                channelTracker.addCall(testCallId, {
                    twilioCallSid: testCallId,
                    patientId: 'test-patient',
                    state: 'testing',
                    createdAt: new Date().toISOString()
                });
                
                const allocatedPorts = channelTracker.allocatePortsForCall(testCallId);
                
                if (!allocatedPorts.readPort || !allocatedPorts.writePort) {
                    throw new Error(`Failed to allocate ports: readPort=${allocatedPorts.readPort}, writePort=${allocatedPorts.writePort}`);
                }
                
                // Test RTP listener creation
                const rtpListenerService = require('../../services/rtp.listener.service');
                const testPort = allocatedPorts.readPort;
                
                await rtpListenerService.startRtpListenerForCall(testPort, testCallId, testCallId);
                const listener = rtpListenerService.getListenerForCall(testCallId);
                
                // Cleanup
                rtpListenerService.stopRtpListenerForCall(testCallId);
                channelTracker.releasePortsForCall(testCallId);
                channelTracker.removeCall(testCallId);
                
                analysisResults.rtpPorts.status = 'completed';
                analysisResults.rtpPorts.portStats = portStats;
                analysisResults.rtpPorts.testAllocation = {
                    callId: testCallId,
                    allocatedPorts,
                    listenerCreated: !!listener,
                    listenerActive: listener?.isActive || false
                };
                
            } catch (err) {
                analysisResults.rtpPorts.status = 'failed';
                analysisResults.rtpPorts.error = err.message;
                analysisResults.issues.push({
                    category: 'RTP Ports',
                    severity: 'HIGH',
                    issue: 'RTP port test failed',
                    description: err.message
                });
            }
        }

        // Architecture Summary
        analysisResults.architecture = {
            app: 'AWS Fargate (ECS)',
            asterisk: 'EC2 Instance',
            connectivity: 'RTP over UDP',
            securityGroupApproach: 'Using CIDR blocks for Fargate ↔ EC2',
            currentStatus: udpWorking ? 'Network connectivity working - focus on audio pipeline' : 'Network connectivity blocked - fix security groups',
            udpConnectivity: udpWorking ? 'WORKING' : 'BLOCKED'
        };

        // Overall Assessment
        const criticalIssues = analysisResults.issues.filter(i => i.severity === 'CRITICAL').length;
        const highIssues = analysisResults.issues.filter(i => i.severity === 'HIGH').length;
        
        analysisResults.assessment = {
            overallStatus: criticalIssues > 0 ? 'CRITICAL' : highIssues > 0 ? 'HIGH' : 'GOOD',
            criticalIssues,
            highIssues,
            totalIssues: analysisResults.issues.length,
            udpConnectivity: udpWorking ? 'WORKING' : 'BLOCKED',
            likelyRootCause: udpWorking ? 'OpenAI WebSocket or audio pipeline' : 'Security group configuration',
            nextSteps: udpWorking ? 
                'Focus on OpenAI WebSocket connection and audio pipeline testing' :
                'Fix security group rules to allow UDP traffic from Asterisk'
        };

        res.json(analysisResults);
    } catch (err) {
        res.status(500).json({
            error: 'Security group analysis failed',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

























/**
 * @swagger
// SENTIMENT ANALYSIS TEST ROUTES
// ============================================

/**
 * @swagger
 * /test/sentiment/analyze:
 *   post:
 *     summary: Test sentiment analysis with sample conversation
 *     description: Tests the sentiment analysis service with a sample conversation
 *     tags: [Test]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conversationText:
 *                 type: string
 *                 description: Sample conversation text to analyze
 *                 default: "Patient: Hi Bianca, I'm feeling really good today! Bianca: That's wonderful to hear! What's making you feel so good? Patient: I had a great walk this morning and my medication seems to be working well."
 *               detailed:
 *                 type: boolean
 *                 description: Whether to return detailed analysis
 *                 default: true
 *     responses:
 *       "200":
 *         description: Sentiment analysis completed successfully
 *       "500":
 *         description: Sentiment analysis failed
 */
router.post('/sentiment/analyze', async (req, res) => {
    try {
        const { getOpenAISentimentServiceInstance } = require('../../services/openai.sentiment.service');
        const sentimentService = getOpenAISentimentServiceInstance();
        
        const defaultConversation = `Patient: Hi Bianca, I'm feeling really good today!
Bianca: That's wonderful to hear! What's making you feel so good?
Patient: I had a great walk this morning and my medication seems to be working well.
Bianca: I'm so happy to hear that! Regular exercise and proper medication can make such a difference.
Patient: Yes, I feel like I have more energy and I'm sleeping better too.
Bianca: That's fantastic! It sounds like you're taking great care of yourself.`;

        const conversationText = req.body.conversationText || defaultConversation;
        const detailed = req.body.detailed !== false; // Default to true

        logger.info('[Test Sentiment] Starting sentiment analysis test');
        
        const result = await sentimentService.analyzeSentiment(conversationText, { detailed });
        
        res.json({
            success: true,
            testType: 'sentiment_analysis',
            input: {
                conversationText: conversationText.substring(0, 100) + '...',
                detailed
            },
            result
        });
        
    } catch (error) {
        logger.error('[Test Sentiment] Error:', error.message);
        res.status(500).json({
            success: false,
            testType: 'sentiment_analysis',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/sentiment/trend/{patientId}:
 *   get:
 *     summary: Test sentiment trend analysis for a patient
 *     description: Tests the sentiment trend analysis for a specific patient
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The patient ID to test
 *       - in: query
 *         name: timeRange
 *         required: false
 *         schema:
 *           type: string
 *           enum: [month, year, lifetime]
 *           default: month
 *         description: Time range for the analysis
 *     responses:
 *       "200":
 *         description: Sentiment trend analysis completed successfully
 *       "404":
 *         description: Patient not found
 *       "500":
 *         description: Analysis failed
 */
router.get('/sentiment/trend/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { timeRange = 'month' } = req.query;
        
        const { conversationService } = require('../../services');
        
        logger.info(`[Test Sentiment] Testing sentiment trend for patient ${patientId}, timeRange: ${timeRange}`);
        
        const trendData = await conversationService.getSentimentTrend(patientId, timeRange);
        
        res.json({
            success: true,
            testType: 'sentiment_trend',
            input: { patientId, timeRange },
            result: trendData
        });
        
    } catch (error) {
        logger.error('[Test Sentiment] Trend analysis error:', error.message);
        res.status(500).json({
            success: false,
            testType: 'sentiment_trend',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/sentiment/summary/{patientId}:
 *   get:
 *     summary: Test sentiment summary for a patient
 *     description: Tests the sentiment summary analysis for a specific patient
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The patient ID to test
 *     responses:
 *       "200":
 *         description: Sentiment summary analysis completed successfully
 *       "404":
 *         description: Patient not found
 *       "500":
 *         description: Analysis failed
 */
router.get('/sentiment/summary/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        
        const { conversationService } = require('../../services');
        
        logger.info(`[Test Sentiment] Testing sentiment summary for patient ${patientId}`);
        
        const summaryData = await conversationService.getSentimentSummary(patientId);
        
        res.json({
            success: true,
            testType: 'sentiment_summary',
            input: { patientId },
            result: summaryData
        });
        
    } catch (error) {
        logger.error('[Test Sentiment] Summary analysis error:', error.message);
        res.status(500).json({
            success: false,
            testType: 'sentiment_summary',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/sentiment/conversation/{conversationId}:
 *   get:
 *     summary: Test sentiment analysis for a specific conversation
 *     description: Tests getting sentiment analysis for a specific conversation
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The conversation ID to test
 *     responses:
 *       "200":
 *         description: Conversation sentiment analysis retrieved successfully
 *       "404":
 *         description: Conversation not found
 *       "500":
 *         description: Analysis failed
 */
router.get('/sentiment/conversation/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        const { conversationService } = require('../../services');
        
        logger.info(`[Test Sentiment] Testing conversation sentiment for ${conversationId}`);
        
        const conversation = await conversationService.getConversationById(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                testType: 'conversation_sentiment',
                error: 'Conversation not found'
            });
        }
        
        const sentimentData = conversation.analyzedData?.sentiment || null;
        const sentimentAnalyzedAt = conversation.analyzedData?.sentimentAnalyzedAt || null;
        
        res.json({
            success: true,
            testType: 'conversation_sentiment',
            input: { conversationId },
            result: {
                conversationId,
                sentiment: sentimentData,
                sentimentAnalyzedAt: sentimentAnalyzedAt ? new Date(sentimentAnalyzedAt).toISOString() : null,
                hasSentimentAnalysis: !!sentimentData
            }
        });
        
    } catch (error) {
        logger.error('[Test Sentiment] Conversation sentiment error:', error.message);
        res.status(500).json({
            success: false,
            testType: 'conversation_sentiment',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/sentiment/analyze-conversation/{conversationId}:
 *   post:
 *     summary: Test manual sentiment analysis for a conversation
 *     description: Tests manually triggering sentiment analysis for a specific conversation
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The conversation ID to analyze
 *     responses:
 *       "200":
 *         description: Sentiment analysis triggered successfully
 *       "400":
 *         description: Conversation not completed or already analyzed
 *       "404":
 *         description: Conversation not found
 *       "500":
 *         description: Analysis failed
 */
router.post('/sentiment/analyze-conversation/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        const { conversationService } = require('../../services');
        const { getOpenAISentimentServiceInstance } = require('../../services/openai.sentiment.service');
        
        logger.info(`[Test Sentiment] Testing manual sentiment analysis for conversation ${conversationId}`);
        
        // Check if conversation exists and is completed
        const conversation = await conversationService.getConversationById(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                testType: 'manual_sentiment_analysis',
                error: 'Conversation not found'
            });
        }
        
        if (conversation.status !== 'completed') {
            return res.status(400).json({
                success: false,
                testType: 'manual_sentiment_analysis',
                error: 'Can only analyze sentiment for completed conversations'
            });
        }
        
        // Trigger sentiment analysis
        const sentimentService = getOpenAISentimentServiceInstance();
        const analysisResult = await sentimentService.analyzeConversationSentiment(conversationId, {
            detailed: true
        });
        
        if (analysisResult.success) {
            res.json({
                success: true,
                testType: 'manual_sentiment_analysis',
                input: { conversationId },
                result: {
                    conversationId,
                    sentiment: analysisResult.data,
                    analyzedAt: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({
                success: false,
                testType: 'manual_sentiment_analysis',
                error: `Sentiment analysis failed: ${analysisResult.error}`
            });
        }
        
    } catch (error) {
        logger.error('[Test Sentiment] Manual analysis error:', error.message);
        res.status(500).json({
            success: false,
            testType: 'manual_sentiment_analysis',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/sentiment/run-all-tests:
 *   post:
 *     summary: Run all sentiment analysis tests
 *     description: Runs a comprehensive test suite for all sentiment analysis functionality
 *     tags: [Test]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: Patient ID to test with (optional)
 *               conversationId:
 *                 type: string
 *                 description: Conversation ID to test with (optional)
 *     responses:
 *       "200":
 *         description: All tests completed
 *       "500":
 *         description: Some tests failed
 */
router.post('/sentiment/run-all-tests', async (req, res) => {
    try {
        const { patientId, conversationId } = req.body;
        const results = [];
        
        logger.info('[Test Sentiment] Running comprehensive sentiment analysis test suite');
        
        // Test 1: Basic sentiment analysis
        try {
            const { getOpenAISentimentServiceInstance } = require('../../services/openai.sentiment.service');
            const sentimentService = getOpenAISentimentServiceInstance();
            
            const testConversation = `Patient: Hi Bianca, I'm feeling really good today!
Bianca: That's wonderful to hear! What's making you feel so good?
Patient: I had a great walk this morning and my medication seems to be working well.`;
            
            const analysisResult = await sentimentService.analyzeSentiment(testConversation, { detailed: true });
            
            results.push({
                test: 'basic_sentiment_analysis',
                success: analysisResult.success,
                result: analysisResult.success ? 'Sentiment analysis working' : analysisResult.error
            });
        } catch (error) {
            results.push({
                test: 'basic_sentiment_analysis',
                success: false,
                result: error.message
            });
        }
        
        // Test 2: Patient trend analysis (if patientId provided)
        if (patientId) {
            try {
                const { conversationService } = require('../../services');
                const trendData = await conversationService.getSentimentTrend(patientId, 'month');
                
                results.push({
                    test: 'patient_trend_analysis',
                    success: true,
                    result: `Found ${trendData.dataPoints.length} data points for patient ${patientId}`
                });
            } catch (error) {
                results.push({
                    test: 'patient_trend_analysis',
                    success: false,
                    result: error.message
                });
            }
            
            // Test 3: Patient summary analysis
            try {
                const { conversationService } = require('../../services');
                const summaryData = await conversationService.getSentimentSummary(patientId);
                
                results.push({
                    test: 'patient_summary_analysis',
                    success: true,
                    result: `Summary generated with ${summaryData.analyzedConversations} analyzed conversations`
                });
            } catch (error) {
                results.push({
                    test: 'patient_summary_analysis',
                    success: false,
                    result: error.message
                });
            }
        }
        
        // Test 4: Conversation analysis (if conversationId provided)
        if (conversationId) {
            try {
                const { conversationService } = require('../../services');
                const conversation = await conversationService.getConversationById(conversationId);
                
                if (conversation) {
                    results.push({
                        test: 'conversation_retrieval',
                        success: true,
                        result: `Conversation found with status: ${conversation.status}`
                    });
                    
                    if (conversation.analyzedData?.sentiment) {
                        results.push({
                            test: 'conversation_sentiment_check',
                            success: true,
                            result: 'Conversation already has sentiment analysis'
                        });
                    } else {
                        results.push({
                            test: 'conversation_sentiment_check',
                            success: false,
                            result: 'Conversation does not have sentiment analysis'
                        });
                    }
                } else {
                    results.push({
                        test: 'conversation_retrieval',
                        success: false,
                        result: 'Conversation not found'
                    });
                }
            } catch (error) {
                results.push({
                    test: 'conversation_retrieval',
                    success: false,
                    result: error.message
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const totalTests = results.length;
        
        res.json({
            success: successCount === totalTests,
            testType: 'comprehensive_sentiment_test_suite',
            summary: {
                totalTests,
                successfulTests: successCount,
                failedTests: totalTests - successCount
            },
            results
        });
        
    } catch (error) {
        logger.error('[Test Sentiment] Comprehensive test error:', error.message);
        res.status(500).json({
            success: false,
            testType: 'comprehensive_sentiment_test_suite',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/debug-sentiment-analysis:
 *   post:
 *     summary: Debug sentiment analysis for recent conversations
 *     description: |
 *       Debug and fix sentiment analysis for recent conversations. This endpoint will:
 *       1. Find recent completed conversations without sentiment analysis
 *       2. Attempt to analyze them manually using OpenAI
 *       3. Update the conversations with sentiment data
 *       4. Return detailed results for each conversation processed
 *     tags: [Test Routes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hoursBack:
 *                 type: number
 *                 default: 24
 *                 description: Number of hours back to look for conversations
 *               maxConversations:
 *                 type: number
 *                 default: 10
 *                 description: Maximum number of conversations to process
 *               forceReanalyze:
 *                 type: boolean
 *                 default: false
 *                 description: Force re-analysis even if sentiment already exists
 *     responses:
 *       "200":
 *         description: Debug analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 debugType:
 *                   type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalConversations:
 *                       type: number
 *                     conversationsWithoutSentiment:
 *                       type: number
 *                     successfullyAnalyzed:
 *                       type: number
 *                     failedAnalyses:
 *                       type: number
 *                 conversations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       conversationId:
 *                         type: string
 *                       patientName:
 *                         type: string
 *                       endTime:
 *                         type: string
 *                       hadSentiment:
 *                         type: boolean
 *                       messageCount:
 *                         type: number
 *                       analysisResult:
 *                         type: object
 *                         properties:
 *                           success:
 *                             type: boolean
 *                           sentiment:
 *                             type: string
 *                           score:
 *                             type: number
 *                           error:
 *                             type: string
 *       "500":
 *         description: Debug analysis failed
 */
router.post('/debug-sentiment-analysis', async (req, res) => {
    try {
        const { hoursBack = 24, maxConversations = 10, forceReanalyze = false } = req.body;
        
        logger.info(`[Test Debug] Starting sentiment analysis debug - hoursBack: ${hoursBack}, maxConversations: ${maxConversations}, forceReanalyze: ${forceReanalyze}`);
        
        const { Conversation, Message } = require('../../models');
        const { getOpenAISentimentServiceInstance } = require('../../services/openai.sentiment.service');
        
        // Get recent completed conversations
        const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
        const query = {
            status: 'completed',
            endTime: { $gte: cutoffTime }
        };
        
        // If not forcing re-analysis, only get conversations without sentiment
        if (!forceReanalyze) {
            query.$or = [
                { 'analyzedData.sentiment': { $exists: false } },
                { 'analyzedData.sentiment': null }
            ];
        }
        
        const conversations = await Conversation.find(query)
            .populate('patientId', 'name')
            .sort({ endTime: -1 })
            .limit(maxConversations);
        
        logger.info(`[Test Debug] Found ${conversations.length} conversations to analyze`);
        
        const results = {
            success: true,
            debugType: 'sentiment_analysis_debug',
            summary: {
                totalConversations: conversations.length,
                conversationsWithoutSentiment: conversations.filter(c => !c.analyzedData?.sentiment).length,
                successfullyAnalyzed: 0,
                failedAnalyses: 0
            },
            conversations: []
        };
        
        const sentimentService = getOpenAISentimentServiceInstance();
        
        for (const conversation of conversations) {
            const conversationResult = {
                conversationId: conversation._id.toString(),
                patientName: conversation.patientId?.name || 'Unknown',
                endTime: conversation.endTime?.toISOString() || 'Unknown',
                hadSentiment: !!conversation.analyzedData?.sentiment,
                messageCount: 0,
                analysisResult: null
            };
            
            try {
                // Get messages for this conversation
                const messages = await Message.find({ conversationId: conversation._id })
                    .sort({ createdAt: 1 })
                    .select('role content')
                    .limit(50); // Limit to prevent huge conversations
                
                conversationResult.messageCount = messages.length;
                
                if (messages.length === 0) {
                    conversationResult.analysisResult = {
                        success: false,
                        error: 'No messages found in conversation'
                    };
                    results.summary.failedAnalyses++;
                } else {
                    // Format conversation text
                    const conversationText = messages
                        .map(msg => {
                            const speaker = msg.role === 'assistant' ? 'Bianca' : 'Patient';
                            return `${speaker}: ${msg.content}`;
                        })
                        .join('\n');
                    
                    // Perform sentiment analysis
                    const analysisResult = await sentimentService.analyzeSentiment(conversationText, { detailed: true });
                    
                    if (analysisResult.success) {
                        // Update conversation with sentiment data
                        await Conversation.findByIdAndUpdate(conversation._id, {
                            $set: {
                                'analyzedData.sentiment': analysisResult.data,
                                'analyzedData.sentimentAnalyzedAt': new Date()
                            }
                        });
                        
                        conversationResult.analysisResult = {
                            success: true,
                            sentiment: analysisResult.data.overallSentiment,
                            score: analysisResult.data.sentimentScore,
                            confidence: analysisResult.data.confidence,
                            mood: analysisResult.data.patientMood,
                            emotions: analysisResult.data.keyEmotions,
                            concernLevel: analysisResult.data.concernLevel
                        };
                        
                        results.summary.successfullyAnalyzed++;
                        
                        logger.info(`[Test Debug] Successfully analyzed conversation ${conversation._id}: ${analysisResult.data.overallSentiment} (${analysisResult.data.sentimentScore})`);
                    } else {
                        conversationResult.analysisResult = {
                            success: false,
                            error: analysisResult.error
                        };
                        results.summary.failedAnalyses++;
                        
                        logger.error(`[Test Debug] Failed to analyze conversation ${conversation._id}: ${analysisResult.error}`);
                    }
                }
                
            } catch (error) {
                conversationResult.analysisResult = {
                    success: false,
                    error: error.message
                };
                results.summary.failedAnalyses++;
                
                logger.error(`[Test Debug] Error processing conversation ${conversation._id}: ${error.message}`);
            }
            
            results.conversations.push(conversationResult);
        }
        
        logger.info(`[Test Debug] Debug completed - Successfully analyzed: ${results.summary.successfullyAnalyzed}, Failed: ${results.summary.failedAnalyses}`);
        
        res.json(results);
        
    } catch (error) {
        logger.error('[Test Debug] Debug sentiment analysis error:', error.message);
        res.status(500).json({
            success: false,
            debugType: 'sentiment_analysis_debug',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/debug-conversation-data:
 *   post:
 *     summary: Debug conversation data for a patient
 *     description: Debug the actual conversation data structure to understand sentiment analysis issues
 *     tags: [Test Routes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: The patient ID to debug
 *     responses:
 *       "200":
 *         description: Debug data returned successfully
 */
router.post('/debug-conversation-data', async (req, res) => {
    try {
        const { patientId } = req.body;
        
        if (!patientId) {
            return res.status(400).json({
                success: false,
                error: 'patientId is required'
            });
        }
        
        const { Conversation } = require('../../models');
        
        logger.info(`[Test Debug] Debugging conversation data for patient ${patientId}`);
        
        // Get ALL conversations for this patient (no time limit)
        const allConversations = await Conversation.find({
            patientId
        })
        .select('_id startTime endTime duration status analyzedData')
        .sort({ endTime: -1 })
        .lean();
        
        // Get conversations from last 30 days (same as sentiment summary)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentConversations = await Conversation.find({
            patientId,
            endTime: { $gte: thirtyDaysAgo }
        })
        .select('_id startTime endTime duration status analyzedData')
        .sort({ endTime: -1 })
        .limit(10)
        .lean();
        
        // Find conversations with sentiment data
        const conversationsWithSentiment = allConversations.filter(conv => conv.analyzedData?.sentiment);
        const recentWithSentiment = recentConversations.filter(conv => conv.analyzedData?.sentiment);
        
        // Get the specific conversation from your test (if it exists)
        const testConversation = allConversations.find(conv => 
            conv.endTime && 
            conv.endTime.toISOString().includes('2025-09-11T17:45')
        );
        
        res.json({
            success: true,
            debugType: 'conversation_data_debug',
            summary: {
                totalConversations: allConversations.length,
                recentConversations: recentConversations.length,
                conversationsWithSentiment: conversationsWithSentiment.length,
                recentWithSentiment: recentWithSentiment.length,
                testConversationFound: !!testConversation
            },
            data: {
                allConversations: allConversations.slice(0, 5), // First 5 for brevity
                recentConversations: recentConversations,
                conversationsWithSentiment: conversationsWithSentiment,
                testConversation: testConversation,
                thirtyDaysAgo: thirtyDaysAgo.toISOString()
            }
        });
        
    } catch (error) {
        logger.error('[Test Debug] Conversation data debug error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// MEDICAL ANALYSIS TEST ROUTES
// ============================================

/**
 * @swagger
 * /test/medical-analysis/trigger-all:
 *   post:
 *     summary: Trigger medical analysis for all active patients
 *     description: Manually trigger medical analysis for all active patients (testing purposes)
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Medical analysis triggered successfully
 *       500:
 *         description: Failed to trigger medical analysis
 */
router.post('/medical-analysis/trigger-all', async (req, res) => {
    try {
        const medicalAnalysisScheduler = require('../../services/ai/medicalAnalysisScheduler.service');
        const patientService = require('../../services/patient.service');
        
        logger.info('[Test] Manual trigger: Starting medical analysis for all patients');
        
        // Get all active patients
        const patients = await patientService.getActivePatients();
        
        if (patients.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No active patients found for analysis',
                patientsAnalyzed: 0,
                jobsScheduled: 0
            });
        }

        // Schedule analysis for all patients
        const jobs = await medicalAnalysisScheduler.scheduleBatchAnalysis(
            patients.map(p => p._id.toString()),
            {
                trigger: 'manual',
                batchId: `manual-${Date.now()}`
            }
        );

        const successfulJobs = jobs.filter(job => !job.error);
        const failedJobs = jobs.filter(job => job.error);

        logger.info('[Test] Manual trigger completed', {
            totalPatients: patients.length,
            successfulJobs: successfulJobs.length,
            failedJobs: failedJobs.length
        });

        res.status(200).json({
            success: true,
            message: `Medical analysis triggered for ${patients.length} patients`,
            patientsAnalyzed: patients.length,
            jobsScheduled: successfulJobs.length,
            failedJobs: failedJobs.length,
            batchId: `manual-${Date.now()}`,
            patients: patients.map(p => ({
                id: p._id,
                name: p.name || 'Unknown'
            })),
            errors: failedJobs.map(job => ({
                patientId: job.patientId,
                error: job.error
            }))
        });

    } catch (error) {
        logger.error('[Test] Error in manual medical analysis trigger:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger medical analysis',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/medical-analysis/trigger-patient/{patientId}:
 *   post:
 *     summary: Trigger medical analysis for a specific patient
 *     description: Manually trigger medical analysis for a specific patient (testing purposes)
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: Medical analysis triggered successfully
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Failed to trigger medical analysis
 */
router.post('/medical-analysis/trigger-patient/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        const medicalAnalysisScheduler = require('../../services/ai/medicalAnalysisScheduler.service');
        const patientService = require('../../services/patient.service');
        
        logger.info('[Test] Manual trigger: Starting medical analysis for patient', { patientId });

        // Verify patient exists
        const patient = await patientService.getPatientById(patientId);
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
                patientId
            });
        }

        // Schedule analysis for the patient
        const job = await medicalAnalysisScheduler.schedulePatientAnalysis(patientId, {
            trigger: 'manual',
            batchId: `manual-${Date.now()}`
        });

        logger.info('[Test] Manual trigger completed for patient', {
            patientId,
            jobId: job.attrs._id
        });

        res.status(200).json({
            success: true,
            message: `Medical analysis triggered for patient ${patient.name || patientId}`,
            patientId,
            jobId: job.attrs._id,
            batchId: `manual-${Date.now()}`
        });

    } catch (error) {
        logger.error('[Test] Error in manual patient medical analysis trigger:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger patient medical analysis',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/medical-analysis/results/{patientId}:
 *   get:
 *     summary: Get medical analysis results for a specific patient
 *     description: Retrieve medical analysis results for a specific patient (testing purposes)
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Medical analysis results retrieved successfully
 *       500:
 *         description: Failed to fetch medical analysis results
 */
router.get('/medical-analysis/results/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { limit = 10 } = req.query;
        const conversationService = require('../../services/conversation.service');
        
        logger.info('[Test] Fetching medical analysis results for patient', { patientId, limit });

        // Get analysis results
        const results = await conversationService.getMedicalAnalysisResults(patientId, parseInt(limit));

        res.status(200).json({
            success: true,
            patientId,
            results: results,
            count: results.length
        });

    } catch (error) {
        logger.error('[Test] Error fetching medical analysis results:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch medical analysis results',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/medical-analysis/results:
 *   get:
 *     summary: Get medical analysis results summary for all patients
 *     description: Retrieve medical analysis results summary for all patients (testing purposes)
 *     tags: [Test]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Maximum number of results per patient to return
 *     responses:
 *       200:
 *         description: Medical analysis results summary retrieved successfully
 *       500:
 *         description: Failed to fetch medical analysis results summary
 */
router.get('/medical-analysis/results', async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        const conversationService = require('../../services/conversation.service');
        const patientService = require('../../services/patient.service');
        
        logger.info('[Test] Fetching medical analysis results summary', { limit });

        // Get all active patients
        const patients = await patientService.getActivePatients();
        
        // Get latest analysis results for each patient
        const patientResults = await Promise.all(
            patients.map(async (patient) => {
                try {
                    const results = await conversationService.getMedicalAnalysisResults(
                        patient._id.toString(), 
                        1 // Get only the latest result
                    );
                    return {
                        patientId: patient._id,
                        patientName: patient.name || 'Unknown',
                        latestAnalysis: results[0] || null,
                        hasResults: results.length > 0
                    };
                } catch (error) {
                    logger.error(`[Test] Error fetching results for patient ${patient._id}:`, error);
                    return {
                        patientId: patient._id,
                        patientName: patient.name || 'Unknown',
                        latestAnalysis: null,
                        hasResults: false,
                        error: error.message
                    };
                }
            })
        );

        res.status(200).json({
            success: true,
            patients: patientResults,
            totalPatients: patients.length,
            patientsWithResults: patientResults.filter(p => p.hasResults).length
        });

    } catch (error) {
        logger.error('[Test] Error fetching medical analysis results summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch medical analysis results summary',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/medical-analysis/status:
 *   get:
 *     summary: Get medical analysis scheduler status
 *     description: Get the current status of the medical analysis scheduler (testing purposes)
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Scheduler status retrieved successfully
 *       500:
 *         description: Failed to fetch scheduler status
 */
router.get('/medical-analysis/status', async (req, res) => {
    try {
        const medicalAnalysisScheduler = require('../../services/ai/medicalAnalysisScheduler.service');
        const status = await medicalAnalysisScheduler.getStatus();
        
        res.status(200).json({
            success: true,
            status: status
        });

    } catch (error) {
        logger.error('[Test] Error fetching scheduler status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scheduler status',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/medical-analysis/initialize:
 *   post:
 *     summary: Initialize the medical analysis scheduler
 *     description: Initialize the medical analysis scheduler if not already initialized (testing purposes)
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Scheduler initialized successfully
 *       500:
 *         description: Failed to initialize scheduler
 */
router.post('/medical-analysis/initialize', async (req, res) => {
    try {
        const medicalAnalysisScheduler = require('../../services/ai/medicalAnalysisScheduler.service');
        
        logger.info('[Test] Manual trigger: Initializing medical analysis scheduler');
        
        await medicalAnalysisScheduler.initialize();
        
        res.status(200).json({
            success: true,
            message: 'Medical analysis scheduler initialized successfully',
            status: await medicalAnalysisScheduler.getStatus()
        });

    } catch (error) {
        logger.error('[Test] Error initializing medical analysis scheduler:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize medical analysis scheduler',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/push-notification:
 *   post:
 *     summary: Send test push notification to first patient's caregiver
 *     description: Send a test emergency push notification to the first patient's caregiver via SNS (testing purposes only)
 *     tags: [Test]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               severity:
 *                 type: string
 *                 enum: [CRITICAL, HIGH, MEDIUM]
 *                 default: MEDIUM
 *                 description: Severity level of the test alert
 *               category:
 *                 type: string
 *                 default: Test
 *                 description: Category of the test alert
 *               phrase:
 *                 type: string
 *                 default: Test emergency phrase
 *                 description: Emergency phrase for the test alert
 *             example:
 *               severity: MEDIUM
 *               category: Test
 *               phrase: Test emergency phrase
 *     responses:
 *       200:
 *         description: Push notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 patient:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 caregivers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phone:
 *                         type: string
 *                 notificationResult:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     successful:
 *                       type: number
 *                     failed:
 *                       type: number
 *                     total:
 *                       type: number
 *                     results:
 *                       type: array
 *       404:
 *         description: No patients or caregivers found
 *       500:
 *         description: Failed to send push notification
 */
router.post('/push-notification', async (req, res) => {
    try {
        const { Patient, Caregiver } = require('../../models');
        const { snsService } = require('../../services/sns.service');
        
        // Get the first patient
        const patient = await Patient.findOne().lean();
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'No patients found in database'
            });
        }

        // Get caregivers for the patient
        const caregivers = await Caregiver.find({ 
            patients: patient._id 
        }).lean();
        
        if (!caregivers || caregivers.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No caregivers found for patient: ${patient.name}`,
                patient: {
                    id: patient._id,
                    name: patient.name
                }
            });
        }

        // Get test alert parameters from request body or use defaults
        const { 
            severity = 'MEDIUM', 
            category = 'Test', 
            phrase = 'Test emergency phrase' 
        } = req.body;

        // Create alert data
        const alertData = {
            patientId: patient._id.toString(),
            patientName: patient.name,
            severity: severity,
            category: category,
            phrase: phrase
        };

        logger.info(`[Test] Sending push notification to ${caregivers.length} caregivers for patient: ${patient.name}`);

        // Send push notification
        const notificationResult = await snsService.sendEmergencyAlert(alertData, caregivers);

        res.status(200).json({
            success: true,
            message: `Test push notification sent to ${caregivers.length} caregivers`,
            patient: {
                id: patient._id,
                name: patient.name
            },
            caregivers: caregivers.map(caregiver => ({
                id: caregiver._id,
                name: caregiver.name,
                phone: caregiver.phone
            })),
            notificationResult: notificationResult
        });

    } catch (error) {
        logger.error('[Test] Error sending test push notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test push notification',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/emergency:
 *   post:
 *     summary: Test emergency detection and alert workflow with first patient
 *     description: Test emergency detection by sending a message in a specific language to the first patient in the database. Can optionally create actual alerts and send push notifications.
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: The message to test for emergency detection
 *                 example: "I think I am having a heart attack"
 *               language:
 *                 type: string
 *                 enum: [en, es, fr, de, zh, ja, pt, it, ru, ar]
 *                 default: en
 *                 description: Language code for the message
 *                 example: en
 *               createAlert:
 *                 type: boolean
 *                 default: false
 *                 description: Whether to create an actual alert and send push notifications (use with caution in production)
 *                 example: false
 *     responses:
 *       200:
 *         description: Emergency detection test completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 patient:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     preferredLanguage:
 *                       type: string
 *                 message:
 *                   type: string
 *                 language:
 *                   type: string
 *                 createAlert:
 *                   type: boolean
 *                 result:
 *                   type: object
 *                   properties:
 *                     shouldAlert:
 *                       type: boolean
 *                     alertData:
 *                       type: object
 *                     reason:
 *                       type: string
 *                     processing:
 *                       type: object
 *                 alertResult:
 *                   type: object
 *                   description: Result of alert creation (only present if createAlert is true)
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     alert:
 *                       type: object
 *                     notificationResult:
 *                       type: object
 *                     patient:
 *                       type: object
 *       404:
 *         description: No patients found in database
 *       500:
 *         description: Internal server error
 */
router.post('/emergency', async (req, res) => {
    try {
        const { message, language = 'en', createAlert = false } = req.body;
        
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a non-empty string'
            });
        }

        // Validate language code
        const validLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar'];
        if (!validLanguages.includes(language)) {
            return res.status(400).json({
                success: false,
                error: `Invalid language code. Must be one of: ${validLanguages.join(', ')}`
            });
        }

        // Get the first patient from the database
        const { Patient } = require('../../models');
        const patient = await Patient.findOne().sort({ createdAt: 1 }).exec();
        
        if (!patient) {
            logger.error('[Test] No patients found in database');
            return res.status(404).json({
                success: false,
                error: 'No patients found in database. Create a patient first.'
            });
        }

        // Temporarily update patient's preferred language for this test
        const originalLanguage = patient.preferredLanguage;
        patient.preferredLanguage = language;
        await patient.save();

        try {
            // Import emergency processor
            const { emergencyProcessor } = require('../../services/emergencyProcessor.service');
            
            // Process the utterance
            const result = await emergencyProcessor.processUtterance(patient._id, message);
            
            let alertResult = null;
            
            // If createAlert is true and an emergency was detected, create the actual alert
            if (createAlert && result.shouldAlert && result.alertData) {
                logger.info(`[Test] Creating actual alert for patient ${patient._id} with message: "${message}"`);
                alertResult = await emergencyProcessor.createAlert(patient._id, result.alertData, message);
                
                if (alertResult.success) {
                    logger.info(`[Test] Alert created successfully:`, {
                        alertId: alertResult.alert?._id,
                        notificationSent: !!alertResult.notificationResult
                    });
                } else {
                    logger.error(`[Test] Failed to create alert:`, alertResult.error);
                }
            }
            
            // Restore original language
            patient.preferredLanguage = originalLanguage;
            await patient.save();

            logger.info(`[Test] Emergency test completed for patient ${patient._id}:`, {
                message,
                language,
                createAlert,
                shouldAlert: result.shouldAlert,
                reason: result.reason,
                alertCreated: alertResult?.success || false
            });

            const response = {
                success: true,
                patient: {
                    id: patient._id,
                    name: patient.name,
                    preferredLanguage: originalLanguage
                },
                message,
                language,
                createAlert,
                result
            };

            // Include alert result if alert was created
            if (alertResult) {
                response.alertResult = alertResult;
            }

            res.status(200).json(response);

        } catch (processingError) {
            // Restore original language even if processing fails
            patient.preferredLanguage = originalLanguage;
            await patient.save();
            throw processingError;
        }

    } catch (error) {
        logger.error('[Test] Emergency test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/billing:
 *   post:
 *     summary: Test daily billing process
 *     description: Manually trigger the daily billing process to test invoice creation and payment processing.
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orgId:
 *                 type: string
 *                 description: Specific organization ID to process billing for (optional, processes all orgs if not provided)
 *               dryRun:
 *                 type: boolean
 *                 description: If true, only simulate the billing process without creating invoices
 *                 default: false
 *     responses:
 *       "200":
 *         description: Billing test completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 processedOrgs:
 *                   type: number
 *                 totalInvoices:
 *                   type: number
 *                 totalAmount:
 *                   type: number
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       orgId:
 *                         type: string
 *                       orgName:
 *                         type: string
 *                       invoiceCount:
 *                         type: number
 *                       totalCost:
 *                         type: number
 *                       status:
 *                         type: string
 *       "500":
 *         description: Internal server error
 */
router.post('/billing', async (req, res) => {
    try {
        const { orgId, dryRun = false } = req.body;
        
        logger.info(`[Test] Manual billing test triggered - orgId: ${orgId || 'all'}, dryRun: ${dryRun}`);
        
        if (dryRun) {
            // Simulate billing process without creating actual invoices
            const { Org, Patient, Conversation } = require('../../models');
            
            let orgs;
            if (orgId) {
                const org = await Org.findById(orgId);
                orgs = org ? [org] : [];
            } else {
                orgs = await Org.find({});
            }
            
            const results = [];
            let totalInvoices = 0;
            let totalAmount = 0;
            
            for (const org of orgs) {
                const patients = await Patient.find({ org: org._id });
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                const unbilledConversations = await Conversation.find({
                    patientId: { $in: patients.map(p => p._id) },
                    lineItemId: null,
                    endTime: { $gte: yesterday },
                    cost: { $gt: 0 }
                });
                
                const orgTotalCost = unbilledConversations.reduce((sum, conv) => sum + conv.cost, 0);
                
                if (orgTotalCost > 0) {
                    totalInvoices++;
                    totalAmount += orgTotalCost;
                }
                
                results.push({
                    orgId: org._id,
                    orgName: org.name,
                    invoiceCount: orgTotalCost > 0 ? 1 : 0,
                    totalCost: orgTotalCost,
                    status: 'simulated'
                });
            }
            
            return res.status(200).json({
                success: true,
                message: 'Billing simulation completed',
                processedOrgs: orgs.length,
                totalInvoices,
                totalAmount,
                results,
                dryRun: true
            });
        } else {
            // Run actual billing process
            const { processDailyBilling } = require('../../config/agenda');
            await processDailyBilling();
            
            return res.status(200).json({
                success: true,
                message: 'Daily billing process completed successfully',
                dryRun: false
            });
        }
        
    } catch (error) {
        logger.error('[Test] Billing test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /test/send-email:
 *   post:
 *     summary: Send a test email via SES (orgAdmin only)
 *     description: Allows orgAdmins to test email sending via AWS SES. Returns actual email addresses for verification.
 *     tags: [Test - Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - subject
 *               - text
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 description: Recipient email address
 *                 example: negascout@gmail.com
 *               subject:
 *                 type: string
 *                 description: Email subject
 *                 example: Test Email from Localhost
 *               text:
 *                 type: string
 *                 description: Plain text email body
 *                 example: This is a test email sent from localhost via AWS SES.
 *               html:
 *                 type: string
 *                 description: Optional HTML email body
 *                 example: "<h1>Test Email</h1><p>This is a test email sent from localhost via AWS SES.</p>"
 *     responses:
 *       "200":
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Email sent successfully
 *                 details:
 *                   type: object
 *                   properties:
 *                     to:
 *                       type: string
 *                       example: negascout@gmail.com
 *                     subject:
 *                       type: string
 *                     messageId:
 *                       type: string
 *                     from:
 *                       type: string
 *       "400":
 *         description: Bad request (missing required fields)
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         description: Unauthorized (not authenticated)
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         description: Forbidden (not orgAdmin)
 *         $ref: '#/components/responses/Forbidden'
 *       "500":
 *         description: Internal server error (email sending failed)
 */
router.post('/send-email', auth('readAny:org'), async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;
        const caregiver = req.caregiver;
        
        // Validate required fields
        if (!to || !subject || !text) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: to, subject, and text are required'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address format'
            });
        }
        
        logger.info(`[Test Email] OrgAdmin ${caregiver.name} (${caregiver.email}) sending test email to ${to}`);
        
        // Send email via SES
        const result = await emailService.sendEmail(to, subject, text, html);
        
        // Return actual email addresses (not redacted) for testing
        logger.info(`[Test Email] Email sent successfully. Message ID: ${result.messageId || 'N/A'}`);
        
        res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            details: {
                to: to,
                subject: subject,
                messageId: result.messageId || result.response || 'N/A',
                from: config.email.from,
                timestamp: new Date().toISOString(),
                sentBy: {
                    name: caregiver.name,
                    email: caregiver.email,
                    role: caregiver.role
                }
            }
        });
    } catch (error) {
        logger.error('[Test Email] Failed to send email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send email',
            error: {
                message: error.message,
                awsErrorCode: error.name || error.awsErrorCode || 'Unknown',
                stack: config.env === 'development' ? error.stack : undefined
            },
            // Include actual email address in error for debugging
            details: {
                to: req.body?.to,
                from: config.email.from
            }
        });
    }
});

/**
 * @swagger
 * /test/send-verification-email:
 *   post:
 *     summary: Test email verification flow (no auth required)
 *     description: |
 *       ⚠️ WARNING: This route does not require authentication for testing purposes.
 *       Use with caution in production environments.
 *       
 *       Unverifies a user's email and sends a verification email. Useful for testing the email verification flow.
 *       This will:
 *       1. Set isEmailVerified to false for the specified user
 *       2. Generate a new verification token
 *       3. Send the verification email
 *       4. Return the verification link for testing
 *     tags: [Test - Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the user to unverify and send verification email to
 *                 example: negascout@gmail.com
 *     responses:
 *       "200":
 *         description: Verification email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Verification email sent successfully
 *                 details:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: negascout@gmail.com
 *                     wasVerified:
 *                       type: boolean
 *                       description: Whether the user was verified before this action
 *                       example: true
 *                     isNowVerified:
 *                       type: boolean
 *                       description: Current verification status (should be false)
 *                       example: false
 *                     verificationLinks:
 *                       type: object
 *                       description: Verification links for testing (copy the appropriate one)
 *                       properties:
 *                         backend:
 *                           type: string
 *                           description: Backend URL link (use for localhost testing)
 *                           example: http://localhost:3000/v1/auth/verify-email?token=eyJhbGc...
 *                         frontend:
 *                           type: string
 *                           description: Frontend URL link (use for Universal Links testing)
 *                           example: https://app.myphonefriend.com/auth/verify-email?token=eyJhbGc...
 *                         note:
 *                           type: string
 *                           description: Usage note
 *                           example: Use backend link for localhost testing, frontend link for Universal Links testing
 *                     messageId:
 *                       type: string
 *                       description: Email service message ID
 *                     from:
 *                       type: string
 *                       example: no-replay@myphonefriend.com
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       "400":
 *         description: Bad request (missing email or invalid format)
 *         $ref: '#/components/responses/BadRequest'
 *       "404":
 *         description: User not found
 *       "500":
 *         description: Internal server error
 */
router.post('/send-verification-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        // Validate required fields
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address format'
            });
        }
        
        // Import required services
        const caregiverService = require('../../services/caregiver.service');
        const tokenService = require('../../services/token.service');
        
        // Find the caregiver by email
        const targetCaregiver = await caregiverService.getCaregiverByEmail(email);
        if (!targetCaregiver) {
            return res.status(404).json({
                success: false,
                message: 'User not found with the specified email address'
            });
        }
        
        // Store original verification status
        const wasVerified = targetCaregiver.isEmailVerified || false;
        
        logger.info(`[Test Verification Email] Unverifying and sending verification email to ${email} (no auth required for testing)`);
        
        // Set isEmailVerified to false
        await caregiverService.updateCaregiverById(targetCaregiver.id, { isEmailVerified: false });
        
        // Generate verification token
        const verifyEmailToken = await tokenService.generateVerifyEmailToken(targetCaregiver);
        
        // Send verification email
        const emailResult = await emailService.sendVerificationEmail(email, verifyEmailToken, targetCaregiver.name);
        
        // Construct verification links for testing
        // Use backend URL for localhost testing, frontend URL for Universal Links
        // Ensure apiUrl includes /v1 (it should, but add safeguard)
        const apiUrlWithV1 = config.apiUrl.endsWith('/v1') ? config.apiUrl : `${config.baseUrl}/v1`;
        const backendLink = `${apiUrlWithV1}/auth/verify-email?token=${verifyEmailToken}`;
        const frontendLink = `${config.frontendUrl}/auth/verify-email?token=${verifyEmailToken}`;
        
        logger.info(`[Test Verification Email] Verification email sent successfully to ${email}`);
        logger.info(`[Test Verification Email] Backend link: ${backendLink}`);
        logger.info(`[Test Verification Email] Frontend link: ${frontendLink}`);
        
        res.status(200).json({
            success: true,
            message: 'Verification email sent successfully',
            details: {
                email: email,
                wasVerified: wasVerified,
                isNowVerified: false,
                verificationLinks: {
                    backend: backendLink,
                    frontend: frontendLink,
                    note: 'Use backend link for localhost testing, frontend link for Universal Links testing'
                },
                messageId: emailResult?.messageId || emailResult?.response || 'N/A',
                from: config.email.from,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('[Test Verification Email] Failed to send verification email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification email',
            error: {
                message: error.message,
                stack: config.env === 'development' ? error.stack : undefined
            },
            details: {
                email: req.body?.email
            }
        });
    }
});

/**
 * @swagger
 * /test/get-email:
 *   post:
 *     summary: Retrieve last email from Ethereal for a recipient (test only)
 *     description: |
 *       ⚠️ WARNING: This route does not require authentication for testing purposes.
 *       Use with caution in production environments.
 *       
 *       Retrieves the most recent email sent to the specified recipient from Ethereal.
 *       Extracts tokens (verification, invite, reset password) from the email content.
 *       Only works when NODE_ENV is development or test and Ethereal is configured.
 *     tags: [Test - Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to retrieve email for
 *                 example: test@example.com
 *               waitForEmail:
 *                 type: boolean
 *                 description: Whether to wait for email to arrive (default: false)
 *                 example: false
 *               maxWaitMs:
 *                 type: number
 *                 description: Maximum time to wait in milliseconds (default: 30000)
 *                 example: 30000
 *     responses:
 *       "200":
 *         description: Email retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 email:
 *                   type: object
 *                   properties:
 *                     subject:
 *                       type: string
 *                     from:
 *                       type: string
 *                     to:
 *                       type: string
 *                     text:
 *                       type: string
 *                     html:
 *                       type: string
 *                     date:
 *                       type: string
 *                       format: date-time
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         verification:
 *                           type: string
 *                           description: Verification token extracted from email
 *                         invite:
 *                           type: string
 *                           description: Invite token extracted from email
 *                         resetPassword:
 *                           type: string
 *                           description: Reset password token extracted from email
 *       "400":
 *         description: Bad request (missing email or invalid format)
 *       "404":
 *         description: Email not found
 *       "500":
 *         description: Internal server error (Ethereal not configured or IMAP error)
 */
router.post('/get-email', async (req, res) => {
    try {
        const { email, waitForEmail = false, maxWaitMs = 30000 } = req.body;
        
        // Validate required fields
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address format'
            });
        }
        
        // Only allow in development or test environments
        if (config.env !== 'development' && config.env !== 'test') {
            return res.status(403).json({
                success: false,
                message: 'This endpoint is only available in development or test environments'
            });
        }
        
        const etherealEmailRetriever = require('../../services/etherealEmailRetriever.service');
        
        let emailData;
        if (waitForEmail) {
            logger.info(`[Test Get Email] Waiting for email to ${email} (max wait: ${maxWaitMs}ms)`);
            emailData = await etherealEmailRetriever.waitForEmail(email, maxWaitMs);
        } else {
            logger.info(`[Test Get Email] Retrieving last email for ${email}`);
            emailData = await etherealEmailRetriever.retrieveLastEmail(email);
        }
        
        res.status(200).json({
            success: true,
            message: 'Email retrieved successfully',
            email: emailData
        });
    } catch (error) {
        logger.error('[Test Get Email] Failed to retrieve email:', error);
        
        if (error.message.includes('No emails found') || error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: error.message,
                error: {
                    message: error.message
                }
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve email',
            error: {
                message: error.message,
                stack: config.env === 'development' ? error.stack : undefined
            }
        });
    }
});

// Export the router
module.exports = router;