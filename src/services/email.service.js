// services/email.service.js
const nodemailer = require('nodemailer');
// For AWS SDK v3 (recommended)
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const i18n = require('i18n'); // Assuming you use i18n for email text
const config = require('../config/config'); // Your application's config file
const logger = require('../config/logger'); // Your application's logger

let transport;
let etherealTestAccount = null; // To store Ethereal account details if used
let isInitialized = false;
let initializationPromise = null; // To prevent multiple concurrent initializations

/**
 * Initializes the email transport.
 * This function should be called once at application startup.
 * For development (Ethereal), it's asynchronous.
 */
async function initializeEmailTransport() {
  // If already initialized, return
  if (isInitialized && transport) {
    return transport;
  }

  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = doInitialization();
  return initializationPromise;
}

async function doInitialization() {
  try {
    if (config.env === 'production' || config.env === 'test') {
      logger.info(`Initializing email transport for AWS SES in region: ${config.email.ses.region}`);
      
      // For AWS SDK v3
      const sesClient = new SESClient({
        region: config.email.ses.region,
        // Credentials will be automatically sourced by the SDK from the environment
        // (e.g., IAM role for ECS task, environment variables, or shared credentials file)
      });

      // Test SES connectivity first
      try {
        const { GetSendQuotaCommand } = require('@aws-sdk/client-ses');
        const testCommand = new GetSendQuotaCommand({});
        await sesClient.send(testCommand);
        logger.info('SES connectivity test passed');
      } catch (sesError) {
        logger.error('SES connectivity test failed:', sesError);
        throw new Error(`SES not accessible: ${sesError.message}`);
      }

      // Create transport with proper SES configuration
      transport = nodemailer.createTransport({
        SES: { 
          ses: sesClient, 
          aws: { SendRawEmailCommand } 
        },
        sendingRate: 14, // SES default rate limit
      });

      // Verify the transport
      await transport.verify();
      logger.info('Nodemailer transport configured to use AWS SES and verified.');
      
    } else { 
      // Development environment - use Ethereal
      logger.info('Initializing email transport for Ethereal (development)');
      try {
        etherealTestAccount = await nodemailer.createTestAccount();
        transport = nodemailer.createTransport({
          host: etherealTestAccount.smtp.host,
          port: etherealTestAccount.smtp.port,
          secure: etherealTestAccount.smtp.secure,
          auth: {
            user: etherealTestAccount.user, // Ethereal-generated username
            pass: etherealTestAccount.pass, // Ethereal-generated password
          },
          tls: {
            // do not fail on invalid certs for Ethereal
            rejectUnauthorized: false
          }
        });
        
        // Verify Ethereal transport
        await transport.verify();
        logger.info('Nodemailer transport configured to use Ethereal and verified.');
        
        const baseUrl = nodemailer.getTestMessageUrl({ messageId: 'test-id' }).split('/message/test-id')[0];
        logger.info(`Ethereal Preview URL (base): ${baseUrl}`);
        
      } catch (err) {
        logger.error('Failed to create an Ethereal test account or transport. Using fallback console transport.', err);
        // Fallback to console to prevent crashes if Ethereal fails
        transport = nodemailer.createTransport({
          streamTransport: true,
          newline: 'unix',
          buffer: true
        });
        logger.info('Nodemailer transport configured to output to console (Ethereal fallback).');
      }
    }

    isInitialized = true;
    initializationPromise = null; // Reset promise
    return transport;
    
  } catch (error) {
    logger.error('Failed to initialize email transport:', error);
    isInitialized = false;
    initializationPromise = null; // Reset promise
    throw new Error(`Email transport initialization failed: ${error.message}`);
  }
}

// Clean up on exit
process.on('exit', () => {
  if (transport && typeof transport.close === 'function') { // SMTP transport has close
    transport.close();
  }
  logger.info('Email service exiting.');
});

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} [html] - Optional HTML content
 * @returns {Promise<import('nodemailer/lib/smtp-transport').SentMessageInfo | object>}
 */
const sendEmail = async (to, subject, text, html) => {
  try {
    // Ensure transport is initialized
    if (!isInitialized || !transport) {
      logger.info('Email transport not initialized, attempting to initialize...');
      await initializeEmailTransport();
      
      if (!transport) {
        throw new Error('Email transport failed to initialize');
      }
    }

    const senderAddress = config.email.from;
    if (!senderAddress) {
      logger.error('Email "from" address is not configured.');
      throw new Error('Email sender address is not configured.');
    }

    const mailOptions = {
      from: senderAddress, // Must be a verified SES identity in production
      to,
      subject,
      text,
    };
    
    if (html) {
      mailOptions.html = html;
    }

    logger.info(`Sending email to ${to} with subject: ${subject}`);
    const info = await transport.sendMail(mailOptions);

    if (config.env !== 'production' && config.env !== 'test' && etherealTestAccount) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`Ethereal message sent! Preview URL: ${previewUrl}`);
      } else {
        logger.info(`Ethereal message sent with ID: ${info.messageId}`);
      } 
    } else if (info.messageId) { // For SES
      logger.info(`Email sent successfully to ${to} via SES. Message ID: ${info.messageId}`);
    } else { // For console transport or other cases
       logger.info(`Email sent to ${to}. Response: ${JSON.stringify(info)}`);
    }
    
    return info;
    
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      to,
      subject,
      awsErrorCode: error.name
    });
    throw error;
  }
};

/**
 * Send invite email
 * @param {string} to
 * @param {string} inviteLink
 * @returns {Promise}
 */
const sendInviteEmail = async (to, inviteLink) => {
  const subject = i18n.__ ? i18n.__('inviteEmail.subject') : 'You are invited!';
  const text = i18n.__ ? i18n.__('inviteEmail.text', inviteLink) : `Please use the following link to join: ${inviteLink}`;
  await sendEmail(to, subject, text);
  logger.info(`Invite email successfully queued for ${to}`);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = i18n.__ ? i18n.__('sendResetPasswordEmail.subject') : 'Reset Your Password';
  // Ensure config.apiUrl is correctly defined and accessible for link generation
  const resetLink = `${config.apiUrl || config.baseUrl || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
  const text = i18n.__ ? i18n.__('sendResetPasswordEmail.text', resetLink) : `Reset your password using this link: ${resetLink}`;
  await sendEmail(to, subject, text);
  logger.info(`Reset password email successfully queued for ${to}`);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, token) => {
  const subject = i18n.__ ? i18n.__('sendVerificationEmail.subject') : 'Verify Your Email Address';
  const verificationLink = `${config.apiUrl || config.baseUrl || 'http://localhost:3000'}/verify-email?token=${token}`;
  const text = i18n.__ ? i18n.__('sendVerificationEmail.text', verificationLink) : `Verify your email using this link: ${verificationLink}`;
  await sendEmail(to, subject, text);
  logger.info(`Verification email successfully queued for ${to}`);
};

/**
 * Get service status for debugging
 * @returns {object}
 */
const getStatus = () => {
  return {
    initialized: isInitialized,
    hasTransport: !!transport,
    environment: config.env,
    sesRegion: config.email?.ses?.region,
    fromAddress: config.email?.from,
    etherealAccount: etherealTestAccount ? {
      user: etherealTestAccount.user,
      host: etherealTestAccount.smtp?.host
    } : null
  };
};

/**
 * Check if service is ready
 * @returns {boolean}
 */
const isReady = () => {
  return isInitialized && !!transport;
};

// Export functions
module.exports = {
  initializeEmailTransport, // Call this at application startup
  sendEmail,
  sendInviteEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
  getStatus,
  isReady
};