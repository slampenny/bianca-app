const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { chatService, testService, twilioCallService } = require('../services');
const { Patient, Conversation } = require('../models');
const logger = require('../config/logger');
const DebugUtils = require('../utils/debug');
const openAIService = require('../api/openai.realtime.service');
const { getAriClient } = require('../api/ari.client');
const seedDatabase = require('../scripts/seedDatabase');

/**
 * Test the summarization feature
 */
const testSummarize = catchAsync(async (req, res) => {
  const { conversationId } = req.body;
  const response = await chatService.summarize(conversationId);
  res.send(response);
});

/**
 * Clean the database (for testing)
 */
const testCleanDB = catchAsync(async (req, res) => {
  await testService.cleanDB();
  res.status(httpStatus.OK).send({ message: 'Database cleaned' });
});

/**
 * Clean the database (for testing)
 */
const testSeed = catchAsync(async (req, res) => {
  const result = await seedDatabase();
  res.status(httpStatus.OK).send({ message: 'Database Seeded', result });
});

/**
 * Get system debug information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDebugInfo = async (req, res) => {
  try {
    // Build services object
    const services = {
      openAIService,
      twilioConnections: global.twilioConnections || new Map(),
      ariClient: getAriClient()
    };
    
    // Log connection state
    DebugUtils.logConnectionState(services);
    
    // Collect WebSocket server info if available
    const wsInfo = global.webSocketServer ? {
      clients: global.webSocketServer.clients.size,
      listening: !!global.webSocketServer.address()
    } : { error: 'WebSocket server not available globally' };
    
    // Get system health
    const health = await DebugUtils.getSystemHealth();
    
    // Return comprehensive debug information
    res.json({
      message: 'Debug information',
      connectionState: {
        openAI: {
          connections: openAIService && openAIService.connections ? openAIService.connections.size : 0
        },
        twilio: {
          connections: global.twilioConnections ? global.twilioConnections.size : 0
        },
        asterisk: {
          connected: services.ariClient ? services.ariClient.isConnected : false,
          channels: services.ariClient && services.ariClient.channels ? services.ariClient.channels.size : 0
        }
      },
      webSocketServer: wsInfo,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT || 3000,
        hostname: require('os').hostname()
      },
      health
    });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Initiate a test call to the first patient in the database
 */
const testCall = catchAsync(async (req, res) => {
  // Get the first patient from the database
  const patient = await Patient.findOne().sort({ createdAt: 1 }).exec();
  
  if (!patient) {
    logger.error('[Test] No patients found in database');
    return res.status(httpStatus.NOT_FOUND).send({ 
      message: 'No patients found in database. Create a patient first.' 
    });
  }
  
  // Initiate the call
  logger.info(`[Test] Initiating call to patient: ${patient.name} (${patient.phone})`);
  const sid = await twilioCallService.initiateCall(patient.id);
  logger.info(`[Test] Call initiated, SID: ${sid}`);
  
  // Wait briefly to ensure Twilio calls webhook
  setTimeout(async () => {
    try {
      const conversation = await Conversation.findOne({ callSid: sid }).exec();
      const status = conversation ? conversation.status : 'unknown';
      logger.info(`[Test] Call should be active now. Current status: ${status}`);
      
      res.status(httpStatus.OK).send({ 
        sid,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        conversationId: conversation ? conversation._id : null,
        status
      });
    } catch (err) {
      logger.error(`[Test] Error checking call status: ${err.message}`);
      res.status(httpStatus.OK).send({ sid });
    }
  }, 5000); // allow Twilio 5s to fetch TwiML and connect to stream
});

module.exports = {
  testCall,
  testSeed,
  testSummarize,
  testCleanDB,
  getDebugInfo
};