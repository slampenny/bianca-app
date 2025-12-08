const express = require('express');
const auth = require('../../middlewares/auth');
const router = express.Router();
const logger = require('../../config/logger');
const config = require('../../config/config');

// Import services safely
let ariClient, openAIService, channelTracker, tokenService, caregiverService, etherealEmailRetriever, orgService, emailService;
try {
  ariClient = require('../../services/ari.client');
  openAIService = require('../../services/openai.realtime.service');
  channelTracker = require('../../services/channel.tracker');
  tokenService = require('../../services/token.service');
  caregiverService = require('../../services/caregiver.service');
  etherealEmailRetriever = require('../../services/etherealEmailRetriever.service');
  orgService = require('../../services/org.service');
  emailService = require('../../services/email.service');
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

    // Ensure email service is initialized with Ethereal (required for test routes)
    try {
      const emailService = require('../../services/email.service');
      
      // Check if Ethereal account is available
      let emailStatus = emailService.getStatus();
      if (!emailStatus.etherealAccount) {
        // Email service initialized with SES instead of Ethereal
        // Force reinitialize with Ethereal for test routes
        logger.info('Email service is using SES, forcing Ethereal initialization for test route...');
        await emailService.forceEtherealInitialization();
        emailStatus = emailService.getStatus();
        
        if (!emailStatus.etherealAccount) {
          logger.error('Failed to initialize Ethereal after forcing reinitialization');
          return res.status(500).json({ 
            success: false,
            error: 'Failed to initialize Ethereal email service. Email service status: ' + JSON.stringify(emailStatus)
          });
        }
        logger.info('Successfully forced Ethereal initialization');
      } else if (!emailService.isReady()) {
        logger.info('Email service not initialized, initializing now...');
        await emailService.initializeEmailTransport();
      }
    } catch (initError) {
      logger.error('Failed to initialize email service:', initError);
      return res.status(500).json({ 
        success: false,
        error: `Failed to initialize email service: ${initError.message}` 
      });
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
 * /test/generate-invite-link:
 *   post:
 *     summary: Generate invite link for testing
 *     description: Returns the invite link that would be sent in an email (for E2E testing). Requires an existing invited caregiver.
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
 *         description: Invite link information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 details:
 *                   type: object
 *                   properties:
 *                     inviteLink:
 *                       type: object
 *                       properties:
 *                         frontend:
 *                           type: string
 *                           description: Frontend invite URL
 *                     token:
 *                       type: string
 *                       description: Invite token
 *       "404":
 *         description: Caregiver not found or not in invited state
 */
router.post('/generate-invite-link', async (req, res) => {
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

    // Check if caregiver is in invited state
    if (caregiver.role !== 'invited') {
      return res.status(400).json({ 
        error: 'Caregiver is not in invited state',
        currentRole: caregiver.role 
      });
    }

    // Generate invite token
    const inviteToken = await tokenService.generateInviteToken(caregiver);
    
    // Build the invite link (same format as email service)
    const frontendLink = `${config.frontendUrl}/signup?token=${inviteToken}`;
    
    res.json({
      details: {
        inviteLink: {
          frontend: frontendLink,
        },
        token: inviteToken,
      },
    });
  } catch (err) {
    logger.error('Error generating invite link for test:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /test/send-invite-email:
 *   post:
 *     summary: Send test invite email
 *     description: Sends an actual invite email to the specified email address. Creates or updates a caregiver and sends the invite email.
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - orgId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *                 description: "Caregiver name (default: Test Caregiver)"
 *               phone:
 *                 type: string
 *                 description: "Caregiver phone (default: +15555555555)"
 *               orgId:
 *                 type: string
 *                 description: Organization ID to invite to
 *     responses:
 *       "200":
 *         description: Invite email sent successfully
 *       "400":
 *         description: Invalid request
 *       "404":
 *         description: Organization not found
 *       "500":
 *         description: Failed to send invite email
 */
router.post('/send-invite-email', async (req, res) => {
  try {
    const { email, name = 'Test Caregiver', phone = '+15555555555', orgId, forceResend = false } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Require emailService directly in the route handler
    const emailServiceInstance = require('../../services/email.service');
    
    if (!orgService || !emailServiceInstance || !tokenService) {
      return res.status(503).json({ error: 'Required services not available' });
    }

    // If orgId not provided, find the first org
    let targetOrgId = orgId;
    if (!targetOrgId) {
      const Org = require('../../models/org.model');
      const firstOrg = await Org.findOne();
      if (!firstOrg) {
        return res.status(404).json({ error: 'No organizations found. Please provide orgId or create an organization first.' });
      }
      targetOrgId = firstOrg._id.toString();
      logger.info('Auto-selected first org for test invite', { orgId: targetOrgId });
    }

    logger.info('Test invite email request', { email, name, phone, orgId: targetOrgId, forceResend });

    // Check if caregiver already exists
    const Caregiver = require('../../models/caregiver.model');
    const existingCaregiver = await Caregiver.findOne({ email });
    
    // If forceResend is true and caregiver exists, resend invite email directly
    if (forceResend && existingCaregiver) {
      logger.info('Force resending invite email to existing caregiver', {
        email,
        caregiverId: existingCaregiver._id,
        currentRole: existingCaregiver.role
      });
      
      // Generate invite token and send email directly
      const inviteToken = await tokenService.generateInviteToken(existingCaregiver);
      const inviteLink = `${config.frontendUrl}/signup?token=${inviteToken}`;
      
      // Get inviter's preferred language (default to English for test)
      const locale = 'en';
      
      await emailServiceInstance.sendInviteEmail(email, inviteLink, locale, existingCaregiver.name || name);
      
      logger.info('Force resend invite email sent successfully', { 
        email, 
        caregiverId: existingCaregiver._id,
        inviteToken: inviteToken ? 'generated' : 'none'
      });

      return res.json({
        success: true,
        message: 'Invite email sent successfully (force resend)',
        caregiver: {
          id: existingCaregiver._id,
          email: existingCaregiver.email,
          name: existingCaregiver.name,
          role: existingCaregiver.role
        },
        inviteToken: inviteToken
      });
    }

    // Send invite using the org service (this will create/update caregiver and send email)
    const result = await orgService.sendInvite(targetOrgId, name, email, phone);
    
    logger.info('Test invite email sent successfully', { 
      email, 
      caregiverId: result.caregiver?._id,
      inviteToken: result.inviteToken ? 'generated' : 'none'
    });

    res.json({
      success: true,
      message: 'Invite email sent successfully',
      caregiver: {
        id: result.caregiver._id,
        email: result.caregiver.email,
        name: result.caregiver.name,
        role: result.caregiver.role
      },
      inviteToken: result.inviteToken
    });
  } catch (err) {
    logger.error('Error sending test invite email:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      details: err.stack
    });
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
        patients: result.patients ? result.patients.map(p => p._id) : [],
        emergencyPhrases: result.emergencyPhrases || null
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

/**
 * @swagger
 * /test/playwright-artifacts:
 *   get:
 *     summary: List Playwright test pipeline executions
 *     description: Lists recent Playwright test pipeline executions with their artifacts (development/test only)
 *     tags: [Test]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of executions to return
 *     responses:
 *       "200":
 *         description: List of pipeline executions
 *       "403":
 *         description: Not allowed in production
 *       "500":
 *         description: Error retrieving executions
 */
router.get('/playwright-artifacts', auth(), async (req, res) => {
  try {
    // Only allow in development/test environments
    if (config.env === 'production') {
      return res.status(403).json({ error: 'Playwright artifacts view is not allowed in production' });
    }

    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const pipelineName = 'BiancaPlaywright-Test-Pipeline';
    const limit = parseInt(req.query.limit) || 10;
    const region = config.aws?.region || 'us-east-2';
    const artifactBucket = config.aws?.artifactBucket || process.env.ARTIFACT_BUCKET || 'bianca-codepipeline-artifact-bucket';
    const s3 = new S3Client({ region });

    // List all pipeline execution directories in S3
    // CodePipeline stores artifacts as: pipeline-name/execution-id/artifact-name/
    const pipelinePrefix = `${pipelineName}/`;
    
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: artifactBucket,
      Prefix: pipelinePrefix,
      Delimiter: '/',
      MaxKeys: 1000
    }));

    // Extract execution IDs from common prefixes
    const executionIds = (listResult.CommonPrefixes || [])
      .map(prefix => prefix.Prefix.replace(pipelinePrefix, '').replace('/', ''))
      .filter(id => id && id.length > 0)
      .slice(0, limit);

    // Enrich executions with artifact information
    const enrichedExecutions = await Promise.all(
      executionIds.map(async (executionId) => {
        // List artifacts for this execution
        const artifactPrefix = `${pipelineName}/${executionId}/TestResults/`;
        let artifacts = [];
        
        try {
          const artifactList = await s3.send(new ListObjectsV2Command({
            Bucket: artifactBucket,
            Prefix: artifactPrefix,
            MaxKeys: 100
          }));

          artifacts = (artifactList.Contents || []).map(obj => ({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
            url: `/v1/test/playwright-artifacts/${executionId}/${encodeURIComponent(obj.Key.replace(artifactPrefix, ''))}`
          }));
        } catch (err) {
          logger.warn(`Error listing artifacts for execution ${executionId}: ${err.message}`);
        }

        return {
          executionId,
          artifactCount: artifacts.length,
          artifacts: artifacts.slice(0, 20), // Limit to first 20 artifacts
          viewUrl: `/v1/test/playwright-artifacts/${executionId}`
        };
      })
    );

    res.json({
      success: true,
      pipeline: pipelineName,
      artifactBucket,
      executions: enrichedExecutions
    });
  } catch (error) {
    logger.error('Error retrieving Playwright artifacts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /test/playwright-artifacts/{executionId}:
 *   get:
 *     summary: List artifacts for a specific pipeline execution
 *     description: Lists all artifacts for a specific Playwright test pipeline execution (development/test only)
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Pipeline execution ID
 *     responses:
 *       "200":
 *         description: List of artifacts
 *       "403":
 *         description: Not allowed in production
 *       "404":
 *         description: Execution not found
 */
router.get('/playwright-artifacts/:executionId', auth(), async (req, res) => {
  try {
    // Only allow in development/test environments
    if (config.env === 'production') {
      return res.status(403).json({ error: 'Playwright artifacts view is not allowed in production' });
    }

    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const { executionId } = req.params;
    const pipelineName = 'BiancaPlaywright-Test-Pipeline';
    const artifactBucket = config.aws?.artifactBucket || process.env.ARTIFACT_BUCKET || 'bianca-codepipeline-artifact-bucket';
    const region = config.aws?.region || 'us-east-2';
    const s3 = new S3Client({ region });

    const artifactPrefix = `${pipelineName}/${executionId}/TestResults/`;

    // List all artifacts
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: artifactBucket,
      Prefix: artifactPrefix,
      MaxKeys: 1000
    }));

    const artifacts = (listResult.Contents || []).map(obj => {
      const relativeKey = obj.Key.replace(artifactPrefix, '');
      return {
        name: relativeKey,
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        url: `/v1/test/playwright-artifacts/${executionId}/${encodeURIComponent(relativeKey)}`,
        downloadUrl: `/v1/test/playwright-artifacts/${executionId}/${encodeURIComponent(relativeKey)}?download=true`
      };
    });

    // Organize by type
    const organized = {
      reports: artifacts.filter(a => a.name.includes('playwright-report')),
      testResults: artifacts.filter(a => a.name.includes('test-results')),
      logs: artifacts.filter(a => a.name.endsWith('.log') || a.name.endsWith('.txt')),
      other: artifacts.filter(a => 
        !a.name.includes('playwright-report') && 
        !a.name.includes('test-results') && 
        !a.name.endsWith('.log') && 
        !a.name.endsWith('.txt')
      )
    };

    res.json({
      success: true,
      executionId,
      totalArtifacts: artifacts.length,
      organized,
      all: artifacts
    });
  } catch (error) {
    logger.error('Error retrieving execution artifacts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /test/playwright-artifacts/{executionId}/*:
 *   get:
 *     summary: View or download a specific artifact
 *     description: Retrieves and serves a specific Playwright test artifact (development/test only)
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: artifactPath
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: download
 *         schema:
 *           type: boolean
 *         description: Force download instead of viewing
 *     responses:
 *       "200":
 *         description: Artifact content
 *       "403":
 *         description: Not allowed in production
 *       "404":
 *         description: Artifact not found
 */
router.get('/playwright-artifacts/:executionId/*', auth(), async (req, res) => {
  try {
    // Only allow in development/test environments
    if (config.env === 'production') {
      return res.status(403).json({ error: 'Playwright artifacts view is not allowed in production' });
    }

    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const { executionId } = req.params;
    const artifactPath = req.params[0]; // Everything after executionId/
    const pipelineName = 'BiancaPlaywright-Test-Pipeline';
    const artifactBucket = config.aws?.artifactBucket || process.env.ARTIFACT_BUCKET || 'bianca-codepipeline-artifact-bucket';
    const download = req.query.download === 'true';
    const region = config.aws?.region || 'us-east-2';
    const s3 = new S3Client({ region });
    const artifactKey = `${pipelineName}/${executionId}/TestResults/${artifactPath}`;

    try {
      // Get the object from S3
      const object = await s3.send(new GetObjectCommand({
        Bucket: artifactBucket,
        Key: artifactKey
      }));
      
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of object.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Determine content type
      const contentType = object.ContentType || 
        (artifactPath.endsWith('.html') ? 'text/html' :
         artifactPath.endsWith('.json') ? 'application/json' :
         artifactPath.endsWith('.log') || artifactPath.endsWith('.txt') ? 'text/plain' :
         artifactPath.endsWith('.png') ? 'image/png' :
         artifactPath.endsWith('.jpg') || artifactPath.endsWith('.jpeg') ? 'image/jpeg' :
         artifactPath.endsWith('.mp4') ? 'video/mp4' :
         'application/octet-stream');

      // Set headers
      res.setHeader('Content-Type', contentType);
      if (download || contentType === 'application/octet-stream') {
        res.setHeader('Content-Disposition', `attachment; filename="${artifactPath.split('/').pop()}"`);
      }

      // Send the content
      res.send(buffer);
    } catch (s3Error) {
      if (s3Error.code === 'NoSuchKey') {
        return res.status(404).json({ 
          error: 'Artifact not found',
          key: artifactKey
        });
      }
      throw s3Error;
    }
  } catch (error) {
    logger.error('Error retrieving artifact:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /test/create-alert:
 *   post:
 *     summary: Create an alert for testing
 *     description: Creates an alert in the database for a caregiver (test endpoint only)
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caregiverId
 *               - message
 *             properties:
 *               caregiverId:
 *                 type: string
 *               message:
 *                 type: string
 *               importance:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               alertType:
 *                 type: string
 *                 enum: [patient, system, conversation, schedule]
 *               relatedPatient:
 *                 type: string
 *               visibility:
 *                 type: string
 *               relevanceUntil:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       "200":
 *         description: Alert created successfully
 *       "400":
 *         description: Invalid request
 */
router.post('/create-alert', async (req, res) => {
  try {
    const { caregiverId, message, importance, alertType, relatedPatient, visibility, relevanceUntil } = req.body;
    
    if (!caregiverId || !message) {
      return res.status(400).json({ error: 'caregiverId and message are required' });
    }

    const { alertService } = require('../../services');
    const mongoose = require('mongoose');
    
    // For patient-type alerts with assignedCaregivers visibility, we need to set createdBy to the patient
    // so that all caregivers assigned to that patient can see it
    const finalVisibility = visibility || 'assignedCaregivers';
    let createdBy = caregiverId;
    let createdModel = 'Caregiver';
    
    // If it's a patient alert with assignedCaregivers visibility, use the patient as creator
    if (alertType === 'patient' && relatedPatient && finalVisibility === 'assignedCaregivers') {
      // Ensure patient ID is converted to ObjectId for proper matching in queries
      createdBy = mongoose.Types.ObjectId.isValid(relatedPatient) 
        ? new mongoose.Types.ObjectId(relatedPatient)
        : relatedPatient;
      createdModel = 'Patient';
    }
    
    // Also ensure relatedPatient is ObjectId if provided
    const relatedPatientObjId = relatedPatient && mongoose.Types.ObjectId.isValid(relatedPatient)
      ? new mongoose.Types.ObjectId(relatedPatient)
      : relatedPatient;
    
    const alert = await alertService.createAlert({
      message,
      importance: importance || 'medium',
      alertType: alertType || 'patient',
      relatedPatient: relatedPatientObjId,
      createdBy,
      createdModel,
      visibility: finalVisibility,
      relevanceUntil: relevanceUntil ? new Date(relevanceUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json(alert);
  } catch (err) {
    logger.error('Error creating alert for test:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /test/get-caregiver-by-email:
 *   post:
 *     summary: Get caregiver by email for testing
 *     description: Returns caregiver information by email (test endpoint only)
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
 *         description: Caregiver found
 *       "404":
 *         description: Caregiver not found
 */
router.post('/get-caregiver-by-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!caregiverService) {
      return res.status(503).json({ error: 'Caregiver service not available' });
    }

    const caregiver = await caregiverService.getCaregiverByEmail(email);
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    // Populate patients for test purposes - ensure we get the full patient objects
    await caregiver.populate({
      path: 'patients',
      select: '_id name email phone'
    });
    
    res.json(caregiver);
  } catch (err) {
    logger.error('Error getting caregiver by email for test:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /test/verify-alert-query:
 *   post:
 *     summary: Verify alert query for debugging
 *     description: Checks if an alert would be returned by the alert query for a caregiver (test endpoint only)
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caregiverId
 *               - alertId
 *             properties:
 *               caregiverId:
 *                 type: string
 *               alertId:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Query verification result
 */
router.post('/verify-alert-query', async (req, res) => {
  try {
    const { caregiverId, alertId } = req.body;
    
    if (!caregiverId || !alertId) {
      return res.status(400).json({ error: 'caregiverId and alertId are required' });
    }

    const { Alert, Caregiver } = require('../../models');
    const mongoose = require('mongoose');
    
    // Get the alert
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    // Get the caregiver with patients populated
    const caregiver = await Caregiver.findById(caregiverId)
      .populate({ path: 'org', select: 'caregivers' })
      .populate({ path: 'patients', select: '_id' });
    
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }
    
    // Check if alert would match the query
    const patientIds = caregiver.patients.map((pt) => pt._id.toString());
    const alertCreatedBy = alert.createdBy.toString();
    const isInPatients = patientIds.includes(alertCreatedBy);
    
    res.json({
      alert: {
        id: alert._id.toString(),
        createdBy: alertCreatedBy,
        visibility: alert.visibility,
        message: alert.message,
      },
      caregiver: {
        id: caregiver._id.toString(),
        patientIds: patientIds,
      },
      match: {
        isInPatients,
        visibilityMatches: alert.visibility === 'assignedCaregivers',
        wouldMatch: isInPatients && alert.visibility === 'assignedCaregivers',
      }
    });
  } catch (err) {
    logger.error('Error verifying alert query for test:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /test/emergency-sms:
 *   post:
 *     summary: Test emergency SMS functionality
 *     description: Tests the complete emergency detection and SMS notification flow with detailed diagnostics
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
 *               patientId:
 *                 type: string
 *                 description: Patient ID to test with (optional, will use first patient if not provided)
 *               text:
 *                 type: string
 *                 description: Text to test emergency detection with (default: "I'm having a heart attack")
 *     responses:
 *       "200":
 *         description: Emergency test result with detailed diagnostics
 */
router.post('/emergency-sms', auth(), async (req, res) => {
  try {
    const { patientId, text = "I'm having a heart attack" } = req.body;
    const { emergencyProcessor } = require('../../services/emergencyProcessor.service');
    const { Patient } = require('../../models');
    const { config: emergencyConfig } = require('../../config/emergency.config');
    const { twilioSmsService } = require('../../services/twilioSms.service');
    const { snsService } = require('../../services/sns.service');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      input: {
        patientId: patientId || 'auto-detect',
        text: text
      },
      steps: {},
      result: null,
      errors: []
    };

    // Step 1: Find or validate patient
    let testPatientId = patientId;
    if (!testPatientId) {
      logger.info('[Test Emergency SMS] No patientId provided, finding first patient...');
      const firstPatient = await Patient.findOne().select('_id name preferredName phone caregivers');
      if (!firstPatient) {
        return res.status(404).json({
          success: false,
          error: 'No patients found in database. Please provide a patientId or create a patient first.',
          diagnostics
        });
      }
      testPatientId = firstPatient._id.toString();
      diagnostics.steps.patientLookup = {
        success: true,
        method: 'auto-detect',
        patient: {
          id: firstPatient._id.toString(),
          name: firstPatient.name,
          preferredName: firstPatient.preferredName,
          phone: firstPatient.phone
        }
      };
      logger.info(`[Test Emergency SMS] Using patient: ${firstPatient.name} (${testPatientId})`);
    } else {
      const patient = await Patient.findById(testPatientId).select('_id name preferredName phone caregivers');
      if (!patient) {
        return res.status(404).json({
          success: false,
          error: `Patient not found: ${testPatientId}`,
          diagnostics
        });
      }
      diagnostics.steps.patientLookup = {
        success: true,
        method: 'provided',
        patient: {
          id: patient._id.toString(),
          name: patient.name,
          preferredName: patient.preferredName,
          phone: patient.phone
        }
      };
    }

    // Step 2: Check configuration
    diagnostics.steps.configuration = {
      enableSNSPushNotifications: emergencyConfig.enableSNSPushNotifications,
      NODE_ENV: process.env.NODE_ENV || 'NOT SET',
      AWS_REGION: process.env.AWS_REGION || 'NOT SET'
    };

    // Step 3: Check Twilio SMS service status
    diagnostics.steps.twilioSmsService = {
      available: !!twilioSmsService,
      status: twilioSmsService ? twilioSmsService.getStatus() : null
    };

    // Step 4: Check SNS service status
    diagnostics.steps.snsService = {
      available: !!snsService,
      status: snsService ? snsService.getStatus() : null
    };

    // Step 5: Process utterance for emergency detection
    logger.info(`[Test Emergency SMS] Processing utterance: "${text}" for patient ${testPatientId}`);
    const processResult = await emergencyProcessor.processUtterance(testPatientId, text, Date.now());
    
    diagnostics.steps.emergencyDetection = {
      shouldAlert: processResult.shouldAlert,
      reason: processResult.reason,
      processing: processResult.processing,
      alertData: processResult.alertData
    };

    if (!processResult.shouldAlert) {
      return res.json({
        success: false,
        message: 'Emergency was NOT detected',
        reason: processResult.reason,
        diagnostics
      });
    }

    // Step 6: Get caregivers
    const patient = await Patient.findById(testPatientId).populate('caregivers');
    diagnostics.steps.caregivers = {
      totalCaregivers: patient?.caregivers?.length || 0,
      caregiversWithPhones: patient?.caregivers?.filter(c => c?.phone)?.length || 0,
      caregiverDetails: patient?.caregivers?.map(c => ({
        id: c._id.toString(),
        name: c.name,
        phone: c.phone || 'MISSING',
        hasPhone: !!c.phone
      })) || []
    };

    if (!patient?.caregivers || patient.caregivers.length === 0) {
      return res.json({
        success: false,
        message: 'Emergency detected but NO CAREGIVERS found for patient',
        diagnostics
      });
    }

    const caregiversWithPhones = patient.caregivers.filter(c => c && c.phone);
    if (caregiversWithPhones.length === 0) {
      return res.json({
        success: false,
        message: 'Emergency detected but NO CAREGIVERS with phone numbers found',
        diagnostics
      });
    }

    // Step 7: Create alert and send SMS
    logger.info(`[Test Emergency SMS] Creating alert and sending SMS...`);
    const alertResult = await emergencyProcessor.createAlert(
      testPatientId,
      processResult.alertData,
      text
    );

    diagnostics.steps.alertCreation = {
      success: alertResult.success,
      alertId: alertResult.alert?._id?.toString() || null,
      error: alertResult.error || null
    };

    diagnostics.steps.smsNotification = alertResult.notificationResult || null;

    // Final result
    const smsSuccess = alertResult.notificationResult?.success === true;
    const smsSuccessful = alertResult.notificationResult?.successful || 0;
    const smsFailed = alertResult.notificationResult?.failed || 0;

    diagnostics.result = {
      emergencyDetected: true,
      alertCreated: alertResult.success,
      smsSent: smsSuccess,
      smsSuccessful: smsSuccessful,
      smsFailed: smsFailed,
      totalRecipients: alertResult.notificationResult?.total || 0
    };

    // Determine overall success
    const overallSuccess = alertResult.success && smsSuccess && smsSuccessful > 0;

    res.json({
      success: overallSuccess,
      message: overallSuccess 
        ? `✅ Emergency detected, alert created, and SMS sent to ${smsSuccessful} caregiver(s)`
        : smsSuccess === false
        ? `⚠️ Emergency detected and alert created, but SMS failed (${smsFailed} failed, ${smsSuccessful} successful)`
        : `⚠️ Emergency detected and alert created, but SMS notification result unclear`,
      diagnostics
    });

  } catch (error) {
    logger.error('[Test Emergency SMS] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorStack: error.stack,
      diagnostics: {
        timestamp: new Date().toISOString(),
        errors: [error.message]
      }
    });
  }
});

module.exports = router;
