const express = require('express');
const validate = require('../../middlewares/validate');
const caregiverValidation = require('../../validations/caregiver.validation');
const caregiverController = require('../../controllers/caregiver.controller');
const patientController = require('../../controllers/patient.controller');
const testController = require('../../controllers/test.controller');
const patientValidation = require('../../validations/patient.validation');
const router = express.Router();
const config = require('../../config/config');
const logger = require('../../config/logger');
//const { getFargateIp } = require('../../utils/network.utils');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

// Import services safely
let ariClient, rtpListener, rtpSender, openAIService, channelTracker;
try {
    ariClient = require('../../services/ari.client');
    rtpListener = require('../../services/rtp.listener.service');
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

/**
 * @swagger
 * /test/websocket:
 *   get:
 *     summary: test open ai websocket connection
 *     description: test open ai websocket connection
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: websocket test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 details:
 *                   type: object
 *                 success:
 *                   type: object
 *       "500":
 *         description: Server error
 */
router.get('/websocket', testController.testOpenAIWebSocket);

/**
 * @swagger
 * /test/create-caregiver:
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
 *               orgId:
 *                  type: string
 *                  format: uuid
 *                  description: Organization id
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
 *               orgId: 60d0fe4f3d6a4e0015f8d8d0
 *               name: fake name
 *               email: fake@example.com
 *               password: password1
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Caregiver'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/create-caregiver', validate(caregiverValidation.createCaregiver), caregiverController.createCaregiver);

// ============================================
// ESSENTIAL DEBUGGING ROUTES - CORE SYSTEM STATUS
// ============================================

/**
 * @swagger
 * /test/validate-integration:
 *   get:
 *     summary: Validate complete system integration
 *     description: Runs a comprehensive check of all system components
 *     tags: [Test - System]
 *     responses:
 *       "200":
 *         description: Integration validation results
 */
router.get('/validate-integration', async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        checks: {}
    };

    // 1. Check ARI Connection
    try {
        const instance = ariClient.getAriClientInstance();
        results.checks.ariConnection = {
            connected: instance.isConnected,
            health: await instance.healthCheck()
        };
    } catch (err) {
        results.checks.ariConnection = { error: err.message };
    }

    // 2. Check Public IP Detection
    try {
        const publicIp = await getFargateIp();
        results.checks.publicIp = {
            detected: publicIp,
            isPrivate: publicIp.startsWith('172.') || publicIp.startsWith('10.') || publicIp.startsWith('192.168.'),
            isLocalhost: publicIp === 'localhost'
        };
    } catch (err) {
        results.checks.publicIp = { error: err.message };
    }

    // 3. Check Port Manager
    try {
        const portManager = require('../../services/port.manager.service');
        const stats = portManager.getStats();
        results.checks.portManager = {
            healthy: stats.available > 0,
            stats
        };
    } catch (err) {
        results.checks.portManager = { error: err.message };
    }

    // 4. Check Service Discovery
    try {
        const asteriskResolved = await dns.resolve4('asterisk.myphonefriend.internal');
        results.checks.serviceDiscovery = {
            asteriskResolved: asteriskResolved.length > 0,
            asteriskIp: asteriskResolved[0]
        };
    } catch (err) {
        results.checks.serviceDiscovery = { error: err.message };
    }

    // 5. Check OpenAI Service
    try {
        results.checks.openAI = {
            connections: openAIService.connections.size,
            healthy: true
        };
    } catch (err) {
        results.checks.openAI = { error: err.message };
    }

    // Overall health
    results.healthy = Object.values(results.checks).every(check => 
        !check.error && (check.connected || check.detected || check.healthy || check.asteriskResolved)
    );

    res.json(results);
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
 * /test/openai-connections:
 *   get:
 *     summary: Get OpenAI service connections
 *     description: Returns all active OpenAI realtime connections
 *     tags: [Test - OpenAI]
 *     responses:
 *       "200":
 *         description: OpenAI connections status
 */
router.get('/openai-connections', (req, res) => {
    try {
        const connections = Array.from(openAIService.connections.entries()).map(([callId, conn]) => ({
            callId,
            status: conn.status,
            sessionReady: conn.sessionReady,
            sessionId: conn.sessionId,
            asteriskChannelId: conn.asteriskChannelId,
            audioChunksReceived: conn.audioChunksReceived,
            audioChunksSent: conn.audioChunksSent,
            lastActivity: conn.lastActivity,
            startTime: conn.startTime,
            websocketState: conn.webSocket?.readyState
        }));
        
        res.json({
            totalConnections: connections.length,
            connections
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// /**
//  * @swagger
//  * /test/rtp-debug:
//  *   get:
//  *     summary: Debug RTP configuration and network
//  *     description: Shows current RTP configuration, ports, and network details
//  *     tags: [Test - RTP]
//  *     responses:
//  *       "200":
//  *         description: RTP debug information
//  */
// router.get('/rtp-debug', async (req, res) => {
//     try {
//         const portManager = require('../../services/port.manager.service');
        
//         let publicIp = 'Not available';
//         let ipError = null;
        
//         try {
//             publicIp = await getFargateIp();
//         } catch (err) {
//             publicIp = 'Error getting IP';
//             ipError = err.message;
//         }
        
//         const activeListeners = rtpListener.getAllActiveListeners();
        
//         res.json({
//             network: {
//                 publicIp: publicIp,
//                 ipError: ipError,
//                 isRunningInECS: !!process.env.ECS_CONTAINER_METADATA_URI_V4,
//                 ecsMetadataUri: process.env.ECS_CONTAINER_METADATA_URI_V4 || 'Not set'
//             },
//             portManager: portManager.getStats(),
//             activeListeners,
//             config: {
//                 appRtpPortRange: process.env.APP_RTP_PORT_RANGE || '20001-30000',
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

/**
 * @swagger
 * /test/config:
 *   get:
 *     summary: Get current configuration
 *     description: Returns the current configuration values for Asterisk and RTP
 *     tags: [Test - Configuration]
 *     responses:
 *       "200":
 *         description: Configuration retrieved successfully
 */
router.get('/config', (req, res) => {
    res.json({
        environment: config.env,
        asterisk: {
            enabled: config.asterisk.enabled,
            host: config.asterisk.host,
            url: config.asterisk.url,
            rtpBiancaHost: config.asterisk.rtpBiancaHost,
            rtpAsteriskHost: config.asterisk.rtpAsteriskHost,
        },
        rtpPorts: {
                            appPortRange: process.env.APP_RTP_PORT_RANGE || '20002-30000',
        },
        environmentVariables: {
            NODE_ENV: process.env.NODE_ENV,
            ASTERISK_URL: process.env.ASTERISK_URL,
            RTP_LISTENER_HOST: process.env.RTP_LISTENER_HOST,
            RTP_BIANCA_HOST: process.env.RTP_BIANCA_HOST,
            RTP_ASTERISK_HOST: process.env.RTP_ASTERISK_HOST,
        }
    });
});

/**
 * @swagger
 * /test/ari-connectivity:
 *   get:
 *     summary: Test ARI connectivity
 *     description: Test connection to Asterisk ARI interface
 *     tags: [Test - ARI]
 *     responses:
 *       "200":
 *         description: ARI connectivity test results
 */
router.get('/ari-connectivity', async (req, res) => {
    try {
        const config = require('../../config/config');
        const { url: ariUrl, username, password } = config.asterisk;
        
        const testResults = {
            timestamp: new Date().toISOString(),
            configuration: {
                ariUrl,
                username,
                passwordConfigured: !!password
            },
            tests: {}
        };

        // Test 1: Basic network connectivity
        try {
            const urlObj = new URL(ariUrl);
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
            testResults.tests.networkConnectivity = {
                status: 'success',
                message: `TCP connection to ${urlObj.hostname}:${urlObj.port || 80} successful`
            };
        } catch (err) {
            testResults.tests.networkConnectivity = {
                status: 'failed',
                error: err.message,
                code: err.code
            };
        }

        // Test 2: HTTP connectivity
        try {
            const response = await fetch(`${ariUrl}/ari/api-docs/resources.json`, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
                }
            });
            
            if (response.ok) {
                testResults.tests.httpConnectivity = {
                    status: 'success',
                    message: 'ARI HTTP endpoint responding correctly',
                    statusCode: response.status
                };
            } else {
                testResults.tests.httpConnectivity = {
                    status: 'failed',
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    statusCode: response.status
                };
            }
        } catch (err) {
            testResults.tests.httpConnectivity = {
                status: 'failed',
                error: err.message,
                code: err.code
            };
        }

        // Test 3: ARI client connection
        try {
            const { getAriClientInstance } = require('../../services/ari.client');
            const ariClient = getAriClientInstance();
            
            testResults.tests.ariClient = {
                status: ariClient.isConnected ? 'connected' : 'disconnected',
                retryCount: ariClient.retryCount,
                message: ariClient.isConnected ? 'ARI client is connected' : 'ARI client is not connected'
            };
        } catch (err) {
            testResults.tests.ariClient = {
                status: 'error',
                error: err.message
            };
        }

        res.json(testResults);
        
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// ============================================
// ESSENTIAL DEBUGGING ROUTES - AUDIO DEBUGGING
// ============================================

/**
 * @swagger
 * /test/audio-pipeline-debug:
 *   get:
 *     summary: Debug the complete audio pipeline
 *     description: Shows detailed information about audio flow and conversion steps
 *     tags: [Test - Audio Debug]
 *     parameters:
 *       - in: query
 *         name: callId
 *         schema:
 *           type: string
 *         description: Specific call ID to debug (optional)
 *     responses:
 *       "200":
 *         description: Audio pipeline debug information
 */
router.get('/audio-pipeline-debug', async (req, res) => {
    const { callId } = req.query;
    
    try {
        const debugInfo = {
            timestamp: new Date().toISOString(),
            audioConfiguration: {
                openai: {
                    inputFormat: 'pcm16',
                    outputFormat: 'pcm16',
                    inputSampleRate: 24000,
                    outputSampleRate: 24000
                },
                asterisk: {
                    format: 'ulaw',
                    sampleRate: 8000
                },
                conversionChain: {
                    fromAsterisk: 'ulaw(8kHz) → pcm16(8kHz) → pcm16(24kHz) → OpenAI',
                    fromOpenAI: 'pcm16(24kHz) → pcm16(8kHz) → ulaw(8kHz) → Asterisk'
                }
            },
            activeConnections: {},
            audioStats: {},
            debugFiles: {}
        };

        // Get OpenAI connection info
        const openAIConnections = Array.from(openAIService.connections.entries());
        
        for (const [connId, conn] of openAIConnections) {
            if (!callId || connId === callId) {
                debugInfo.activeConnections[connId] = {
                    status: conn.status,
                    sessionReady: conn.sessionReady,
                    audioChunksReceived: conn.audioChunksReceived,
                    audioChunksSent: conn.audioChunksSent,
                    lastActivity: new Date(conn.lastActivity).toISOString(),
                    debugFilesInitialized: conn._debugFilesInitialized || false,
                    openaiChunkCount: conn._openaiChunkCount || 0
                };

                // Check for debug audio files
                const callAudioDir = path.join(__dirname, '..', '..', 'debug_audio_calls', connId);
                if (fs.existsSync(callAudioDir)) {
                    const files = fs.readdirSync(callAudioDir);
                    debugInfo.debugFiles[connId] = {};
                    
                    files.forEach(file => {
                        const filePath = path.join(callAudioDir, file);
                        const stats = fs.statSync(filePath);
                        debugInfo.debugFiles[connId][file] = {
                            size: stats.size,
                            sizeKB: (stats.size / 1024).toFixed(2),
                            modified: stats.mtime.toISOString()
                        };
                    });
                }

                // Get RTP stats if available
                const callData = channelTracker.getCall(connId) || 
                    channelTracker.findCallByTwilioCallSid(connId);
                    
                if (callData?.rtpPort) {
                    const listener = rtpListener.getListenerForCall(connId);
                    if (listener) {
                        debugInfo.audioStats[connId] = {
                            rtpPort: callData.rtpPort,
                            rtpStats: listener.getStats ? listener.getStats() : 'No stats available'
                        };
                    }
                }
            }
        }

        // Add recommendations based on common issues
        debugInfo.diagnostics = analyzeAudioPipeline(debugInfo);

        res.json(debugInfo);
        
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

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

/**
 * @swagger
 * /test/compare-audio-stages:
 *   get:
 *     summary: Compare audio at different pipeline stages
 *     description: Shows audio characteristics at each conversion stage
 *     tags: [Test - Audio Debug]
 *     parameters:
 *       - in: query
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Audio stage comparison
 */
router.get('/compare-audio-stages', async (req, res) => {
    const { callId } = req.query;
    
    if (!callId) {
        return res.status(400).json({ error: 'callId is required' });
    }

    try {
        const callAudioDir = path.join(__dirname, '..', '..', 'debug_audio_calls', callId);
        
        const stages = {
            callId,
            timestamp: new Date().toISOString(),
            stages: {},
            comparison: {}
        };

        // Define the audio files at each stage
        const audioFiles = [
            { name: 'continuous_from_asterisk_ulaw.ulaw', stage: 'input_from_asterisk', format: 'ulaw', sampleRate: 8000 },
            { name: 'continuous_from_asterisk_pcm8k.raw', stage: 'converted_to_pcm_8k', format: 'pcm16', sampleRate: 8000 },
            { name: 'continuous_from_asterisk_pcm24k.raw', stage: 'resampled_to_24k', format: 'pcm16', sampleRate: 24000 },
            { name: 'output_for_openai.pcm', stage: 'sent_to_openai', format: 'pcm16', sampleRate: 24000 },
            { name: 'continuous_from_openai_pcm24k.raw', stage: 'received_from_openai', format: 'pcm16', sampleRate: 24000 },
            { name: 'continuous_from_openai_pcm8k.raw', stage: 'downsampled_to_8k', format: 'pcm16', sampleRate: 8000 },
            { name: 'continuous_from_openai_ulaw.ulaw', stage: 'converted_to_ulaw', format: 'ulaw', sampleRate: 8000 }
        ];

        for (const file of audioFiles) {
            const filePath = path.join(callAudioDir, file.name);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const expectedBytesPerSecond = file.format === 'ulaw' ? file.sampleRate : file.sampleRate * 2;
                const durationSeconds = stats.size / expectedBytesPerSecond;
                
                stages.stages[file.stage] = {
                    file: file.name,
                    exists: true,
                    size: stats.size,
                    sizeKB: (stats.size / 1024).toFixed(2),
                    format: file.format,
                    sampleRate: file.sampleRate,
                    estimatedDuration: durationSeconds.toFixed(2) + 's',
                    lastModified: stats.mtime.toISOString()
                };
            } else {
                stages.stages[file.stage] = {
                    file: file.name,
                    exists: false
                };
            }
        }

        // Compare sizes to detect issues
        const asteriskIn = stages.stages.input_from_asterisk;
        const openAIOut = stages.stages.received_from_openai;
        
        if (asteriskIn?.exists && openAIOut?.exists) {
            const asteriskDuration = parseFloat(asteriskIn.estimatedDuration);
            const openAIDuration = parseFloat(openAIOut.estimatedDuration);
            
            stages.comparison = {
                inputDuration: asteriskDuration + 's',
                outputDuration: openAIDuration + 's',
                ratio: (openAIDuration / asteriskDuration).toFixed(2),
                analysis: []
            };

            if (openAIDuration < asteriskDuration * 0.1) {
                stages.comparison.analysis.push('OpenAI output is much shorter than input - possible audio processing issue');
            }
            
            if (asteriskIn.size === 0) {
                stages.comparison.analysis.push('No audio received from Asterisk');
            }
            
            if (openAIOut.size === 0) {
                stages.comparison.analysis.push('No audio received from OpenAI');
            }
        }

        res.json(stages);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/download-debug-audio:
 *   get:
 *     summary: Get debug audio files for a call
 *     description: Returns URLs to download debug audio files
 *     tags: [Test - Audio Debug]
 *     parameters:
 *       - in: query
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Debug audio file information
 */
router.get('/download-debug-audio', async (req, res) => {
    const { callId } = req.query;
    
    if (!callId) {
        return res.status(400).json({ error: 'callId is required' });
    }

    try {
        const S3Service = require('../../services/s3.service');
        const result = {
            callId,
            localFiles: {},
            s3Files: []
        };

        // Check local files
        const callAudioDir = path.join(__dirname, '..', '..', 'debug_audio_calls', callId);
        if (fs.existsSync(callAudioDir)) {
            const files = fs.readdirSync(callAudioDir);
            files.forEach(file => {
                const filePath = path.join(callAudioDir, file);
                const stats = fs.statSync(filePath);
                result.localFiles[file] = {
                    size: stats.size,
                    sizeMB: (stats.size / 1024 / 1024).toFixed(2),
                    modified: stats.mtime.toISOString(),
                    path: filePath
                };
            });
        }

        // Check S3 files
        try {
            const s3Keys = [
                `debug-audio/${callId}/caller_to_openai_8khz.wav`,
                `debug-audio/${callId}/openai_to_caller_24khz.wav`
            ];

            for (const key of s3Keys) {
                try {
                    const url = await S3Service.getPresignedUrl(key, 3600);
                    result.s3Files.push({
                        key,
                        url,
                        description: key.includes('caller_to_openai') ? 
                            'Audio from caller to OpenAI (8kHz)' : 
                            'Audio from OpenAI to caller (24kHz)'
                    });
                } catch (err) {
                    // File might not exist
                }
            }
        } catch (err) {
            result.s3Error = err.message;
        }

        // Add conversion instructions
        result.conversionInstructions = {
            pcm24k: 'ffplay -f s16le -ar 24000 -ac 1 continuous_from_openai_pcm24k.raw',
            pcm8k: 'ffplay -f s16le -ar 8000 -ac 1 continuous_from_asterisk_pcm8k.raw',
            ulaw: 'ffplay -f mulaw -ar 8000 -ac 1 continuous_from_asterisk_ulaw.ulaw',
            convertToWav: 'ffmpeg -f s16le -ar 24000 -ac 1 -i input.raw output.wav'
        };

        res.json(result);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/force-audio-commit:
 *   post:
 *     summary: Force OpenAI to commit audio buffer
 *     description: Manually triggers audio buffer commit for debugging
 *     tags: [Test - Audio Debug]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               callId:
 *                 type: string
 *                 required: true
 *     responses:
 *       "200":
 *         description: Commit result
 */
router.post('/force-audio-commit', async (req, res) => {
    const { callId } = req.body;
    
    if (!callId) {
        return res.status(400).json({ error: 'callId is required' });
    }

    try {
        const success = await openAIService.forceCommit(callId);
        
        res.json({
            success,
            message: success ? 'Audio buffer commit sent' : 'Failed to send commit',
            note: 'Check logs for OpenAI response'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/audio-conversion-test:
 *   post:
 *     summary: Test audio conversion chain
 *     description: Tests each step of the audio conversion process
 *     tags: [Test - Audio Debug]
 *     responses:
 *       "200":
 *         description: Audio conversion test results
 */
router.post('/audio-conversion-test', async (req, res) => {
    try {
        const AudioUtils = require('../../api/audio.utils');
        const testResults = {
            timestamp: new Date().toISOString(),
            steps: []
        };

        // Step 1: Create a test tone (1kHz sine wave)
        const sampleRate = 8000;
        const duration = 0.1; // 100ms
        const frequency = 1000; // 1kHz
        const numSamples = Math.floor(sampleRate * duration);
        
        const pcmBuffer = Buffer.alloc(numSamples * 2);
        for (let i = 0; i < numSamples; i++) {
            const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16383;
            pcmBuffer.writeInt16LE(Math.round(sample), i * 2);
        }
        
        testResults.steps.push({
            step: 'Create test PCM',
            success: true,
            details: {
                sampleRate: 8000,
                duration: '100ms',
                frequency: '1kHz',
                bufferSize: pcmBuffer.length,
                samples: numSamples
            }
        });

        // Step 2: Convert to uLaw
        try {
            const ulawBase64 = await AudioUtils.convertPcmToUlaw(pcmBuffer);
            const ulawBuffer = Buffer.from(ulawBase64, 'base64');
            testResults.steps.push({
                step: 'PCM to uLaw conversion',
                success: true,
                details: {
                    inputSize: pcmBuffer.length,
                    outputSize: ulawBuffer.length,
                    compressionRatio: (ulawBuffer.length / pcmBuffer.length).toFixed(2)
                }
            });

            // Step 3: Convert back to PCM
            const pcmBackBuffer = await AudioUtils.convertUlawToPcm(ulawBuffer);
            testResults.steps.push({
                step: 'uLaw to PCM conversion',
                success: true,
                details: {
                    inputSize: ulawBuffer.length,
                    outputSize: pcmBackBuffer.length,
                    matchesOriginal: pcmBackBuffer.length === pcmBuffer.length
                }
            });
        } catch (err) {
            testResults.steps.push({
                step: 'uLaw conversion',
                success: false,
                error: err.message
            });
        }

        // Step 4: Test resampling
        try {
            const pcm24khz = AudioUtils.resamplePcm(pcmBuffer, 8000, 24000);
            testResults.steps.push({
                step: 'Resample 8kHz to 24kHz',
                success: true,
                details: {
                    inputSize: pcmBuffer.length,
                    outputSize: pcm24khz.length,
                    expectedRatio: 3,
                    actualRatio: (pcm24khz.length / pcmBuffer.length).toFixed(2)
                }
            });

            const pcm8khzAgain = AudioUtils.resamplePcm(pcm24khz, 24000, 8000);
            testResults.steps.push({
                step: 'Resample 24kHz to 8kHz',
                success: true,
                details: {
                    inputSize: pcm24khz.length,
                    outputSize: pcm8khzAgain.length,
                    matchesOriginal: pcm8khzAgain.length === pcmBuffer.length
                }
            });
        } catch (err) {
            testResults.steps.push({
                step: 'Resampling',
                success: false,
                error: err.message
            });
        }

        // Save test files
        const testDir = path.join(__dirname, '..', '..', 'debug_audio_calls', 'CONVERSION_TEST');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const testFile = path.join(testDir, `test_${Date.now()}.json`);
        fs.writeFileSync(testFile, JSON.stringify(testResults, null, 2));

        testResults.savedTo = testFile;
        res.json(testResults);

    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

/**
 * @swagger
 * /test/rtp-packet-analysis:
 *   get:
 *     summary: Analyze RTP packet flow and payloads
 *     description: Shows detailed RTP packet information and payload types
 *     tags: [Test - Audio Debug]
 *     parameters:
 *       - in: query
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: RTP packet analysis
 */
router.get('/rtp-packet-analysis', (req, res) => {
    const { callId } = req.query;
    
    if (!callId) {
        return res.status(400).json({ error: 'callId is required' });
    }

    try {
        const listener = rtpListener.getListenerForCall(callId);
        if (!listener) {
            return res.status(404).json({ error: 'No RTP listener found for this call' });
        }

        const stats = listener.getStats();
        
        // Calculate packet rate
        const uptimeSeconds = stats.uptime / 1000;
        const packetRate = uptimeSeconds > 0 ? stats.packetsReceived / uptimeSeconds : 0;
        
        const analysis = {
            callId,
            listener: {
                port: stats.port,
                active: stats.active,
                uptime: stats.uptime,
                stats: {
                    packetsReceived: stats.packetsReceived,
                    packetsSent: stats.packetsSent,
                    invalidPackets: stats.invalidPackets,
                    errors: stats.errors
                },
                rates: {
                    packetsPerSecond: packetRate.toFixed(2),
                    expectedPacketsPerSecond: 50, // 20ms packetization = 50 packets/sec
                    percentageOfExpected: ((packetRate / 50) * 100).toFixed(1)
                }
            },
            issues: []
        };

        // Check for common RTP issues
        if (stats.packetsReceived === 0) {
            analysis.issues.push({
                severity: 'critical',
                issue: 'No RTP packets received',
                possibleCauses: [
                    'Asterisk not sending to correct IP/port',
                    'Firewall blocking UDP traffic',
                    'ExternalMedia not configured correctly'
                ]
            });
        }

        if (stats.invalidPackets > stats.packetsReceived * 0.05) {
            analysis.issues.push({
                severity: 'high',
                issue: `High invalid packet rate: ${((stats.invalidPackets / stats.packetsReceived) * 100).toFixed(1)}%`,
                possibleCauses: [
                    'Non-RTP traffic on the port',
                    'Corrupted packets',
                    'Wrong RTP version or format'
                ]
            });
        }

        if (packetRate < 40 && stats.packetsReceived > 0) {
            analysis.issues.push({
                severity: 'medium',
                issue: `Low packet rate: ${packetRate.toFixed(1)} packets/sec`,
                possibleCauses: [
                    'Network congestion',
                    'Packet loss',
                    'Incorrect packetization time'
                ]
            });
        }

        if (stats.errors > 0) {
            analysis.issues.push({
                severity: 'medium',
                issue: `Processing errors: ${stats.errors}`,
                possibleCauses: [
                    'Invalid audio format',
                    'OpenAI service issues',
                    'Memory or processing issues'
                ]
            });
        }

        res.json(analysis);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ESSENTIAL DEBUGGING ROUTES - TROUBLESHOOTING ACTIONS
// ============================================

/**
 * @swagger
 * /test/test-audio-chain:
 *   post:
 *     summary: Test the complete audio chain with OpenAI
 *     description: Sends test audio through the entire pipeline
 *     tags: [Test - Audio Debug]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               callId:
 *                 type: string
 *                 description: Call ID to test with
 *               testType:
 *                 type: string
 *                 enum: [sine, silence, white_noise]
 *                 default: sine
 *     responses:
 *       "200":
 *         description: Test results
 */
router.post('/test-audio-chain', async (req, res) => {
    const { callId, testType = 'sine' } = req.body;
    
    if (!callId) {
        return res.status(400).json({ error: 'callId is required' });
    }

    try {
        const AudioUtils = require('../../api/audio.utils');
        const result = {
            callId,
            testType,
            steps: []
        };

        // Generate test audio based on type
        let testAudio;
        const sampleRate = 8000;
        const duration = 1; // 1 second
        const numSamples = sampleRate * duration;
        
        switch (testType) {
            case 'sine':
                testAudio = Buffer.alloc(numSamples * 2);
                for (let i = 0; i < numSamples; i++) {
                    const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16383;
                    testAudio.writeInt16LE(Math.round(sample), i * 2);
                }
                break;
            case 'silence':
                testAudio = Buffer.alloc(numSamples * 2, 0);
                break;
            case 'white_noise':
                testAudio = Buffer.alloc(numSamples * 2);
                for (let i = 0; i < numSamples; i++) {
                    const sample = (Math.random() - 0.5) * 32767;
                    testAudio.writeInt16LE(Math.round(sample), i * 2);
                }
                break;
        }

        result.steps.push({
            step: 'Generated test audio',
            details: {
                type: testType,
                duration: `${duration}s`,
                samples: numSamples,
                bufferSize: testAudio.length
            }
        });

        // Convert to uLaw
        const ulawBase64 = await AudioUtils.convertPcmToUlaw(testAudio);
        result.steps.push({
            step: 'Converted to uLaw',
            details: {
                base64Length: ulawBase64.length
            }
        });

        // Send through OpenAI pipeline
        const conn = openAIService.connections.get(callId);
        if (!conn) {
            return res.status(404).json({ error: 'No OpenAI connection found for callId' });
        }

        const beforeChunks = conn.audioChunksReceived || 0;
        
        // Send the audio
        await openAIService.sendAudioChunk(callId, ulawBase64, true);
        
        result.steps.push({
            step: 'Sent to OpenAI',
            details: {
                chunksBeforeSend: beforeChunks,
                chunksAfterSend: conn.audioChunksReceived || 0
            }
        });

        // Wait a bit and check for response
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        result.finalStats = {
            audioChunksReceived: conn.audioChunksReceived || 0,
            audioChunksSent: conn.audioChunksSent || 0,
            openaiChunkCount: conn._openaiChunkCount || 0,
            sessionReady: conn.sessionReady
        };

        res.json(result);

    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

/**
 * @swagger
 * /test/simulate-audio-to-openai:
 *   post:
 *     summary: Send test audio directly to OpenAI
 *     description: Bypasses RTP and sends test audio to verify OpenAI processing
 *     tags: [Test - Audio Debug]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               callId:
 *                 type: string
 *                 required: true
 *               testPattern:
 *                 type: string
 *                 enum: [sine, speech_sample, silence]
 *                 default: sine
 *     responses:
 *       "200":
 *         description: Test result
 */
router.post('/simulate-audio-to-openai', async (req, res) => {
    const { callId, testPattern = 'sine' } = req.body;
    
    if (!callId) {
        return res.status(400).json({ error: 'callId is required' });
    }

    try {
        const conn = openAIService.connections.get(callId);
        if (!conn || !conn.sessionReady) {
            return res.status(400).json({ error: 'OpenAI connection not ready' });
        }

        const AudioUtils = require('../../api/audio.utils');
        let testAudio;

        switch (testPattern) {
            case 'sine':
                // Generate 1 second of 440Hz sine wave at 8kHz
                const samples = 8000;
                testAudio = Buffer.alloc(samples * 2);
                for (let i = 0; i < samples; i++) {
                    const sample = Math.sin(2 * Math.PI * 440 * i / 8000) * 16383;
                    testAudio.writeInt16LE(Math.round(sample), i * 2);
                }
                break;
            
            case 'silence':
                testAudio = Buffer.alloc(8000 * 2, 0); // 1 second of silence
                break;
            
            case 'speech_sample':
                // This would ideally be a real speech sample
                // For now, use a complex waveform
                testAudio = Buffer.alloc(8000 * 2);
                for (let i = 0; i < 8000; i++) {
                    const sample = Math.sin(2 * Math.PI * 200 * i / 8000) * 8000 +
                                 Math.sin(2 * Math.PI * 500 * i / 8000) * 4000 +
                                 Math.sin(2 * Math.PI * 1200 * i / 8000) * 2000;
                    testAudio.writeInt16LE(Math.round(sample), i * 2);
                }
                break;
        }

        // Convert to uLaw
        const ulawBase64 = await AudioUtils.convertPcmToUlaw(testAudio);
        
        // Track before/after stats
        const before = {
            chunksReceived: conn.audioChunksReceived,
            chunksSent: conn.audioChunksSent,
            openaiChunks: conn._openaiChunkCount || 0
        };

        // Send to OpenAI
        await openAIService.sendAudioChunk(callId, ulawBase64, true);
        
        // Force commit
        await openAIService.forceCommit(callId);

        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 3000));

        const after = {
            chunksReceived: conn.audioChunksReceived,
            chunksSent: conn.audioChunksSent,
            openaiChunks: conn._openaiChunkCount || 0
        };

        res.json({
            success: true,
            testPattern,
            audioSize: testAudio.length,
            before,
            after,
            changes: {
                chunksSentToOpenAI: after.chunksSent - before.chunksSent,
                responseFromOpenAI: after.openaiChunks - before.openaiChunks
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

/**
 * @swagger
 * /test/cleanup-all:
 *   post:
 *     summary: Cleanup all connections
 *     description: Cleans up all active connections and resets services
 *     tags: [Test - Maintenance]
 *     responses:
 *       "200":
 *         description: Cleanup completed
 */
router.post('/cleanup-all', async (req, res) => {
    try {
        // Clean up all tracked calls
        const calls = Array.from(channelTracker.calls.keys());
        for (const callId of calls) {
            channelTracker.removeCall(callId);
        }
        
        // Clean up RTP sender
        rtpSender.cleanupAll();
        
        // Clean up OpenAI connections
        await openAIService.disconnectAll();
        
        // Clear SSRC mappings -- does not exist anymore
        const clearedCount = 0;
        
        res.json({
            success: true,
            cleaned: {
                calls: calls.length,
                ssrcMappings: clearedCount,
                message: 'All connections cleaned up'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/network-connectivity:
 *   get:
 *     summary: Test network connectivity between services
 *     description: Tests UDP connectivity from Asterisk to app RTP ports
 *     tags: [Test - Network]
 *     responses:
 *       "200":
 *         description: Network connectivity test results
 */
router.get('/network-connectivity', async (req, res) => {
    try {
        const dgram = require('dgram');
        const dns = require('dns').promises;
        
        const result = {
            timestamp: new Date().toISOString(),
            tests: {},
            recommendations: []
        };

        // Test 1: Get our public and private IPs
        try {
            const publicIp = await getFargateIp();
            result.tests.ipDetection = {
                success: true,
                publicIp: publicIp,
                isPrivate: publicIp.startsWith('172.') || publicIp.startsWith('10.'),
                taskMetadata: process.env.ECS_CONTAINER_METADATA_URI_V4 ? 'Available' : 'Not Available'
            };
        } catch (err) {
            result.tests.ipDetection = { success: false, error: err.message };
        }

        // Test 2: Resolve Asterisk via service discovery
        try {
            const asteriskIps = await dns.resolve4('asterisk.myphonefriend.internal');
            result.tests.serviceDiscovery = {
                success: asteriskIps.length > 0,
                asteriskPrivateIp: asteriskIps[0],
                resolvedIps: asteriskIps
            };
        } catch (err) {
            result.tests.serviceDiscovery = { success: false, error: err.message };
        }

        // Test 3: Check if we can bind to RTP ports
        const testPorts = [16384, 16385, 16386];
        for (const port of testPorts) {
            try {
                const socket = dgram.createSocket('udp4');
                await new Promise((resolve, reject) => {
                    socket.bind(port, '0.0.0.0', (err) => {
                        if (err) reject(err);
                        else {
                            socket.close();
                            resolve();
                        }
                    });
                });
                
                result.tests[`port_${port}_bind`] = { success: true, port };
            } catch (err) {
                result.tests[`port_${port}_bind`] = { 
                    success: false, 
                    port, 
                    error: err.message,
                    possibleCause: err.code === 'EADDRINUSE' ? 'Port already in use' : 'Permission denied'
                };
            }
        }

        // Test 4: Test UDP connectivity to Asterisk (if we can resolve it)
        if (result.tests.serviceDiscovery?.success) {
            const asteriskIp = result.tests.serviceDiscovery.asteriskPrivateIp;
            
            try {
                const testSocket = dgram.createSocket('udp4');
                const testMessage = Buffer.from('RTP_CONNECTIVITY_TEST');
                
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        testSocket.close();
                        reject(new Error('Timeout - no response from Asterisk'));
                    }, 2000);
                    
                    testSocket.on('message', (msg, rinfo) => {
                        clearTimeout(timeout);
                        testSocket.close();
                        resolve({ response: msg.toString(), from: rinfo });
                    });
                    
                    testSocket.bind(0, () => {
                        const localPort = testSocket.address().port;
                        // Send test packet to Asterisk ARI port (this won't work but tests routing)
                        testSocket.send(testMessage, 8088, asteriskIp, (err) => {
                            if (err) {
                                clearTimeout(timeout);
                                testSocket.close();
                                reject(err);
                            }
                            // If no response after 2 seconds, that's expected but shows routing works
                            setTimeout(() => {
                                clearTimeout(timeout);
                                testSocket.close();
                                resolve({ status: 'sent_but_no_response', note: 'Normal for HTTP port test' });
                            }, 500);
                        });
                    });
                });
                
                result.tests.udpConnectivity = { success: true, note: 'UDP routing appears functional' };
            } catch (err) {
                result.tests.udpConnectivity = { 
                    success: false, 
                    error: err.message,
                    likelyCause: 'Security group blocking UDP traffic'
                };
            }
        }

        // Test 5: Check current port allocations
        try {
            const portManager = require('../../services/port.manager.service');
            const stats = portManager.getStats();
            result.tests.portManager = {
                success: true,
                ...stats,
                hasAvailablePorts: stats.available > 0
            };
        } catch (err) {
            result.tests.portManager = { success: false, error: err.message };
        }

        // Generate recommendations based on test results
        if (!result.tests.serviceDiscovery?.success) {
            result.recommendations.push({
                priority: 'HIGH',
                issue: 'Cannot resolve Asterisk via service discovery',
                solution: 'Check AWS Cloud Map configuration and VPC DNS resolution'
            });
        }

        if (result.tests.udpConnectivity?.success === false) {
            result.recommendations.push({
                priority: 'CRITICAL',
                issue: 'UDP connectivity blocked between Fargate and EC2',
                solution: 'Fix security group rules - use CIDR blocks instead of security group references for Fargate'
            });
        }

        if (result.tests.ipDetection?.isPrivate) {
            result.recommendations.push({
                priority: 'MEDIUM',
                issue: 'App is using private IP for ExternalMedia',
                solution: 'Ensure Asterisk can route to the private IP, or use public IP with proper NAT'
            });
        }

        const failedTests = Object.values(result.tests).filter(test => test.success === false).length;
        result.overallHealth = failedTests === 0 ? 'HEALTHY' : failedTests < 3 ? 'DEGRADED' : 'CRITICAL';

        res.json(result);

    } catch (err) {
        res.status(500).json({ 
            error: err.message, 
            note: 'This test helps diagnose security group and network connectivity issues'
        });
    }
});

/**
 * @swagger
 * /test/security-group-analysis:
 *   get:
 *     summary: Analyze security group configuration
 *     description: Checks if security groups are properly configured for Fargate
 *     tags: [Test - Network]
 *     responses:
 *       "200":
 *         description: Security group analysis
 */
router.get('/security-group-analysis', async (req, res) => {
    try {
        const result = {
            timestamp: new Date().toISOString(),
            analysis: {},
            issues: [],
            architecture: {
                app: 'AWS Fargate (ECS)',
                asterisk: 'EC2 Instance',
                connectivity: 'RTP over UDP',
                securityGroupApproach: 'Should use CIDR blocks for Fargate ↔ EC2'
            }
        };

        // Check environment details
        result.analysis.environment = {
            isECS: !!process.env.ECS_CONTAINER_METADATA_URI_V4,
            taskMetadata: process.env.ECS_CONTAINER_METADATA_URI_V4,
            region: process.env.AWS_REGION,
            publicIpConfig: process.env.BIANCA_PUBLIC_IP
        };

        // Get our task's network details if in ECS
        if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
            try {
                const fetch = require('node-fetch');
                const taskMetadata = await fetch(process.env.ECS_CONTAINER_METADATA_URI_V4 + '/task');
                const taskData = await taskMetadata.json();
                
                result.analysis.taskNetwork = {
                    taskArn: taskData.TaskARN,
                    taskDefinitionFamily: taskData.Family,
                    taskDefinitionRevision: taskData.Revision,
                    availabilityZone: taskData.AvailabilityZone
                };

                // Get network details
                const taskStatsResponse = await fetch(process.env.ECS_CONTAINER_METADATA_URI_V4 + '/task/stats');
                const taskStats = await taskStatsResponse.json();
                
                result.analysis.networkMode = 'awsvpc'; // Fargate always uses awsvpc
                
            } catch (err) {
                result.analysis.metadataError = err.message;
            }
        }

        // Check expected vs actual network configuration
        result.analysis.expectedConfig = {
            fargateToEC2: 'Requires CIDR-based security group rules',
            securityGroupRule: 'source should be Asterisk private IP/32, not security group ID',
            udpPorts: '20002-30000 for RTP traffic',
            direction: 'Asterisk → Fargate for audio input'
        };

        // Common issues with Fargate + EC2 setup
        result.issues.push({
            category: 'Security Groups',
            issue: 'Using source_security_group_id for Fargate connectivity',
            description: 'Security group references only work for EC2 ↔ EC2. Fargate needs CIDR-based rules.',
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

        result.issues.push({
            category: 'IP Configuration',
            issue: 'ExternalMedia destination IP',
            description: 'Asterisk needs to know where to send RTP. Check if using public or private IP.',
            check: 'Verify getFargateIp() returns the IP that Asterisk can reach'
        });

        res.json(result);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/port-connectivity:
 *   post:
 *     summary: Test specific port connectivity
 *     description: Tests if a specific UDP port can receive data
 *     tags: [Test - Network]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               port:
 *                 type: number
 *                 description: UDP port to test
 *               duration:
 *                 type: number
 *                 default: 5
 *                 description: How long to listen (seconds)
 *     responses:
 *       "200":
 *         description: Port connectivity test results
 */
router.post('/port-connectivity', async (req, res) => {
    const { port = 16384, duration = 5 } = req.body;
    
    if (!port || port < 1024 || port > 65535) {
        return res.status(400).json({ error: 'Invalid port number' });
    }

    try {
        const dgram = require('dgram');
        const socket = dgram.createSocket('udp4');
        
        const result = {
            port,
            duration,
            startTime: new Date().toISOString(),
            packetsReceived: 0,
            packets: [],
            errors: []
        };

        // Set up packet listener
        socket.on('message', (msg, rinfo) => {
            result.packetsReceived++;
            result.packets.push({
                timestamp: new Date().toISOString(),
                from: `${rinfo.address}:${rinfo.port}`,
                size: msg.length,
                preview: msg.length > 0 ? msg.subarray(0, Math.min(16, msg.length)).toString('hex') : ''
            });
        });

        socket.on('error', (err) => {
            result.errors.push({
                timestamp: new Date().toISOString(),
                error: err.message
            });
        });

        // Bind to the port
        await new Promise((resolve, reject) => {
            socket.bind(port, '0.0.0.0', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        result.bound = true;
        result.address = socket.address();

        // Wait for the specified duration
        await new Promise(resolve => setTimeout(resolve, duration * 1000));

        socket.close();
        result.endTime = new Date().toISOString();

        // Analysis
        result.analysis = {
            receivedTraffic: result.packetsReceived > 0,
            avgPacketSize: result.packetsReceived > 0 
                ? result.packets.reduce((sum, p) => sum + p.size, 0) / result.packetsReceived 
                : 0,
            uniqueSources: [...new Set(result.packets.map(p => p.from))].length,
            recommendation: result.packetsReceived === 0 
                ? 'No packets received - check security groups and Asterisk configuration'
                : `Received ${result.packetsReceived} packets - connectivity appears working`
        };

        res.json(result);

    } catch (err) {
        res.status(500).json({ 
            error: err.message,
            port,
            note: 'This test directly binds to the UDP port to check for incoming traffic'
        });
    }
});


/**
 * @swagger
 * /test/patient/conversations:
 *   get:
 *     summary: Get conversations by patient
 *     description: Logged in Patients can fetch only their own conversation information. Only admins can fetch other Patients' conversations.
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Conversation'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/patient/conversations')
  .get(
    validate(patientValidation.getConversationsByPatient),
    testController.getConversationsByPatient
  );

/**
 * @swagger
 * /test/email:
 *   post:
 *     summary: Test email functionality with Amazon SES
 *     description: Sends a test email to verify Amazon SES configuration is working
 *     tags: [Test]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 default: "negascout@gmail.com"
 *                 description: Email address to send test email to
 *               subject:
 *                 type: string
 *                 default: "Test Email from Bianca App"
 *                 description: Subject line for the test email
 *               message:
 *                 type: string
 *                 default: "This is a test email to verify Amazon SES is working correctly."
 *                 description: Message content for the test email
 *     responses:
 *       "200":
 *         description: Email test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 emailInfo:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                     to:
 *                       type: string
 *                     from:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     previewUrl:
 *                       type: string
 *                       description: Preview URL for development environment (Ethereal)
 *       "400":
 *         description: Bad request
 *       "500":
 *         description: Email sending failed
 */
router.post('/email', async (req, res) => {
    try {
        const { 
            to = 'negascout@gmail.com', 
            subject = 'Test Email from Bianca App', 
            message = 'This is a test email to verify Amazon SES is working correctly.' 
        } = req.body;

        // Validate email address
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email address format'
            });
        }

        // Import email service
        const emailService = require('../../services/email.service');

        // Create HTML version of the email
        const htmlMessage = `
            <html>
                <body>
                    <h2>Test Email from Bianca App</h2>
                    <p><strong>Message:</strong> ${message}</p>
                    <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
                    <p><strong>Environment:</strong> ${config.env}</p>
                    <p><strong>From:</strong> ${config.email?.from || 'Not configured'}</p>
                    <hr>
                    <p><em>This is an automated test email to verify email functionality.</em></p>
                </body>
            </html>
        `;

        // Send the email
        const emailInfo = await emailService.sendEmail(to, subject, message, htmlMessage);

        // Prepare response
        const response = {
            success: true,
            message: 'Test email sent successfully',
            emailInfo: {
                messageId: emailInfo.messageId,
                to: to,
                from: config.email?.from || 'Not configured',
                subject: subject,
                environment: config.env
            }
        };

        // Add preview URL for development environment
        if (config.env !== 'production' && config.env !== 'test') {
            const nodemailer = require('nodemailer');
            const previewUrl = nodemailer.getTestMessageUrl(emailInfo);
            if (previewUrl) {
                response.emailInfo.previewUrl = previewUrl;
            }
        }

        logger.info(`Test email sent successfully to ${to}`, response.emailInfo);
        res.json(response);

    } catch (error) {
        logger.error('Failed to send test email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test email',
            details: error.message,
            environment: config.env,
            emailConfig: {
                from: config.email?.from || 'Not configured',
                sesRegion: config.email?.ses?.region || 'Not configured'
            }
        });
    }
});

// Export the router
module.exports = router;