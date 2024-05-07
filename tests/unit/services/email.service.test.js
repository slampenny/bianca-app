const emailService = require('../path/to/emailService');
const nodemailer = require('nodemailer');

jest.mock('nodemailer');

const mockSendMail = jest.fn();
nodemailer.createTransport.mockReturnValue({
  sendMail: mockSendMail,
  close: jest.fn(),
});

describe('emailService', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
  });

  it('should send an invite email correctly', async () => {
    const email = 'test@example.com';
    const inviteLink = 'http://example.com/signup?token=123';

    await emailService.sendInviteEmail(email, inviteLink);

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: email,
      text: expect.stringContaining(inviteLink), // Assuming i18n is configured properly for the test
    }));
  });

  it('should handle email send failure gracefully', async () => {
    mockSendMail.mockRejectedValue(new Error('Failed to send email'));
    
    await expect(emailService.sendInviteEmail('test@example.com', 'http://example.com/signup?token=123'))
      .resolves.toBeUndefined(); // Adjust based on how you handle errors

    expect(mockSendMail).toHaveBeenCalled();
  });
});
