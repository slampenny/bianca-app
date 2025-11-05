// services/email.service.js
const nodemailer = require('nodemailer');
// For AWS SDK v3 (recommended)
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const i18n = require('i18n'); // Assuming you use i18n for email text
const config = require('../config/config'); // Your application's config file
const logger = require('../config/logger'); // Your application's logger

// Configure i18n for email service
i18n.configure({
  locales: ['en', 'es'],
  directory: `${__dirname}/../locales`,
  objectNotation: true,
  defaultLocale: 'en',
  logWarnFn(msg) {
    // do nothing
  },
});

// Set locale to English for email service
i18n.setLocale('en');

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
    // Check if SES should be used in development (via environment variable)
    const useSESInDev = process.env.USE_SES_IN_DEV === 'true' || process.env.USE_SES_IN_DEV === '1';
    const shouldUseSES = config.env === 'production' || config.env === 'staging' || config.env === 'test' || (config.env === 'development' && useSESInDev);
    
    if (shouldUseSES) {
      logger.info(`Initializing email transport for AWS SES in region: ${config.email.ses.region}`);
      
      // For AWS SDK v3
      // Credentials will be automatically sourced by the SDK from:
      // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
      // 2. Shared credentials file (~/.aws/credentials) - mounted in Docker
      // 3. Shared config file (~/.aws/config) - mounted in Docker
      // 4. AWS_PROFILE environment variable (set in docker-compose.dev.yml)
      // 5. IAM role (for ECS/EC2 instances)
      
      // Set HOME environment variable to ensure AWS SDK can find credentials
      // In Docker, the node user's home is /home/node
      // AWS SDK v3 looks for ~/.aws/config and ~/.aws/credentials relative to HOME
      if (process.env.AWS_PROFILE) {
        // Ensure HOME is set correctly for AWS SDK credential provider
        const nodeUid = process.getuid ? process.getuid() : null;
        if (nodeUid === 1000 || !process.env.HOME || process.env.HOME === '/') {
          // Running as node user (uid 1000) in Docker, or HOME not set
          process.env.HOME = '/home/node';
        }
      }
      
      const sesClient = new SESClient({
        region: config.email.ses.region,
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

      // Create transport with proper SES configuration for AWS SDK v3
      // Nodemailer expects the AWS SDK module to be passed, not just the command
      transport = nodemailer.createTransport({
        SES: { 
          ses: sesClient, 
          aws: require('@aws-sdk/client-ses')
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
  const subject = i18n.__ ? i18n.__('inviteEmail.subject') : 'Welcome to My Phone Friend - Invitation to Join';
  
  let text;
  if (i18n.__) {
    // Get the template and replace %s with the invite link
    const template = i18n.__('inviteEmail.text');
    text = template.replace('%s', inviteLink);
  } else {
    text = `Dear caregiver,\n\nYou have been invited to join My Phone Friend, a secure platform for healthcare communication.\n\nTo accept your invitation and set up your account, please click the link below:\n\n${inviteLink}\n\nThis invitation will expire in 7 days for security purposes.\n\nIf you did not expect this invitation, please ignore this email.\n\nBest regards,\nThe My Phone Friend Team`;
  }
  
  // Create HTML version for better deliverability
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #2c3e50; margin-top: 0;">You're Invited to My Phone Friend!</h2>
        <p style="color: #555; line-height: 1.6;">Dear caregiver,</p>
        <p style="color: #555; line-height: 1.6;">You have been invited to join My Phone Friend, a secure platform for healthcare communication.</p>
        <p style="color: #555; line-height: 1.6;">To accept your invitation and set up your account, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Accept Invitation</a>
        </div>
        <p style="color: #777; font-size: 14px;">This invitation will expire in 7 days for security purposes.</p>
        <p style="color: #777; font-size: 14px;">If you did not expect this invitation, please ignore this email.</p>
        <p style="color: #555; line-height: 1.6; margin-top: 30px;">Welcome to secure healthcare communication!</p>
        <p style="color: #555; line-height: 1.6;">Best regards,<br>The My Phone Friend Team</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">My Phone Friend - Secure Healthcare Communication<br>This email was sent from a verified domain: myphonefriend.com</p>
      </div>
    </div>
  `;
  
  await sendEmail(to, subject, text, html);
  logger.info(`Invite email successfully queued for ${to}`);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = i18n.__ ? i18n.__('sendResetPasswordEmail.subject') : 'My Phone Friend - Password Reset Request';
  const resetLink = `${config.frontendUrl}/reset-password?token=${token}`;
  
  let text;
  if (i18n.__) {
    // Get the template and replace %s with the reset link
    const template = i18n.__('sendResetPasswordEmail.text');
    text = template.replace('%s', resetLink);
  } else {
    text = `Dear caregiver,\n\nWe received a request to reset your My Phone Friend account password.\n\nTo reset your password, please click the link below:\n\n${resetLink}\n\nThis reset link will expire in 1 hour for security purposes.\n\nIf you did not request a password reset, please ignore this email. Your account remains secure.\n\nBest regards,\nThe My Phone Friend Team`;
  }
  
  // Create HTML version for better deliverability
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #2c3e50; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #555; line-height: 1.6;">Dear caregiver,</p>
        <p style="color: #555; line-height: 1.6;">We received a request to reset your My Phone Friend account password.</p>
        <p style="color: #555; line-height: 1.6;">To reset your password, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
        </div>
        <p style="color: #777; font-size: 14px;">This reset link will expire in 1 hour for security purposes.</p>
        <p style="color: #777; font-size: 14px;">If you did not request a password reset, please ignore this email. Your account remains secure.</p>
        <p style="color: #555; line-height: 1.6; margin-top: 30px;">Best regards,<br>The My Phone Friend Team</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">My Phone Friend - Secure Healthcare Communication<br>This email was sent from a verified domain: myphonefriend.com</p>
      </div>
    </div>
  `;
  
  await sendEmail(to, subject, text, html);
  logger.info(`Reset password email successfully queued for ${to}`);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @param {string} [caregiverName] - Optional caregiver name for personalization
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, token, caregiverName = null) => {
  const subject = i18n.__ ? i18n.__('sendVerificationEmail.subject') : 'My Phone Friend - Please Verify Your Email Address';
  
  // Always use frontend URL - frontend will handle routing to backend
  // This ensures the verification page appears in the frontend app
  const verificationLink = `${config.frontendUrl}/auth/verify-email?token=${token}`;
  
  // Use caregiver name if provided, otherwise use generic greeting
  const greeting = caregiverName ? `Dear ${caregiverName},` : 'Dear caregiver,';
  
  let text;
  if (i18n.__) {
    // Get the template and replace %s with the verification link
    const template = i18n.__('sendVerificationEmail.text');
    text = template.replace('%s', verificationLink);
    // Replace greeting if name is provided
    if (caregiverName) {
      text = text.replace(/Dear caregiver,?/i, greeting);
    }
  } else {
    text = `${greeting}\n\nThank you for creating your My Phone Friend account! To complete your registration and ensure account security, please verify your email address.\n\nClick the link below to verify your email:\n\n${verificationLink}\n\nThis verification link will expire in 24 hours for security purposes.\n\nIf you did not create a My Phone Friend account, please ignore this email.\n\nWelcome to secure healthcare communication!\n\nBest regards,\nThe My Phone Friend Team`;
  }
  
  // Create HTML version for better deliverability
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #2c3e50; margin-top: 0;">Welcome to My Phone Friend!</h2>
        <p style="color: #555; line-height: 1.6;">${greeting}</p>
        <p style="color: #555; line-height: 1.6;">Thank you for creating your My Phone Friend account! To complete your registration and ensure account security, please verify your email address.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Your Email</a>
        </div>
        <p style="color: #777; font-size: 14px;">This verification link will expire in 24 hours for security purposes.</p>
        <p style="color: #777; font-size: 14px;">If you did not create a My Phone Friend account, please ignore this email.</p>
        <p style="color: #555; line-height: 1.6; margin-top: 30px;">Welcome to secure healthcare communication!</p>
        <p style="color: #555; line-height: 1.6;">Best regards,<br>The My Phone Friend Team</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">My Phone Friend - Secure Healthcare Communication<br>This email was sent from a verified domain: myphonefriend.com</p>
      </div>
    </div>
  `;
  
  await sendEmail(to, subject, text, html);
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