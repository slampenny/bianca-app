const express = require('express'); // Test auto-trigger
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
      etherealEmail: emailStatus.etherealAccount?.user || null, // Show the actual Ethereal email address
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

  // Check migration status
  try {
    const mongoose = require('mongoose');
    const fs = require('fs');
    const path = require('path');
    const MIGRATIONS_DIR = path.join(__dirname, '../../../migrations');
    const MIGRATIONS_COLLECTION = 'migrations';
    const CRITICAL_MIGRATIONS = [
      '20260310-copy-patients-to-clients.js',
      '20260310-message-role-patient-to-client.js',
      '20260310-patient-to-client-enums.js',
      '20260310-org-require-patient-consent-to-require-client-consent.js',
    ];

    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js') && f !== 'README.md')
      .sort();

    const db = mongoose.connection.db;
    let ranMigrations = [];
    try {
      const migrationsColl = db.collection(MIGRATIONS_COLLECTION);
      const docs = await migrationsColl.find({}).sort({ fileName: 1 }).toArray();
      ranMigrations = docs.map(d => d.fileName);
    } catch (err) {
      // Collection doesn't exist - no migrations have run
    }

    const criticalMissing = CRITICAL_MIGRATIONS.filter(f => !ranMigrations.includes(f));
    serviceStatus.migrations = {
      total: migrationFiles.length,
      ran: ranMigrations.length,
      pending: migrationFiles.length - ranMigrations.length,
      critical: {
        total: CRITICAL_MIGRATIONS.length,
        ran: CRITICAL_MIGRATIONS.filter(f => ranMigrations.includes(f)).length,
        missing: criticalMissing,
      },
      healthy: criticalMissing.length === 0,
    };
  } catch (err) {
    serviceStatus.migrations = { error: err.message };
  }

  // Overall health
  const failedServices = Object.values(serviceStatus.services).filter((s) => !s.loaded || s.error).length;
  const migrationsHealthy = serviceStatus.migrations?.healthy !== false;
  serviceStatus.health = {
    totalServices: 4,
    loadedServices: 4 - failedServices,
    failedServices: failedServices,
    migrationsHealthy,
    overallHealth: (failedServices === 0 && migrationsHealthy) ? 'HEALTHY' : 'DEGRADED',
  };

  res.json(serviceStatus);
});

