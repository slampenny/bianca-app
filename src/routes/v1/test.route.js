const express = require('express');
const validate = require('../../middlewares/validate');
const caregiverValidation = require('../../validations/caregiver.validation');
const caregiverController = require('../../controllers/caregiver.controller');
const testController = require('../../controllers/test.controller');
const router = express.Router();
const config = require('../../config/config');
const logger = require('../../config/logger');
const { getFargateIp } = require('../../utils/network.utils');
const dns = require('dns').promises;

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
// YOUR ORIGINAL TEST ROUTES
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
 * /test/ecs-metadata:
 *   get:
 *     summary: Debug ECS metadata
 *     description: Shows ECS container and task metadata for debugging
 *     tags: [Test - RTP]
 *     responses:
 *       "200":
 *         description: ECS metadata retrieved successfully
 */
router.get('/ecs-metadata', async (req, res) => {
    if (!process.env.ECS_CONTAINER_METADATA_URI_V4) {
        return res.json({ error: 'Not running in ECS' });
    }
    
    try {
        // Get container metadata
        const containerResponse = await fetch(process.env.ECS_CONTAINER_METADATA_URI_V4);
        const containerData = await containerResponse.json();
        
        // Get task metadata
        const taskResponse = await fetch(`${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`);
        const taskData = await taskResponse.json();
        
        res.json({
            container: {
                Networks: containerData.Networks,
                TaskARN: containerData.TaskARN
            },
            task: {
                Attachments: taskData.Attachments,
                Containers: taskData.Containers?.map(c => ({
                    Name: c.Name,
                    NetworkInterfaces: c.NetworkInterfaces
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/rtp-debug:
 *   get:
 *     summary: Debug RTP configuration and network
 *     description: Shows current RTP configuration, ports, and network details
 *     tags: [Test - RTP]
 *     responses:
 *       "200":
 *         description: RTP debug information
 */
router.get('/rtp-debug', async (req, res) => {
    try {
        const portManager = require('../../services/port.manager.service');
        const { getFargateIp } = require('../../utils/network.utils');
        
        // Get public IP with better error handling
        let publicIp = 'Not available';
        let ipError = null;
        
        try {
            // Make sure we await the promise
            publicIp = await getFargateIp();
        } catch (err) {
            publicIp = 'Error getting IP';
            ipError = err.message;
        }
        
        // Get active listeners
        const activeListeners = rtpListener.getAllActiveListeners();
        
        res.json({
            network: {
                publicIp: publicIp, // This should now be a string
                ipError: ipError,   // Add error details if any
                isRunningInECS: !!process.env.ECS_CONTAINER_METADATA_URI_V4,
                ecsMetadataUri: process.env.ECS_CONTAINER_METADATA_URI_V4 || 'Not set'
            },
            portManager: portManager.getStats(),
            activeListeners,
            config: {
                appRtpPortRange: process.env.APP_RTP_PORT_RANGE || 'Not set',
                rtpListenerHost: process.env.RTP_LISTENER_HOST || 'Not set',
                asteriskUrl: config.asterisk.url,
                asteriskPublicIp: config.asterisk.publicIp || 'Not set'
            },
            environment: {
                AWS_REGION: process.env.AWS_REGION,
                NODE_ENV: process.env.NODE_ENV,
                RTP_PORT_RANGE: process.env.RTP_PORT_RANGE
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

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
// NEW DEBUGGING TEST ROUTES
// ============================================

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 environment:
 *                   type: string
 *                 asterisk:
 *                   type: object
 *                 rtpPorts:
 *                   type: object
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
            appPortRange: process.env.APP_RTP_PORT_RANGE || '16384-16484',
            // Remove listenerPort and senderPort
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
 * /test/dns:
 *   get:
 *     summary: Test DNS resolution
 *     description: Tests DNS resolution for all configured hostnames
 *     tags: [Test - Network]
 *     responses:
 *       "200":
 *         description: DNS resolution results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       hostname:
 *                         type: string
 *                       resolved:
 *                         type: boolean
 *                       addresses:
 *                         type: array
 *                         items:
 *                           type: string
 *                       error:
 *                         type: string
 */
router.get('/dns', async (req, res) => {
    const hostnames = [
        config.asterisk.host,
        config.asterisk.rtpBiancaHost,
        config.asterisk.rtpAsteriskHost,
        'asterisk.myphonefriend.internal',
        'bianca-app.myphonefriend.internal'
    ];

    const results = [];
    
    for (const hostname of hostnames) {
        if (!hostname) continue;
        
        try {
            const addresses = await dns.resolve4(hostname);
            results.push({
                hostname,
                resolved: true,
                addresses,
                error: null
            });
        } catch (err) {
            results.push({
                hostname,
                resolved: false,
                addresses: [],
                error: err.message
            });
        }
    }

    res.json({ results });
});

/**
 * @swagger
 * /test/ari-status:
 *   get:
 *     summary: Get ARI client status
 *     description: Returns the current status of the ARI client connection
 *     tags: [Test - Asterisk]
 *     responses:
 *       "200":
 *         description: ARI status retrieved successfully
 */
router.get('/ari-status', async (req, res) => {
    try {
        const instance = ariClient.getAriClientInstance();
        const health = await instance.healthCheck();
        
        res.json({
            connected: instance.isConnected,
            health,
            retryCount: instance.retryCount,
            config: {
                url: config.asterisk.url,
                username: config.asterisk.username,
                stasisApp: instance.CONFIG?.STASIS_APP_NAME
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/ari-test-connection:
 *   post:
 *     summary: Test ARI connection
 *     description: Attempts to connect to Asterisk ARI and list applications
 *     tags: [Test - Asterisk]
 *     responses:
 *       "200":
 *         description: Connection test results
 */
router.post('/ari-test-connection', async (req, res) => {
    try {
        const instance = ariClient.getAriClientInstance();
        
        if (!instance.isConnected) {
            return res.status(503).json({ 
                error: 'ARI client not connected',
                suggestion: 'Try restarting the service or check Asterisk connectivity'
            });
        }

        // Try to list applications
        const apps = await instance.client.applications.list();
        
        res.json({
            success: true,
            applications: apps.map(app => ({
                name: app.name,
                bridge_ids: app.bridge_ids,
                channel_ids: app.channel_ids,
                device_names: app.device_names,
                endpoint_ids: app.endpoint_ids
            }))
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: err.message,
            stack: err.stack
        });
    }
});

/**
 * @swagger
 * /test/rtp-listener-status:
 *   get:
 *     summary: Get RTP listener status
 *     description: Returns detailed status of the RTP listener service
 *     tags: [Test - RTP]
 *     responses:
 *       "200":
 *         description: RTP listener status
 */
router.get('/rtp-listener-status', (req, res) => {
    try {
        const activeListeners = rtpListener.getAllActiveListeners();
        
        res.json({
            activeListenerCount: Object.keys(activeListeners).length,
            listeners: activeListeners,
            // Remove the config.listenPort reference
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/rtp-sender-status:
 *   get:
 *     summary: Get RTP sender status
 *     description: Returns detailed status of the RTP sender service
 *     tags: [Test - RTP]
 *     responses:
 *       "200":
 *         description: RTP sender status
 */
router.get('/rtp-sender-status', (req, res) => {
    try {
        const status = rtpSender.getStatus();
        const health = rtpSender.healthCheck();
        
        res.json({
            health,
            status
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
            allocatedRtpPort: data.rtpPort,  // ADD THIS - shows the allocated port
            isReadStreamReady: data.isReadStreamReady,
            isWriteStreamReady: data.isWriteStreamReady,
            // Remove SSRC-related fields
            // Remove snoopMethod field (outdated)
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

/**
 * @swagger
 * /test/send-test-rtp:
 *   post:
 *     summary: Send test RTP packet
 *     description: Sends a test RTP packet to the RTP listener
 *     tags: [Test - RTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetHost:
 *                 type: string
 *                 default: "localhost"
 *               targetPort:
 *                 type: number
 *                 default: 16384
 *               ssrc:
 *                 type: number
 *                 default: 12345
 *     responses:
 *       "200":
 *         description: Test packet sent
 */
router.post('/send-test-rtp', (req, res) => {
    const dgram = require('dgram');
    const { targetHost = 'localhost', targetPort = 16384, ssrc = 12345 } = req.body;
    
    try {
        // Create a simple RTP packet
        const rtpHeader = Buffer.alloc(12);
        rtpHeader[0] = 0x80; // Version 2, no padding, no extension, no CSRC
        rtpHeader[1] = 0; // Marker = 0, Payload type = 0 (PCMU)
        rtpHeader.writeUInt16BE(1, 2); // Sequence number
        // Use a valid 32-bit timestamp (wrap around using unsigned 32-bit arithmetic)
        const timestamp = Math.floor(Date.now() / 1000 * 8000) >>> 0; // Convert to RTP timestamp units and ensure 32-bit
        rtpHeader.writeUInt32BE(timestamp, 4); // Timestamp
        rtpHeader.writeUInt32BE(ssrc >>> 0, 8); // SSRC (ensure 32-bit)
        
        // Add some dummy payload
        const payload = Buffer.from('test audio data');
        const packet = Buffer.concat([rtpHeader, payload]);
        
        const socket = dgram.createSocket('udp4');
        socket.send(packet, targetPort, targetHost, (err) => {
            socket.close();
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ 
                    success: true,
                    packet: {
                        targetHost,
                        targetPort,
                        ssrc,
                        size: packet.length
                    }
                });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/simulate-call-setup:
 *   post:
 *     summary: Simulate call setup
 *     description: Manually sets up tracking for a test call
 *     tags: [Test - Call Tracking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               asteriskChannelId:
 *                 type: string
 *                 default: "test-channel-123"
 *               twilioCallSid:
 *                 type: string
 *                 default: "CA-test-123"
 *     responses:
 *       "200":
 *         description: Test call setup
 */
router.post('/simulate-call-setup', (req, res) => {
    const { asteriskChannelId = 'test-channel-123', twilioCallSid = 'CA-test-123' } = req.body;
    
    try {
        // Add a test call to the tracker
        channelTracker.addCall(asteriskChannelId, {
            twilioCallSid,
            state: 'external_media_read_active',
            awaitingSsrcForRtp: true,
            expectingRtpChannel: true
        });
        
        res.json({
            success: true,
            call: channelTracker.getCall(asteriskChannelId)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/test-udp-connectivity:
 *   post:
 *     summary: Test UDP connectivity
 *     description: Tests if UDP packets can reach the RTP listener from a specific host
 *     tags: [Test - Network]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromHost:
 *                 type: string
 *                 description: Host to test connectivity from (requires SSH access)
 *                 default: "asterisk.myphonefriend.internal"
 *     responses:
 *       "200":
 *         description: Connectivity test instructions
 */
router.post('/test-udp-connectivity', async (req, res) => {
    res.json({
        instructions: `UDP connectivity test:`,
        note: 'With one-port-per-call architecture, you need an active call first',
        steps: [
            '1. Make a test call',
            '2. Check /test/channel-tracker to see the allocated port',
            '3. SSH into Asterisk',
            '4. Run: echo "test" | nc -u [FARGATE_IP] [ALLOCATED_PORT]'
        ]
    });
});

/**
 * @swagger
 * /test/test-openai-audio:
 *   post:
 *     summary: Test OpenAI audio processing
 *     description: Sends test audio to OpenAI for a specific call
 *     tags: [Test - OpenAI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               callId:
 *                 type: string
 *                 description: Call ID or Twilio SID
 *               testMessage:
 *                 type: string
 *                 default: "Hello, this is a test"
 *     responses:
 *       "200":
 *         description: Audio sent to OpenAI
 */
router.post('/test-openai-audio', async (req, res) => {
    const { callId, testMessage = "Hello, this is a test" } = req.body;
    
    if (!callId) {
        return res.status(400).json({ error: 'callId is required' });
    }
    
    try {
        // Check if OpenAI connection exists
        const conn = openAIService.connections.get(callId);
        if (!conn) {
            return res.status(404).json({ error: 'No OpenAI connection found for this callId' });
        }
        
        // Send a test text message
        await openAIService.sendTextMessage(callId, testMessage);
        
        res.json({
            success: true,
            message: 'Test message sent to OpenAI',
            connectionStatus: conn.status,
            sessionReady: conn.sessionReady
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        
        // Clear SSRC mappings
        const clearedCount = rtpListener.clearAllSsrcMappings();
        
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
 * /test/network-debug:
 *   get:
 *     summary: Debug network configuration
 *     description: Shows detailed network information including public IP detection
 *     tags: [Test - Network]
 *     responses:
 *       "200":
 *         description: Network debug information
 */
router.get('/network-debug', async (req, res) => {
    try {
        const { getNetworkDebugInfo } = require('../../utils/network.utils');
        const debugInfo = await getNetworkDebugInfo();
        res.json(debugInfo);
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

/**
 * @swagger
 * /test/ari-websocket:
 *   get:
 *     summary: Test ARI WebSocket connection
 *     description: Tests the WebSocket connection to Asterisk ARI for real-time events
 *     tags: [Test - Asterisk]
 *     responses:
 *       "200":
 *         description: WebSocket test results
 */
router.get('/test/ari-websocket', async (req, res) => {
    try {
        const WebSocket = require('ws');
        const testResults = {
            httpConnection: false,
            wsConnection: false,
            wsUrl: null,
            events: [],
            error: null
        };

        // First test HTTP connection
        const instance = ariClient.getAriClientInstance();
        testResults.httpConnection = instance.isConnected;
        
        if (!testResults.httpConnection) {
            throw new Error('ARI HTTP connection not established');
        }

        // Build WebSocket URL
        const ariUrl = config.asterisk.url;
        const wsUrl = ariUrl.replace('http://', 'ws://').replace('https://', 'wss://');
        testResults.wsUrl = `${wsUrl}/ari/events?api_key=${config.asterisk.username}:${config.asterisk.password}&app=${instance.CONFIG?.STASIS_APP_NAME || 'myphonefriend'}`;

        // Test WebSocket connection
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(testResults.wsUrl);
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket connection timeout'));
            }, 5000);

            ws.on('open', () => {
                testResults.wsConnection = true;
                clearTimeout(timeout);
            });

            ws.on('message', (data) => {
                try {
                    const event = JSON.parse(data);
                    testResults.events.push({
                        type: event.type,
                        timestamp: new Date().toISOString()
                    });
                } catch (e) {
                    // Ignore parse errors
                }
            });

            ws.on('error', (error) => {
                testResults.error = error.message;
                clearTimeout(timeout);
                reject(error);
            });

            ws.on('close', () => {
                clearTimeout(timeout);
                resolve();
            });

            // Give it 3 seconds to collect some events
            setTimeout(() => {
                ws.close();
                resolve();
            }, 3000);
        }).catch(err => {
            testResults.error = err.message;
        });

        res.json(testResults);
    } catch (err) {
        res.status(500).json({ 
            error: err.message,
            suggestion: 'Make sure Asterisk ARI WebSocket is enabled and accessible'
        });
    }
});

/**
 * @swagger
 * /test/simulate-rtp-flow:
 *   post:
 *     summary: Simulate complete RTP flow
 *     description: Tests the complete RTP audio flow including port allocation
 *     tags: [Test - RTP]
 *     responses:
 *       "200":
 *         description: RTP flow test results
 */
router.post('/test/simulate-rtp-flow', async (req, res) => {
    const dgram = require('dgram');
    const testCallId = `test-${Date.now()}`;
    let allocatedPort = null;
    
    try {
        const portManager = require('../../services/port.manager.service');
        const results = {
            portAllocation: false,
            listenerStarted: false,
            packetSent: false,
            packetReceived: false,
            errors: []
        };

        // Step 1: Allocate port
        allocatedPort = portManager.acquirePort(testCallId, {
            asteriskChannelId: testCallId,
            twilioCallSid: `CA-test-${Date.now()}`
        });
        
        if (!allocatedPort) {
            throw new Error('Failed to allocate port');
        }
        results.portAllocation = true;
        results.allocatedPort = allocatedPort;

        // Step 2: Start RTP listener
        await rtpListener.startRtpListenerForCall(allocatedPort, testCallId, testCallId);
        results.listenerStarted = true;

        // Step 3: Wait a bit for listener to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 4: Send test RTP packet
        const publicIp = await getFargateIp();
        const rtpHeader = Buffer.alloc(12);
        rtpHeader[0] = 0x80; // V=2, P=0, X=0, CC=0
        rtpHeader[1] = 0; // M=0, PT=0 (PCMU)
        rtpHeader.writeUInt16BE(1, 2); // Sequence
        rtpHeader.writeUInt32BE(Date.now() & 0xFFFFFFFF, 4); // Timestamp
        rtpHeader.writeUInt32BE(0x12345678, 8); // SSRC
        
        const payload = Buffer.from('test audio payload');
        const packet = Buffer.concat([rtpHeader, payload]);
        
        const socket = dgram.createSocket('udp4');
        await new Promise((resolve, reject) => {
            socket.send(packet, allocatedPort, publicIp === 'localhost' ? 'localhost' : '127.0.0.1', (err) => {
                socket.close();
                if (err) reject(err);
                else resolve();
            });
        });
        results.packetSent = true;

        // Step 5: Check if packet was received (check listener stats)
        await new Promise(resolve => setTimeout(resolve, 500));
        const listenerStats = rtpListener.getListenerForCall(testCallId)?.getStats();
        results.packetReceived = listenerStats?.packetsReceived > 0;
        results.listenerStats = listenerStats;

        // Cleanup
        rtpListener.stopRtpListenerForCall(testCallId);
        portManager.releasePort(allocatedPort, testCallId);

        res.json({
            success: results.packetReceived,
            results,
            publicIp
        });

    } catch (err) {
        // Cleanup on error
        if (allocatedPort) {
            try {
                rtpListener.stopRtpListenerForCall(testCallId);
                const portManager = require('../../services/port.manager.service');
                portManager.releasePort(allocatedPort, testCallId);
            } catch (cleanupErr) {
                // Ignore cleanup errors
            }
        }
        
        res.status(500).json({ 
            error: err.message,
            stack: err.stack
        });
    }
});

/**
 * @swagger
 * /test/port-audit:
 *   get:
 *     summary: Audit port allocations
 *     description: Check for orphaned ports and port leaks
 *     tags: [Test - Maintenance]
 *     responses:
 *       "200":
 *         description: Port audit results
 */
router.get('/test/port-audit', (req, res) => {
    try {
        const audit = channelTracker.performPortAudit();
        const portManager = require('../../services/port.manager.service');
        const portStats = portManager.getStats();
        
        res.json({
            audit,
            portStats,
            recommendations: {
                hasOrphanedPorts: audit.orphanedPorts.length > 0,
                hasTerminalCallsWithPorts: audit.callsInTerminalStateWithPorts.length > 0,
                suggestedAction: (audit.orphanedPorts.length > 0 || audit.callsInTerminalStateWithPorts.length > 0) 
                    ? 'Run POST /test/port-cleanup to fix issues' 
                    : 'No issues found'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /test/port-cleanup:
 *   post:
 *     summary: Clean up orphaned ports
 *     description: Release orphaned ports and clean up terminal calls
 *     tags: [Test - Maintenance]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               autoRelease:
 *                 type: boolean
 *                 default: false
 *                 description: If true, automatically releases orphaned resources
 *     responses:
 *       "200":
 *         description: Cleanup results
 */
router.post('/test/port-cleanup', (req, res) => {
    try {
        const { autoRelease = false } = req.body;
        const cleanup = channelTracker.cleanupOrphanedResources(autoRelease);
        
        res.json({
            cleanup,
            message: autoRelease 
                ? `Released ${cleanup.portsReleased} ports and removed ${cleanup.callsRemoved} calls`
                : 'Audit complete. Set autoRelease=true to perform cleanup'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
router.get('/test/validate-integration', async (req, res) => {
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

// Export the complete test routes
module.exports = router;