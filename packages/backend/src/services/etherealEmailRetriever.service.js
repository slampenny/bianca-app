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

function extractTokens(emailText = '', emailHtml = '') {
  const verificationTokenMatch = emailText.match(/verify-email\?token=([^\s&]+)/) || 
                                 emailHtml.match(/verify-email\?token=([^"'\s&]+)/);
  const verificationToken = verificationTokenMatch ? verificationTokenMatch[1] : null;
  
  const inviteTokenMatch = emailText.match(/signup\?token=([^\s&]+)/) || 
                           emailHtml.match(/signup\?token=([^"'\s&]+)/);
  const inviteToken = inviteTokenMatch ? inviteTokenMatch[1] : null;
  
  const resetTokenMatch = emailText.match(/reset-password\?token=([^\s&]+)/) || 
                          emailHtml.match(/reset-password\?token=([^"'\s&]+)/);
  const resetToken = resetTokenMatch ? resetTokenMatch[1] : null;
  
  // Support /client/consent (current) and legacy /patient/consent URLs
  const consentTokenClient =
    emailText.match(/client\/consent[?&]token=([^\s&]+)/) ||
    emailHtml.match(/client\/consent[?&]token=([^"'\s&<>]+)/);
  const consentTokenPatient =
    emailText.match(/patient\/consent[?&]token=([^\s&]+)/) ||
    emailHtml.match(/patient\/consent[?&]token=([^"'\s&<>]+)/);
  const consentToken = consentTokenClient?.[1] || consentTokenPatient?.[1] || null;

  return {
    verification: verificationToken,
    invite: inviteToken,
    resetPassword: resetToken,
    consent: consentToken,
  };
}

/** True if parsed mail is addressed to the given recipient (Ethereal inbox is shared). */
function recipientMatchesParsed(parsed, recipientEmail) {
  const lower = recipientEmail.toLowerCase().trim();
  const values = parsed.to?.value;
  if (Array.isArray(values) && values.length > 0) {
    return values.some((v) => v.address && v.address.toLowerCase() === lower);
  }
  const text = parsed.to?.text || '';
  return text.toLowerCase().includes(lower);
}

/** Pull body buffer from an imap-simple message and parse with mailparser. */
async function parseImapMessageBody(latestMessage) {
  const struct = latestMessage.attributes.struct;
  const parts = getParts(struct);

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

  const bodyPartId = textPartId || htmlPartId || (parts.length > 0 ? parts[0].id : 'TEXT');

  let bodyData = null;

  if (latestMessage.parts && Array.isArray(latestMessage.parts)) {
    const bodyPart = latestMessage.parts.find((part) => part.which === bodyPartId);
    if (bodyPart && bodyPart.body) {
      bodyData = bodyPart.body;
    }
  }

  if (!bodyData && latestMessage.parts && latestMessage.parts.length > 0) {
    for (const part of latestMessage.parts) {
      if (part.body && part.which !== 'HEADER') {
        bodyData = part.body;
        break;
      }
    }
  }

  if (!bodyData && latestMessage.body) {
    bodyData = latestMessage.body;
  }

  if (!bodyData) {
    return null;
  }

  return simpleParser(bodyData);
}

function buildResultFromCaptured(captured) {
  const emailText = captured.text || '';
  const emailHtml = captured.html || '';
  return {
    subject: captured.subject,
    from: captured.from,
    to: captured.to,
    text: emailText,
    html: emailHtml,
    date: captured.date,
    tokens: extractTokens(emailText, emailHtml),
    raw: captured,
  };
}

/**
 * Retrieve the last email from Ethereal for a given recipient
 * @param {string} recipientEmail - Email address to search for
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Object>} Email object with subject, text, html, and extracted tokens
 */
async function retrieveLastEmail(recipientEmail, timeoutMs = 30000) {
  const emailStatus = emailService.getStatus();

  // Prefer in-memory capture when present (matches sendEmail when config.env === 'test').
  // If config.env is not "test" but capture still has the message, return it before hitting empty IMAP.
  const capturedFirst = emailService.getLastCapturedEmail(recipientEmail);
  if (capturedFirst) {
    return buildResultFromCaptured(capturedFirst);
  }

  // Must match email.service sendEmail(): when config.env === 'test', mail is only captured in memory (no IMAP).
  let useCaptureOnly = false;
  try {
    useCaptureOnly =
      require('../config/config').env === 'test' || process.env.E2E_CAPTURE_EMAILS === '1';
  } catch {
    useCaptureOnly = process.env.NODE_ENV === 'test' || process.env.E2E_CAPTURE_EMAILS === '1';
  }

  if (useCaptureOnly) {
    throw new Error(
      `No captured email for ${recipientEmail}. In test mode emails are not sent to Ethereal IMAP; ensure sendEmail ran for this address.`
    );
  }

  if (!emailStatus.etherealAccount) {
    if (process.env.NODE_ENV === 'test') {
      throw new Error('No emails found in inbox');
    }
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

      // Inbox is shared across tests; walk newest → oldest until we find this recipient.
      let parsed = null;
      for (let i = allMessages.length - 1; i >= 0; i -= 1) {
        const mailItem = allMessages[i];
        try {
          const candidate = await parseImapMessageBody(mailItem);
          if (!candidate) {
            logger.warn(`[Ethereal Email Retriever] Could not parse body for message index ${i}, skipping`);
            continue;
          }
          if (recipientMatchesParsed(candidate, recipientEmail)) {
            parsed = candidate;
            break;
          }
        } catch (parseErr) {
          logger.warn(`[Ethereal Email Retriever] Parse error for message index ${i}: ${parseErr.message}`);
        }
      }

      if (!parsed) {
        await connection.end();
        throw new Error(
          `No email found for recipient ${recipientEmail} in Ethereal inbox (checked ${allMessages.length} message(s); inbox may only contain mail for other addresses)`
        );
      }

      await connection.end();

      const emailText = parsed.text || '';
      const emailHtml = parsed.html || '';

      logger.info(`[Ethereal Email Retriever] Retrieved email for ${recipientEmail}: ${parsed.subject}`);

      return {
        subject: parsed.subject,
        from: parsed.from?.text || parsed.from?.value?.[0]?.address,
        to: parsed.to?.text || parsed.to?.value?.[0]?.address,
        text: emailText,
        html: emailHtml,
        date: parsed.date,
        tokens: extractTokens(emailText, emailHtml),
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
      // Email not found yet, wait and retry (IMAP empty, wrong recipient in shared inbox, or slow delivery)
      const msg = error.message || '';
      if (
        msg.includes('No emails found') ||
        msg.includes('No email found for recipient') ||
        msg.includes('not found')
      ) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
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

