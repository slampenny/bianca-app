const { emailService } = require('../../../src/services');
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const config = require('../../../src/config/config');

// Mock i18n
jest.mock('i18n', () => ({
  __: jest.fn((key, value) => key === 'inviteEmail.text' ? `Invite link: ${value}` : key),
}));

describe('emailService', () => {
  let transport;
  let connection;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeAll(async () => {
    // Set up Ethereal Email transport
    transport = nodemailer.createTransport({
      ...config.email.smtp
    });

    // Set up Ethereal IMAP client
    const imapConfig = {
      imap: {
        user: config.email.smtp.auth.user,
        password: config.email.smtp.auth.pass,
        host: 'imap.ethereal.email',
        port: 993,
      tls: true,
      }
    };

    // Connect and authenticate IMAP client
    connection = await imaps.connect(imapConfig);
  });

  afterAll(async () => {
    // Close transport and mailbox
    transport.close();

    // Wait for all pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Destroy connection
    if (connection) {
      connection.imap.destroy();
    } else {
      console.log("No connection");
    }
  }); // Increase timeout to 30 seconds

  it('should send an invite email correctly', async () => {
    const email = 'test@example.com';
    const inviteLink = 'http://example.com/signup?token=123';

    // Send email
    await emailService.sendInviteEmail(email, inviteLink);

    //await new Promise(resolve => setTimeout(resolve, 2000));

    await connection.openBox('INBOX');
    const results = await connection.search(['ALL']);
    const allEmails = results.length; 
    await connection.closeBox(err => {
      if (err) {
        console.error('Failed to close box:', err);
      }
    });

    expect(allEmails).toBeGreaterThan(0);
  });

  // it('should handle email send failure gracefully', async () => {
  //   // Mock sendMail to throw an error
  //   emailService.sendEmail = jest.fn().mockImplementation(() => {
  //     console.log('sendEmail called');
  //     return Promise.reject(new Error('Failed to send email'));
  //   });

  //   const email = 'test@example.com';
  //   const inviteLink = 'http://example.com/signup?token=123';

  //   // Attempt to send email
  //   let error;
  //   try {
  //     await emailService.sendInviteEmail(email, inviteLink);
  //   } catch (e) {
  //     error = e;
  //   }

  //   // Check that an error was thrown
  //   expect(error).toBeDefined();
  //   expect(error.message).toBe('Failed to send email');
  // });
});