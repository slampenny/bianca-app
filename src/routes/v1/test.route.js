const express = require('express');
const auth = require('../../middlewares/auth');
const router = express.Router();
const logger = require('../../config/logger');
const config = require('../../config/config');

// Import services safely
let ariClient, openAIService, channelTracker, tokenService, caregiverService, etherealEmailRetriever;
try {
  ariClient = require('../../services/ari.client');
  openAIService = require('../../services/openai.realtime.service');
  channelTracker = require('../../services/channel.tracker');
  tokenService = require('../../services/token.service');
  caregiverService = require('../../services/caregiver.service');
  etherealEmailRetriever = require('../../services/etherealEmailRetriever.service');
} catch (err) {
  logger.error('Error loading services for test routes:', err);
}

/**
 * @swagger
 * tags:
 *   name: Test
 *   description: Diagnostic and testing endpoints (development only)
 */

/**
 * @swagger
 * /test/service-status:
 *   get:
 *     summary: Get service status and health information
 *     description: Returns status of all services (ARI, OpenAI, etc.) for debugging
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Service status information
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/service-status', auth(), async (req, res) => {
  const serviceStatus = {
    timestamp: new Date().toISOString(),
    services: {},
    connections: {},
    health: {},
  };

  // Check service loading
  serviceStatus.services = {
    ariClient: {
      loaded: !!ariClient,
      error: ariClient ? null : 'Failed to load ari.client.js',
    },
    openAIService: {
      loaded: !!openAIService,
      error: openAIService ? null : 'Failed to load openai.realtime.service.js',
    },
    channelTracker: {
      loaded: !!channelTracker,
      error: channelTracker ? null : 'Failed to load channel.tracker.js',
    },
  };

  // Check email service status
  try {
    const emailService = require('../../services/email.service');
    const emailStatus = emailService.getStatus();
    serviceStatus.services.email = {
      initialized: emailStatus.initialized,
      hasTransport: emailStatus.hasTransport,
      environment: emailStatus.environment,
      etherealAvailable: !!emailStatus.etherealAccount,
      fromAddress: emailStatus.fromAddress,
    };
  } catch (err) {
    serviceStatus.services.email = { error: err.message };
  }

  // Check SNS service status
  try {
    const { snsService } = require('../../services/sns.service');
    const snsStatus = snsService.getStatus();
    serviceStatus.services.sns = {
      initialized: snsStatus.isInitialized,
      enabled: snsStatus.isEnabled,
      region: snsStatus.region,
      directSMS: snsStatus.directSMS,
    };
  } catch (err) {
    serviceStatus.services.sns = { error: err.message };
  }

  // Check connections if services are loaded
  if (ariClient) {
    try {
      const ariInstance = ariClient.getAriClientInstance();
      serviceStatus.connections.ari = {
        connected: ariInstance.isConnected,
        health: await ariInstance.healthCheck(),
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
        activeConnections: openaiInstance ? openaiInstance.connections.size : 0,
      };
    } catch (err) {
      serviceStatus.connections.openai = { error: err.message };
    }
  }

  // Overall health
  const failedServices = Object.values(serviceStatus.services).filter((s) => !s.loaded || s.error).length;
  serviceStatus.health = {
    totalServices: 4,
    loadedServices: 4 - failedServices,
    failedServices: failedServices,
    overallHealth: failedServices === 0 ? 'HEALTHY' : 'DEGRADED',
  };

  res.json(serviceStatus);
});

/**
 * @swagger
 * /test/active-calls:
 *   get:
 *     summary: Get active call information
 *     description: Returns information about currently active calls for monitoring
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Active calls information
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "503":
 *         description: ARI client not available
 */
