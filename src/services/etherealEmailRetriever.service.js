const imap = require('imap-simple');
const { simpleParser } = require('mailparser');
const emailService = require('./email.service');
const logger = require('../config/logger');

/**
 * Helper function to get all parts from a message structure
 */
function getParts(struct, allParts = []) {
  if (struct.part) {
    struct.part.forEach((part) => {
      getParts(part, allParts);
    });
  } else {
    allParts.push(struct);
  }
  return allParts;
}

/**
 * Retrieve the last email from Ethereal for a given recipient
 * @param {string} recipientEmail - Email address to search for
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Object>} Email object with subject, text, html, and extracted tokens
 */
async function retrieveLastEmail(recipientEmail, timeoutMs = 30000) {
  const emailStatus = emailService.getStatus();
  
  if (!emailStatus.etherealAccount) {
    throw new Error('Ethereal account not available. Make sure NODE_ENV is development or test.');
  }

  const { user, pass } = emailStatus.etherealAccount;
  
  if (!user || !pass) {
    throw new Error('Ethereal credentials not available');
  }

  const config = {
    imap: {
      user,
      password: pass,
      host: 'imap.ethereal.email',
      port: 993,
      tls: true,
      tlsOptions: { 
        rejectUnauthorized: false,
        ciphers: 'SSLv3' // Allow older cipher suites
      },
      authTimeout: timeoutMs,
      connTimeout: 10000, // 10 second connection timeout
      keepalive: true,
      keepaliveInterval: 10000, // Keep connection alive
    },
  };

  // Retry logic for IMAP connection
  let retries = 3;
  let lastError;
  let connection;
  
  while (retries > 0) {
    try {
      logger.info(`[Ethereal Email Retriever] Connecting to Ethereal IMAP to retrieve email for ${recipientEmail} (attempt ${4 - retries}/3)`);
      
      connection = await imap.connect(config);
      break; // Success, exit retry loop
    } catch (connectError) {
      lastError = connectError;
      retries--;
      
      if (retries > 0 && (connectError.message.includes('socket') || connectError.message.includes('connection') || connectError.code === 'ECONNRESET')) {
        logger.warn(`[Ethereal Email Retriever] Connection failed, retrying... (${retries} attempts left): ${connectError.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      } else {
        throw connectError;
      }
    }
  }
  
  if (!connection) {
    throw lastError || new Error('Failed to establish IMAP connection after retries');
  }

  try {
    await connection.openBox('INBOX');
      
      // For Ethereal testing, get the most recent email
      // In test environments, the most recent email should be the one we just sent
      const searchCriteria = ['ALL'];
      const fetchOptions = {
        bodies: '', // Fetch full message bodies
        struct: true,
      };
      
      const allMessages = await connection.search(searchCriteria, fetchOptions);
      
      if (allMessages.length === 0) {
        await connection.end();
        throw new Error(`No emails found in inbox`);
      }
      
      // Get the most recent email (last in array, as they're sorted by date)
      const latestMessage = allMessages[allMessages.length - 1];
      
      // Get the structure to find body parts
      const struct = latestMessage.attributes.struct;
      const parts = getParts(struct);
      
      // Find the text/html parts
      let textPartId = null;
      let htmlPartId = null;
      
      for (const part of parts) {
        if (part.disposition === null && part.id !== 'HEADER') {
          if (part.type === 'text' && part.subtype === 'plain' && !textPartId) {
            textPartId = part.id;
          } else if (part.type === 'text' && part.subtype === 'html' && !htmlPartId) {
            htmlPartId = part.id;
          }
        }
      }
      
      // Get the body part ID (prefer text, fallback to html, then first part)
      const bodyPartId = textPartId || htmlPartId || (parts.length > 0 ? parts[0].id : 'TEXT');
      
      // imap-simple returns parts in message.parts array
      // Each part has a 'which' property matching the part ID
      let bodyData = null;
      
      if (latestMessage.parts && Array.isArray(latestMessage.parts)) {
        const bodyPart = latestMessage.parts.find(part => part.which === bodyPartId);
        if (bodyPart && bodyPart.body) {
          bodyData = bodyPart.body;
        }
      }
      
      // If not found, try to get the first available part
      if (!bodyData && latestMessage.parts && latestMessage.parts.length > 0) {
        for (const part of latestMessage.parts) {
          if (part.body && part.which !== 'HEADER') {
            bodyData = part.body;
            break;
          }
        }
      }
      
      // If still not found, the body might be in the message itself (single part message)
      if (!bodyData && latestMessage.body) {
        bodyData = latestMessage.body;
      }
      
      if (!bodyData) {
        logger.error('Message structure:', JSON.stringify(latestMessage, null, 2));
        throw new Error('Could not find email body part');
      }
      
      // Parse the email using mailparser - bodyData should be a Buffer
      const parsed = await simpleParser(bodyData);
      
      // Verify recipient matches (optional check, but good for validation)
      const toAddress = parsed.to?.text || parsed.to?.value?.[0]?.address || '';
      if (toAddress && !toAddress.toLowerCase().includes(recipientEmail.toLowerCase())) {
        logger.warn(`Most recent email is to ${toAddress}, not ${recipientEmail}. This might be from a previous test.`);
      }
      
      await connection.end();
      
      // Extract tokens from email content
      const emailText = parsed.text || '';
      const emailHtml = parsed.html || '';
      
      // Extract verification token (from verify-email links)
      const verificationTokenMatch = emailText.match(/verify-email\?token=([^\s&]+)/) || 
                                     emailHtml.match(/verify-email\?token=([^"'\s&]+)/);
      const verificationToken = verificationTokenMatch ? verificationTokenMatch[1] : null;
      
      // Extract invite token (from signup?token links)
      const inviteTokenMatch = emailText.match(/signup\?token=([^\s&]+)/) || 
                               emailHtml.match(/signup\?token=([^"'\s&]+)/);
      const inviteToken = inviteTokenMatch ? inviteTokenMatch[1] : null;
      
      // Extract reset password token (from reset-password links)
      const resetTokenMatch = emailText.match(/reset-password\?token=([^\s&]+)/) || 
                              emailHtml.match(/reset-password\?token=([^"'\s&]+)/);
      const resetToken = resetTokenMatch ? resetTokenMatch[1] : null;
      
      logger.info(`[Ethereal Email Retriever] Retrieved email for ${recipientEmail}: ${parsed.subject}`);
      
      return {
        subject: parsed.subject,
        from: parsed.from?.text || parsed.from?.value?.[0]?.address,
        to: parsed.to?.text || parsed.to?.value?.[0]?.address,
        text: emailText,
        html: emailHtml,
        date: parsed.date,
        tokens: {
          verification: verificationToken,
          invite: inviteToken,
          resetPassword: resetToken,
        },
        raw: parsed,
      };
  } catch (error) {
    logger.error(`[Ethereal Email Retriever] Error retrieving email: ${error.message}`);
    throw error;
  } finally {
    // Ensure connection is always ended
    if (connection && connection.state !== 'disconnected') {
      try {
        await connection.end();
      } catch (endError) {
        logger.warn(`[Ethereal Email Retriever] Error closing connection: ${endError.message}`);
      }
    }
  }
}

/**
 * Wait for an email to arrive and retrieve it
 * @param {string} recipientEmail - Email address to wait for
 * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 30000)
 * @param {number} pollIntervalMs - How often to check for new emails (default: 1000)
 * @returns {Promise<Object>} Email object
 */
async function waitForEmail(recipientEmail, maxWaitMs = 30000, pollIntervalMs = 1000) {
  const startTime = Date.now();
  const emailSentTime = Date.now(); // Track when we started waiting (email should be sent around this time)
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const email = await retrieveLastEmail(recipientEmail, 5000);
      // Check if email is recent (within last 10 minutes to account for delays)
      const emailAge = Date.now() - new Date(email.date).getTime();
      if (emailAge < 10 * 60 * 1000) {
        return email;
      } else {
        // Email is too old, might be from a previous test - wait a bit and retry
        logger.info(`Email found but too old (${Math.round(emailAge / 1000)}s), waiting for new email...`);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        continue;
      }
    } catch (error) {
      // Email not found yet, wait and retry
      if (error.message.includes('No emails found') || error.message.includes('not found')) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error(`Timeout waiting for email to ${recipientEmail} after ${maxWaitMs}ms`);
}

module.exports = {
  retrieveLastEmail,
  waitForEmail,
};

