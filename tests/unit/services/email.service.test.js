const { emailService } = require('../../../src/services');
const nodemailer = require('nodemailer');
const imap = require('imap');
const util = require('util');
const config = require('../../../src/config/config');

jest.mock("i18n");

describe('emailService', () => {
  let transport;
  let mailbox;

  beforeAll(() => {
    // Set up Ethereal Email transport
    transport = nodemailer.createTransport({
      ...config.email.smtp
    });

    // Set up Ethereal IMAP client
    mailbox = new imap({
      user: config.email.smtp.auth.user,
      password: config.email.smtp.auth.pass,
      host: 'imap.ethereal.email',
      port: 993,
      tls: true,
    });

    // Promisify necessary IMAP methods
    mailbox.openBox = util.promisify(mailbox.openBox);
    mailbox.search = util.promisify(mailbox.search);
  });

  afterAll(() => {
    // Close transport and mailbox
    transport.close();
    mailbox.end();
  });

  it('should send an invite email correctly', async () => {
    const email = 'test@example.com';
    const inviteLink = 'http://example.com/signup?token=123';

    // Send email
    await emailService.sendInviteEmail(email, inviteLink);

    // Check Ethereal inbox
    await new Promise((resolve) => mailbox.once('ready', resolve));
    await mailbox.openBox('INBOX', true);
    const results = await mailbox.search(['UNSEEN']);
    const unseenEmails = results.length;

    expect(unseenEmails).toBeGreaterThan(0);
  });

  it('should handle email send failure gracefully', async () => {
    // Mock sendMail to throw an error
    emailService.sendEmail = jest.fn().mockImplementation(() => {
      console.log('sendEmail called');
      return Promise.reject(new Error('Failed to send email'));
    });

    const email = 'test@example.com';
    const inviteLink = 'http://example.com/signup?token=123';

    // Attempt to send email
    let error;
    try {
      await emailService.sendInviteEmail(email, inviteLink);
    } catch (e) {
      error = e;
    }

    // Check that an error was thrown
    expect(error).toBeDefined();
    expect(error.message).toBe('Failed to send email');
  });
});