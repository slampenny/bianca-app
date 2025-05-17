// email.service.js
const nodemailer = require('nodemailer');
// For AWS SDK v3 (recommended)
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
// OR For AWS SDK v2:
// const AWS = require('aws-sdk');
const i18n = require('i18n'); // Assuming you use i18n for email text
const config = require('../config/config'); // Your application's config file
const logger = require('../config/logger'); // Your application's logger

let transport;
let etherealTestAccount = null; // To store Ethereal account details if used

/**
 * Initializes the email transport.
 * This function should be called once at application startup.
 * For development (Ethereal), it's asynchronous.
 */
async function initializeEmailTransport() {
  if (config.env === 'production' || config.env === 'test') {
    logger.info(`Initializing email transport for AWS SES in region: ${config.email.ses.region}`);
    try {
      // For AWS SDK v3
      const sesClient = new SESClient({
        region: config.email.ses.region,
        // Credentials will be automatically sourced by the SDK from the environment
        // (e.g., IAM role for ECS task, environment variables, or shared credentials file)
      });
      transport = nodemailer.createTransport({
        SES: { ses: sesClient, aws: { SendRawEmailCommand } }, // For SDK v3
        // For AWS SDK v2:
        // SES: { ses: new AWS.SES({ apiVersion: '2010-12-01', region: config.email.ses.region }) },
        sendingRate: 1, // Optional: messages per second for SES
      });
      logger.info('Nodemailer transport configured to use AWS SES.');
    } catch (error) {
      logger.error('Failed to initialize AWS SES transport:', error);
      // Fallback or critical error handling
      throw new Error('SES Transport initialization failed.');
    }
  } else { // Development environment - use Ethereal
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
      logger.info('Nodemailer transport configured to use Ethereal.');
      logger.info(`Ethereal Preview URL (base): ${nodemailer.getTestMessageUrl({ messageId: 'test-id' }).split('/message/test-id')[0]}`);
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
}

// Call initializeEmailTransport at startup.
// Since Ethereal account creation is async, the app might need to wait for this.
// Or, handle cases where transport isn't ready yet in sendEmail.
// For simplicity, we assume it's called and awaited or handled.
// In a real app, you'd likely call this in your main app startup sequence.
// e.g., in your index.js: await initializeEmailTransport(); before starting the server.

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
  if (!transport) {
    // This might happen if Ethereal account creation is still pending or failed
    // and initializeEmailTransport wasn't awaited or handled properly at startup.
    logger.error('Email transport is not initialized. Email not sent.');
    if (config.env !== 'production' && config.env !== 'test' && !etherealTestAccount) {
        logger.warn('Attempting to re-initialize Ethereal transport...');
        await initializeEmailTransport(); // Try to initialize again
        if (!transport) throw new Error('Email transport failed to initialize on demand.');
    } else {
        throw new Error('Email transport not initialized.');
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

  try {
    const info = await transport.sendMail(mailOptions);

    if (config.env !== 'production' && config.env !== 'test' && etherealTestAccount) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`Ethereal message sent! Preview URL: ${previewUrl}`);
      } else {
        logger.info(`Ethereal message sent with ID: ${info.messageId} (No preview URL from transport, check Ethereal base URL logged at init)`);
      }
    } else if (info.messageId) { // For SES
      logger.info(`Email sent successfully to ${to} via SES. Message ID: ${info.messageId}`);
    } else { // For console transport or other cases
       logger.info(`Email sent to ${to}. Response: ${JSON.stringify(info)}`);
    }
    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`, error);
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
  // i18n.__ is a placeholder for your actual internationalization function
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
  const resetLink = `${config.apiUrl || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
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
  const verificationLink = `${config.apiUrl || 'http://localhost:3000'}/verify-email?token=${token}`;
  const text = i18n.__ ? i18n.__('sendVerificationEmail.text', verificationLink) : `Verify your email using this link: ${verificationLink}`;
  await sendEmail(to, subject, text);
  logger.info(`Verification email successfully queued for ${to}`);
};

// It's good practice to export an initialization function if setup is async
module.exports = {
  initializeEmailTransport, // Call this at application startup
  sendEmail,
  sendInviteEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
};