/**
 * @swagger
 * /test/migration-status:
 *   get:
 *     summary: Get database migration status
 *     description: Returns which migrations have run and which are pending, highlighting critical migrations
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Migration status information
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/migration-status', auth(), async (req, res) => {
  const mongoose = require('mongoose');
  const fs = require('fs');
  const path = require('path');

  const MIGRATIONS_DIR = path.join(__dirname, '../../../migrations');
  const MIGRATIONS_COLLECTION = 'migrations';
  const CRITICAL_MIGRATIONS = [
    '20260310-copy-patients-to-clients.js',
    '20260310-message-role-patient-to-client.js',
    '20260310-patient-to-client-enums.js',
    '20260310-org-require-patient-consent-to-require-client-consent.js',
  ];

  try {
    // Get all migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js') && f !== 'README.md')
      .sort();

    // Get migration history from database
    const db = mongoose.connection.db;
    let ranMigrations = [];
    try {
      const migrationsColl = db.collection(MIGRATIONS_COLLECTION);
      const docs = await migrationsColl.find({}).sort({ fileName: 1 }).toArray();
      ranMigrations = docs.map(d => d.fileName);
    } catch (err) {
      if (err.codeName === 'NamespaceNotFound' || err.message?.includes('does not exist')) {
        // Collection doesn't exist - no migrations have run
      } else {
        throw err;
      }
    }

    // Build status for each migration
    const migrations = migrationFiles.map(file => {
      const hasRun = ranMigrations.includes(file);
      const isCritical = CRITICAL_MIGRATIONS.includes(file);
      return {
        fileName: file,
        hasRun,
        isCritical,
        status: hasRun ? 'completed' : 'pending',
      };
    });

    const critical = {
      total: CRITICAL_MIGRATIONS.length,
      ran: migrations.filter(m => m.isCritical && m.hasRun).length,
      missing: migrations.filter(m => m.isCritical && !m.hasRun).map(m => m.fileName),
    };

    const status = {
      timestamp: new Date().toISOString(),
      total: migrationFiles.length,
      ran: ranMigrations.length,
      pending: migrationFiles.length - ranMigrations.length,
      critical,
      migrations,
      healthy: critical.missing.length === 0,
    };

    if (critical.missing.length > 0) {
      status.warning = `CRITICAL: ${critical.missing.length} critical migration(s) have not run. The app may not work correctly.`;
    }

    res.json(status);
  } catch (err) {
    logger.error('Error checking migration status:', err);
    res.status(500).json({ error: err.message });
  }
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
    let emailData;
    try {
      emailData = await etherealEmailRetriever.retrieveLastEmail(email, waitForEmail ? maxWaitMs : 5000);
    } catch (retrieveError) {
      // Handle "no emails found" as a 404, not a 500 error
      if (retrieveError.message && retrieveError.message.includes('No emails found')) {
        return res.status(404).json({ 
          success: false,
          error: 'No emails found in inbox',
          message: 'Email not found in Ethereal inbox. It may not have been sent yet or may have been delayed.'
        });
      }
      // Re-throw other errors to be handled by outer catch
      throw retrieveError;
    }
    
    if (!emailData) {
      return res.status(404).json({ 
        success: false,
        error: 'Email not found',
        message: 'Email not found in Ethereal inbox'
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
      clientId: 'patient-0'
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

    const { Alert, Org, Caregiver, Client, Conversation, Message, Schedule, PaymentMethod, Invoice } = require('../../models');
    
    logger.info('Cleaning test database...');
    
    // Clear all collections
    await Org.deleteMany({});
    await Caregiver.deleteMany({});
    await Client.deleteMany({});
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
        clients: result.clients ? result.clients.map(p => p._id) : []
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
 * /test/emergency-processor:
 *   post:
 *     summary: Test emergency processor with real SMS sending
 *     description: |
 *       Tests the emergency processor end-to-end by simulating a patient utterance.
 *       This bypasses OpenAI transcription and directly tests the emergency detection,
 *       alert creation, and SMS notification flow using real Twilio.
 *       
 *       Use this to diagnose why emergency alerts aren't being sent during calls.
 *       The test will:
 *       1. Process the utterance through emergency detection
 *       2. Create an alert if emergency is detected
 *       3. Send SMS notifications to caregivers via Twilio (real SMS, not mocked)
 *       4. Return detailed diagnostic information
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: Client ID to test emergency detection for (optional - will use first client if not provided)
 *                 example: "507f1f77bcf86cd799439011"
 *               text:
 *                 type: string
 *                 description: Patient utterance text to test (e.g., "I'm having a heart attack")
 *                 example: "I'm having a heart attack"
 *                 default: "I'm having a heart attack"
 *     responses:
 *       "200":
 *         description: Emergency processor test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 processing:
 *                   type: object
 *                   properties:
 *                     emergencyDetected:
 *                       type: boolean
 *                     falsePositive:
 *                       type: boolean
 *                     deduplicationPassed:
 *                       type: boolean
 *                     confidence:
 *                       type: number
 *                 shouldAlert:
 *                   type: boolean
 *                 alertData:
 *                   type: object
 *                   nullable: true
 *                 alertResult:
 *                   type: object
 *                   nullable: true
 *                 reason:
 *                   type: string
 *                 diagnostics:
 *                   type: object
 *                   properties:
 *                     patientFound:
 *                       type: boolean
 *                     caregiversFound:
 *                       type: boolean
 *                     caregiverCount:
 *                       type: number
 *                     smsEnabled:
 *                       type: boolean
 *                     twilioInitialized:
 *                       type: boolean
 *                     config:
 *                       type: object
 *       "400":
 *         description: Invalid request
 *       "404":
 *         description: Patient not found
 *       "500":
 *         description: Error processing emergency
 */