router.get('/active-calls', auth(), async (req, res) => {
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
            write: callData.rtpWritePort,
          },
        });
      }
    }

    res.json({
      activeCalls: calls.length,
      calls,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /test/send-verification-email:
 *   post:
 *     summary: Generate verification email link for testing
 *     description: Returns the verification link that would be sent in an email (for E2E testing)
 *     tags: [Test]
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
 *     responses:
 *       "200":
 *         description: Verification link information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 details:
 *                   type: object
 *                   properties:
 *                     verificationLinks:
 *                       type: object
 *                       properties:
 *                         frontend:
 *                           type: string
 *                           description: Frontend verification URL
 *       "404":
 *         description: Caregiver not found
 */
router.post('/send-verification-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find caregiver by email
    const caregiver = await caregiverService.getCaregiverByEmail(email);
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    // Generate verification token
    const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
    
    // Build the verification link (same format as email service)
    const frontendLink = `${config.frontendUrl}/auth/verify-email?token=${verifyEmailToken}`;
    
    res.json({
      details: {
        verificationLinks: {
          frontend: frontendLink,
        },
      },
    });
  } catch (err) {
    logger.error('Error generating verification link for test:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /test/get-email:
 *   post:
 *     summary: Retrieve email from Ethereal for testing
 *     description: Retrieves the last email sent to a given address from Ethereal test email service
 *     tags: [Test]
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
 *               waitForEmail:
 *                 type: boolean
 *                 description: "Whether to wait for email to arrive (default: false)"
 *               maxWaitMs:
 *                 type: integer
 *                 description: "Maximum time to wait in milliseconds (default: 30000)"
 *     responses:
 *       "200":
 *         description: Email retrieved successfully
 *       "404":
 *         description: Email not found
 */
router.post('/get-email', async (req, res) => {
  try {
    const { email, waitForEmail = false, maxWaitMs = 30000 } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!etherealEmailRetriever) {
      return res.status(503).json({ error: 'Ethereal email retriever service not available' });
    }

    // Retrieve email from Ethereal
    // Note: retrieveLastEmail signature is (recipientEmail, timeoutMs)
    // If waitForEmail is true, we'll poll with the timeout
    const emailData = await etherealEmailRetriever.retrieveLastEmail(email, waitForEmail ? maxWaitMs : 5000);
    
    if (!emailData) {
      return res.status(404).json({ 
        success: false,
        message: 'Email not found' 
      });
    }

    res.json({
      success: true,
      email: emailData
    });
  } catch (err) {
    logger.error('Error retrieving email from Ethereal:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

/**
 * @swagger
 * /test/generate-reset-password-link:
 *   post:
 *     summary: Generate reset password link for testing
 *     description: Returns the reset password link that would be sent in an email (for E2E testing)
 *     tags: [Test]
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
 *     responses:
 *       "200":
 *         description: Reset password link information
 *       "404":
 *         description: Caregiver not found
 */
router.post('/generate-reset-password-link', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!tokenService || !caregiverService) {
      return res.status(503).json({ error: 'Required services not available' });
    }

    // Find caregiver by email
    const caregiver = await caregiverService.getCaregiverByEmail(email);
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    // Generate reset password token
    const resetPasswordToken = await tokenService.generateResetPasswordToken(email);
    
    // Build the reset password link (same format as email service)
    const frontendLink = `${config.frontendUrl}/reset-password?token=${resetPasswordToken}`;
    
    res.json({
      details: {
        resetPasswordLink: {
          frontend: frontendLink,
        },
        token: resetPasswordToken,
      },
    });
  } catch (err) {
    logger.error('Error generating reset password link for test:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /test/send-sms-patient-0:
 *   post:
 *     summary: Send test SMS to patient 0 phone number
 *     description: Sends a test SMS message to the hardcoded patient 0 phone number (6045624263) for debugging SMS delivery
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: SMS sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 messageId:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                   description: Masked phone number
 *       "500":
 *         description: Failed to send SMS
 */
router.post('/send-sms-patient-0', auth(), async (req, res) => {
  try {
    const { twilioSmsService } = require('../../services/twilioSms.service');
    const logger = require('../../config/logger');
    
    // Hardcoded phone number for patient 0: 6045624263
    // Format as E.164: +16045624263
    const patient0Phone = '+16045624263';
    const testMessage = `Test SMS from Bianca staging - Patient 0. Timestamp: ${new Date().toISOString()}. If you receive this, SMS delivery is working!`;
    
    logger.info(`[Test Route] Sending test SMS to patient 0: ${patient0Phone}`);
    
    // Check if Twilio SMS service is initialized
    if (!twilioSmsService || !twilioSmsService.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Twilio SMS service not initialized',
        twilioStatus: twilioSmsService ? twilioSmsService.getStatus() : null
      });
    }
    
    // Send SMS using Twilio
    const response = await twilioSmsService.sendSMS(patient0Phone, testMessage, {
      category: 'test',
      patientId: 'patient-0'
    });
    
    logger.info(`[Test Route] SMS sent successfully to ${patient0Phone}, MessageSid: ${response.messageSid}`);
    
    res.json({
      success: true,
      message: 'SMS sent successfully',
      messageId: response.messageSid, // Twilio uses messageSid
      phoneNumber: twilioSmsService.maskPhoneNumber(patient0Phone),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[Test Route] Error sending test SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorName: error.name,
      details: error.stack
    });
  }
});

/**
 * @swagger
 * /test/clean:
 *   post:
 *     summary: Clean test database
 *     description: Clears all test data from the database (development/test only)
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Database cleaned successfully
 *       "500":
 *         description: Error cleaning database
 */
router.post('/clean', async (req, res) => {
  try {
    // Only allow in development/test environments
    if (config.env === 'production') {
      return res.status(403).json({ error: 'Database cleaning is not allowed in production' });
    }

    const { Alert, Org, Caregiver, Patient, Conversation, Message, Schedule, PaymentMethod, Invoice } = require('../../models');
    
    logger.info('Cleaning test database...');
    
    // Clear all collections
    await Org.deleteMany({});
    await Caregiver.deleteMany({});
    await Patient.deleteMany({});
    await Alert.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Schedule.deleteMany({});
    await PaymentMethod.deleteMany({});
    await Invoice.deleteMany({});
    
    logger.info('Database cleaned successfully');
    
    res.json({
      success: true,
      message: 'Database cleaned successfully'
    });
  } catch (error) {
    logger.error('Error cleaning database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /test/seed:
 *   post:
 *     summary: Seed test database
 *     description: Seeds the database with test data (development/test only)
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Database seeded successfully
 *       "500":
 *         description: Error seeding database
 */
router.post('/seed', async (req, res) => {
  try {
    // Only allow in development/test environments
    if (config.env === 'production') {
      return res.status(403).json({ error: 'Database seeding is not allowed in production' });
    }

    const seedDatabase = require('../../scripts/seedDatabase');
    
    logger.info('Seeding test database...');
    
    const result = await seedDatabase();
    
    logger.info('Database seeded successfully');
    
    res.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        org: result.org ? result.org._id : null,
        caregiver: result.caregiver ? result.caregiver._id : null,
        patients: result.patients ? result.patients.map(p => p._id) : []
      }
    });
  } catch (error) {
    logger.error('Error seeding database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /test/reset-mfa:
 *   post:
 *     summary: Reset MFA for a user (test only)
 *     description: Disables MFA for a specific user by email (development/test only)
 *     tags: [Test]
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
 *                 description: Email of the user to reset MFA for
 *     responses:
 *       "200":
 *         description: MFA reset successfully
 *       "404":
 *         description: User not found
 *       "500":
 *         description: Error resetting MFA
 */
router.post('/reset-mfa', async (req, res) => {
  try {
    // Only allow in development/test environments
    if (config.env === 'production') {
      return res.status(403).json({ error: 'MFA reset is not allowed in production' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { Caregiver } = require('../../models');
    const mfaService = require('../../services/mfa.service');
    
    // Find the user by email
    const caregiver = await Caregiver.findOne({ email });
    if (!caregiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if MFA is enabled
    if (!caregiver.mfaEnabled) {
      return res.json({
        success: true,
        message: 'MFA is already disabled for this user'
      });
    }

    // Disable MFA (using a bypass token for test purposes)
    // In test mode, we'll directly update the database
    caregiver.mfaEnabled = false;
    caregiver.mfaSecret = undefined;
    caregiver.mfaBackupCodes = [];
    await caregiver.save();

    logger.info(`MFA reset for user: ${email}`);
    
    res.json({
      success: true,
      message: 'MFA reset successfully',
      data: {
        email: caregiver.email,
        mfaEnabled: false
      }
    });
  } catch (error) {
    logger.error('Error resetting MFA:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