router.post('/emergency-processor', async (req, res) => {
  try {
    const { clientId, text } = req.body;
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required and must be a non-empty string' });
    }

    // Import emergency processor
    const { emergencyProcessor } = require('../../services/emergencyProcessor.service');
    const { Client } = require('../../models');
    const { snsService } = require('../../services/sns.service');
    const { twilioSmsService } = require('../../services/twilioSms.service');
    const { config: emergencyConfig } = require('../../config/emergency.config');

    // Gather diagnostic information
    const diagnostics = {
      clientFound: false,
      caregiversFound: false,
      caregiverCount: 0,
      smsEnabled: emergencyConfig.enableSNSPushNotifications,
      twilioInitialized: twilioSmsService ? twilioSmsService.isInitialized : false,
      config: {
        enableSNSPushNotifications: emergencyConfig.enableSNSPushNotifications,
        enableAlertsAPI: emergencyConfig.enableAlertsAPI,
        enableFalsePositiveFilter: emergencyConfig.enableFalsePositiveFilter
      }
    };

    // Find client - use provided clientId or get first client
    let client;
    let actualClientId = clientId;
    
    if (clientId) {
      client = await Client.findById(clientId).populate('caregivers');
      if (!client) {
        return res.status(404).json({ 
          error: 'Client not found',
          diagnostics 
        });
      }
    } else {
      // Get first client from database
      client = await Client.findOne().populate('caregivers');
      if (!client) {
        return res.status(404).json({ 
          error: 'No clients found in database',
          diagnostics 
        });
      }
      actualClientId = client._id.toString();
      logger.info(`[Test Route] No clientId provided, using first client: ${actualClientId}`);
    }
    
    diagnostics.clientFound = true;

    // Check caregivers
    if (client.caregivers && client.caregivers.length > 0) {
      const caregiversWithPhone = client.caregivers.filter(cg => cg && cg.phone);
      diagnostics.caregiversFound = caregiversWithPhone.length > 0;
      diagnostics.caregiverCount = caregiversWithPhone.length;
      
      // Log caregiver phone numbers for debugging
      caregiversWithPhone.forEach((cg, idx) => {
        logger.info(`[Test Route] Caregiver ${idx + 1}: ${cg.name || cg.email} - phone: ${cg.phone}`);
      });
      
      if (caregiversWithPhone.length === 0) {
        logger.warn(`[Test Route] Client ${actualClientId} has ${client.caregivers.length} caregiver(s) but none have phone numbers`);
      }
    } else {
      logger.warn(`[Test Route] Client ${actualClientId} has no caregivers assigned`);
    }

    logger.info(`[Test Route] Testing emergency processor for client ${actualClientId} (${client.name || client.preferredName || 'Unknown'}) with text: "${text.substring(0, 100)}"`);

    // Step 1: Process utterance through emergency detection
    const processingResult = await emergencyProcessor.processUtterance(
      actualClientId,
      text,
      Date.now()
    );

    logger.info(`[Test Route] Emergency detection result:`, {
      shouldAlert: processingResult.shouldAlert,
      reason: processingResult.reason,
      processing: processingResult.processing
    });

    // Step 2: If emergency detected, create alert (which will trigger SMS)
    let alertResult = null;
    if (processingResult.shouldAlert && processingResult.alertData) {
      logger.info(`[Test Route] Emergency detected, creating alert...`);
      alertResult = await emergencyProcessor.createAlert(
        actualClientId,
        processingResult.alertData,
        text
      );

      logger.info(`[Test Route] Alert creation result:`, {
        success: alertResult.success,
        alertId: alertResult.alert?._id,
        notificationResult: alertResult.notificationResult
      });

      if (!alertResult.success) {
        logger.error(`[Test Route] Alert creation failed: ${alertResult.error}`);
      }
    } else {
      logger.info(`[Test Route] No alert created - reason: ${processingResult.reason}`);
    }

    // Prepare response with full diagnostic information
    const response = {
      success: true,
      client: {
        id: actualClientId,
        name: client.name,
        preferredName: client.preferredName
      },
      processing: processingResult.processing,
      shouldAlert: processingResult.shouldAlert,
      alertData: processingResult.alertData,
      alertResult: alertResult,
      reason: processingResult.reason,
      diagnostics: {
        ...diagnostics,
        snsStatus: snsService ? snsService.getStatus() : null,
        twilioStatus: twilioSmsService ? twilioSmsService.getStatus() : null,
        emergencyProcessorStatus: emergencyProcessor.getStatus()
      }
    };

    // Add detailed SMS notification results if available
    if (alertResult && alertResult.notificationResult) {
      response.smsResults = {
        success: alertResult.notificationResult.success,
        successful: alertResult.notificationResult.successful,
        failed: alertResult.notificationResult.failed,
        total: alertResult.notificationResult.total,
        results: alertResult.notificationResult.results
      };
    }

    res.json(response);
  } catch (error) {
    logger.error('[Test Route] Error testing emergency processor:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.env === 'development' || config.env === 'staging' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /test/get-caregiver-by-email:
 *   post:
 *     summary: Get caregiver by email (test only)
 *     description: Returns caregiver data including patients for testing (development/test only)
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
 *                 description: Email of the caregiver to retrieve
 *     responses:
 *       "200":
 *         description: Caregiver found
 *       "404":
 *         description: Caregiver not found
 *       "500":
 *         description: Error retrieving caregiver
 */
router.post('/get-caregiver-by-email', async (req, res) => {
  try {
    // Only allow in development/test environments
    if (config.env === 'production') {
      return res.status(403).json({ error: 'This endpoint is not available in production' });
    }

    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!caregiverService) {
      return res.status(503).json({ error: 'Caregiver service not available' });
    }

    // Find caregiver by email with patients and org populated
    const caregiver = await caregiverService.getCaregiverByEmail(email, {
      populatePatients: true,
      populateOrg: true,
    });
    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    res.json(caregiver);
  } catch (error) {
    logger.error('Error getting caregiver by email:', error);
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
 *     summary: Create alert for testing (test only)
 *     description: Creates an alert for testing purposes (development/test only)
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
 *                 description: ID of the caregiver to create alert for
 *               message:
 *                 type: string
 *                 description: Alert message
 *               importance:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Alert importance level
 *               alertType:
 *                 type: string
 *                 enum: [patient, system, conversation, schedule]
 *                 description: Type of alert
 *               relatedClient:
 *                 type: string
 *                 description: ID of related patient (if alertType is patient)
 *     responses:
 *       "200":
 *         description: Alert created successfully
 *       "400":
 *         description: Invalid request
 *       "500":
 *         description: Error creating alert
 */
router.post('/create-alert', async (req, res) => {
  try {
    // Only allow in development/test environments
    if (config.env === 'production') {
      return res.status(403).json({ error: 'This endpoint is not available in production' });
    }

    const { caregiverId, message, importance = 'medium', alertType = 'system', relatedClient, visibility = 'allCaregivers', relevanceUntil } = req.body;
    
    if (!caregiverId || !message) {
      return res.status(400).json({ error: 'caregiverId and message are required' });
    }

    const alertService = require('../../services/alert.service');
    
    const alertData = {
      createdBy: caregiverId, // The caregiver creating the alert
      createdModel: 'Caregiver', // Alerts created via test endpoint are from Caregiver
      message,
      importance,
      alertType,
      visibility: visibility || 'allCaregivers', // Default visibility for test alerts
      relatedClient,
      readBy: [],
      relevanceUntil: relevanceUntil ? new Date(relevanceUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
    };

    if (relatedClient) {
      alertData.relatedClient = relatedClient;
    }

    const alert = await alertService.createAlert(alertData);
    
    res.json(alert);
  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /test/get-ethereal-account:
 *   get:
 *     summary: Get Ethereal email account details (test only)
 *     description: Returns the Ethereal test email account details including email address and credentials
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Ethereal account details
 *       "404":
 *         description: Ethereal account not available
 */
router.get('/get-ethereal-account', async (req, res) => {
  try {
    if (config.env === 'production') {
      return res.status(403).json({ error: 'This endpoint is not available in production' });
    }

    const emailService = require('../../services/email.service');
    const emailStatus = emailService.getStatus();
    
    if (!emailStatus.etherealAccount) {
      // Try to force initialization
      try {
        await emailService.forceEtherealInitialization();
        const newStatus = emailService.getStatus();
        if (!newStatus.etherealAccount) {
          return res.status(404).json({ 
            success: false,
            error: 'Ethereal account not available',
            message: 'Ethereal account could not be initialized. Check logs for details.'
          });
        }
        // Return the newly created account
        return res.json({
          success: true,
          account: {
            email: newStatus.etherealAccount.user,
            smtp: {
              host: newStatus.etherealAccount.host,
              port: newStatus.etherealAccount.smtp?.port || 587
            },
            imap: newStatus.etherealAccount.imap
          }
        });
      } catch (initError) {
        return res.status(500).json({ 
          success: false,
          error: `Failed to initialize Ethereal: ${initError.message}`
        });
      }
    }

    res.json({
      success: true,
      account: {
        email: emailStatus.etherealAccount.user,
        smtp: {
          host: emailStatus.etherealAccount.host,
          port: emailStatus.etherealAccount.smtp?.port || 587
        },
        imap: emailStatus.etherealAccount.imap
      }
    });
  } catch (err) {
    logger.error('Error getting Ethereal account:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

/**
 * @swagger
 * /test/get-ethereal-account:
 *   get:
 *     summary: Get Ethereal email account details (test only)
 *     description: Returns the Ethereal test email account details including email address
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Ethereal account details
 *       "404":
 *         description: Ethereal account not available
 */
router.get('/get-ethereal-account', async (req, res) => {
  try {
    if (config.env === 'production') {
      return res.status(403).json({ error: 'This endpoint is not available in production' });
    }

    const emailService = require('../../services/email.service');
    const emailStatus = emailService.getStatus();
    
    if (!emailStatus.etherealAccount) {
      // Try to force initialization
      try {
        await emailService.forceEtherealInitialization();
        const newStatus = emailService.getStatus();
        if (!newStatus.etherealAccount) {
          return res.status(404).json({ 
            success: false,
            error: 'Ethereal account not available',
            message: 'Ethereal account could not be initialized. Check logs for details.'
          });
        }
        // Return the newly created account
        return res.json({
          success: true,
          account: {
            email: newStatus.etherealAccount.user,
            smtp: {
              host: newStatus.etherealAccount.host,
              port: newStatus.etherealAccount.smtp?.port || 587
            },
            imap: newStatus.etherealAccount.imap
          }
        });
      } catch (initError) {
        return res.status(500).json({ 
          success: false,
          error: `Failed to initialize Ethereal: ${initError.message}`
        });
      }
    }

    res.json({
      success: true,
      account: {
        email: emailStatus.etherealAccount.user,
        smtp: {
          host: emailStatus.etherealAccount.host,
          port: emailStatus.etherealAccount.smtp?.port || 587
        },
        imap: emailStatus.etherealAccount.imap
      }
    });
  } catch (err) {
    logger.error('Error getting Ethereal account:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

/**
 * @swagger
 * /test/openai-connection:
 *   post:
 *     summary: Test OpenAI Realtime API connection (GA)
 *     description: |
 *       Tests the OpenAI Realtime API connection and session handshake.
 *       Always uses GA API (old Beta/preview models are offline).
 *       
 *       This endpoint:
 *       1. Connects to OpenAI Realtime API (GA)
 *       2. Creates a session
 *       3. Updates session configuration
 *       4. Verifies the connection works
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Connection test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 apiVersion:
 *                   type: string
 *                   enum: [GA]
 *                 testId:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *                 sessionDetails:
 *                   type: object
 *                 receivedMessages:
 *                   type: array
 *                 message:
 *                   type: string
 *       "500":
 *         description: Connection test failed
 */
router.post('/openai-connection', auth(), async (req, res) => {
  try {
    if (!openAIService) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI Realtime Service not available'
      });
    }

    const testId = `test-${Date.now()}`;
    const result = await openAIService.testBasicConnectionAndSession(testId);
    
    res.json({
      success: true,
      apiVersion: 'GA',
      testId,
      ...result
    });
  } catch (error) {
    logger.error('[Test Route] Error testing OpenAI connection:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      apiVersion: 'GA',
      stack: config.env === 'development' || config.env === 'staging' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /test/create-app-store-review-account:
 *   post:
 *     summary: Create App Store review test account
 *     description: |
 *       Creates a dedicated test account for App Store review with sample data.
 *       This account includes:
 *       - Organization and caregiver account
 *       - 2 sample patients with conversations and schedules
 *       - All necessary sample data for Apple reviewers
 *       
 *       **Credentials created:**
 *       - Email: appreview@biancatechnologies.com
 *       - Password: (loaded from AWS Secrets Manager as APP_STORE_REVIEW_PASSWORD)
 *       
 *       **Note:** This account must exist in production since the production iOS app
 *       connects to the production API. The endpoint is idempotent - if the account
 *       already exists, it will return an error.
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: App Store review account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 credentials:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: appreview@biancatechnologies.com
 *                     password:
 *                       type: string
 *                       description: Password loaded from AWS Secrets Manager
 *                       example: (from Secrets Manager)
 *                 account:
 *                   type: object
 *                   properties:
 *                     organization:
 *                       type: string
 *                       description: Organization name
 *                     caregiver:
 *                       type: string
 *                       description: Caregiver email
 *                     patients:
 *                       type: number
 *                       description: Number of patients created
 *                     conversations:
 *                       type: number
 *                       description: Number of conversations created
 *                     schedules:
 *                       type: number
 *                       description: Number of schedules created
 *       "400":
 *         description: Account already exists
 *       "500":
 *         description: Error creating account
 */
router.post('/create-app-store-review-account', async (req, res) => {
  try {

    const createAppStoreReviewAccount = require('../../scripts/createAppStoreReviewAccount');
    
    logger.info('Creating App Store review account via API...');
    
    // Ensure secrets are loaded (should already be loaded at startup, but ensure it here)
    await config.loadSecrets();
    
    // Get credentials from config (password should come from Secrets Manager in staging/production)
    const APP_STORE_REVIEW_EMAIL = config.appStoreReview.email;
    const APP_STORE_REVIEW_PASSWORD = config.appStoreReview.password;
    const APP_STORE_REVIEW_NAME = config.appStoreReview.name;
    const APP_STORE_REVIEW_PHONE = config.appStoreReview.phone;
    
    if (!APP_STORE_REVIEW_PASSWORD) {
      return res.status(500).json({
        success: false,
        error: 'APP_STORE_REVIEW_PASSWORD is not configured. Please ensure it is set in AWS Secrets Manager or .env file.'
      });
    }
    
    // We need to modify the script to return data instead of just logging
    // Let's create a wrapper that captures the result
    const { Org, Caregiver, Client, Conversation, Message, Schedule } = require('../../models');
    const bcrypt = require('bcryptjs');
    
    // Check if account already exists
    const existingCaregiver = await Caregiver.findOne({ email: APP_STORE_REVIEW_EMAIL });
    if (existingCaregiver) {
      return res.status(400).json({
        success: false,
        error: 'App Store review account already exists',
        email: APP_STORE_REVIEW_EMAIL,
        message: 'If you want to recreate it, delete the existing account first.'
      });
    }
    
    // Hash the password
    const salt = bcrypt.genSaltSync(8);
    const hashedPassword = bcrypt.hashSync(APP_STORE_REVIEW_PASSWORD, salt);
    
    // Create organization
    const org = await Org.create({
      name: 'App Review Test Organization',
      email: APP_STORE_REVIEW_EMAIL,
      country: 'CA',
    });
    
    // Create caregiver account
    const caregiver = await Caregiver.create({
      name: APP_STORE_REVIEW_NAME,
      email: APP_STORE_REVIEW_EMAIL,
      phone: APP_STORE_REVIEW_PHONE,
      password: hashedPassword,
      role: 'orgAdmin',
      org: org._id,
      clients: [],
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    
    // Add caregiver to org
    org.caregivers.push(caregiver._id);
    await org.save();
    
    // Create sample clients
    const client1 = await Client.create({
      name: 'Sample Client One',
      email: 'sample.patient1@example.com',
      phone: '+16045624264',
      caregivers: [caregiver._id],
      org: org._id,
      schedules: [],
      isActive: true,
    });
    
    const client2 = await Client.create({
      name: 'Sample Client Two',
      email: 'sample.patient2@example.com',
      phone: '+16045624265',
      caregivers: [caregiver._id],
      org: org._id,
      schedules: [],
      isActive: true,
    });
    
    // Add clients to caregiver
    caregiver.clients.push(client1._id, client2._id);
    await caregiver.save();
    
    // Create sample conversations
    const conversation1 = await Conversation.create({
      client: client1._id,
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
      duration: 5 * 60,
      status: 'completed',
      transcript: 'Hello, how are you feeling today? I\'m doing well, thank you for checking in.',
      summary: 'Routine wellness check - patient is doing well',
      sentiment: 'positive',
      isActive: true,
    });
    
    await Message.create({
      conversation: conversation1._id,
      client: client1._id,
      content: 'Hello, how are you feeling today?',
      role: 'system',
      timestamp: conversation1.startTime,
    });
    
    await Message.create({
      conversation: conversation1._id,
      client: client1._id,
      content: 'I\'m doing well, thank you for checking in.',
      role: 'user',
      timestamp: new Date(conversation1.startTime.getTime() + 30 * 1000),
    });
    
    const conversation2 = await Conversation.create({
      client: client1._id,
      startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000),
      duration: 3 * 60,
      status: 'completed',
      transcript: 'Good morning! How did you sleep? I slept well, thank you.',
      summary: 'Morning check-in - patient slept well',
      sentiment: 'positive',
      isActive: true,
    });
    
    const conversation3 = await Conversation.create({
      client: client2._id,
      startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 1000),
      duration: 4 * 60,
      status: 'completed',
      transcript: 'How are you today? I\'m feeling great, thanks!',
      summary: 'Daily check-in - patient feeling great',
      sentiment: 'positive',
      isActive: true,
    });
    
    // Create sample schedules
    const schedule1 = await Schedule.create({
      client: client1._id,
      caregiver: caregiver._id,
      type: 'daily',
      time: '09:00',
      timezone: 'America/Vancouver',
      isActive: true,
      enabled: true,
    });
    
    const schedule2 = await Schedule.create({
      client: client1._id,
      caregiver: caregiver._id,
      type: 'weekly',
      dayOfWeek: 1,
      time: '14:00',
      timezone: 'America/Vancouver',
      isActive: true,
      enabled: true,
    });
    
    const schedule3 = await Schedule.create({
      client: client2._id,
      caregiver: caregiver._id,
      type: 'daily',
      time: '10:00',
      timezone: 'America/Vancouver',
      isActive: true,
      enabled: true,
    });
    
    // Add schedules to clients
    client1.schedules.push(schedule1._id, schedule2._id);
    client2.schedules.push(schedule3._id);
    await client1.save();
    await client2.save();
    
    logger.info('App Store review account created successfully via API');
    
    res.json({
      success: true,
      message: 'App Store review account created successfully',
      credentials: {
        email: APP_STORE_REVIEW_EMAIL,
        password: APP_STORE_REVIEW_PASSWORD,
      },
      account: {
        organization: org.name,
        caregiver: caregiver.email,
        clients: 2,
        conversations: 3,
        schedules: 3,
      },
    });
  } catch (error) {
    logger.error('Error creating App Store review account:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.env === 'development' || config.env === 'staging' ? error.stack : undefined
    });
  }
});

module.exports = router;
