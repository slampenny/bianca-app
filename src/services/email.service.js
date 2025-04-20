const nodemailer = require('nodemailer');
const i18n = require('i18n');
const config = require('../config/config');
const logger = require('../config/logger');

const transport = nodemailer.createTransport(config.email.smtp);

process.on('exit', () => {
  if (transport) {
    transport.close();
  }
});

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @returns {Promise}
 */
const sendEmail = async (to, subject, text) => {
  const msg = { from: config.email.from, to, subject, text };
  await transport.sendMail(msg);
};

/**
 * Send invite email
 * @param {string} to
 * @param {string} inviteLink
 * @returns {Promise}
 */
const sendInviteEmail = async (to, inviteLink) => {
  try {
    const subject = i18n.__('inviteEmail.subject');
    const text = i18n.__('inviteEmail.text', inviteLink);
    await sendEmail(to, subject, text);
  } catch (error) {
    logger.error(`Failed to send invite email: ${error}`);
    throw error; // Re-throw the error
  }
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = i18n.__('sendResetPasswordEmail.subject');
  const text = i18n.__('sendResetPasswordEmail.text', `${config.apiUrl}/auth/reset-password?token=${token}`);
  await sendEmail(to, subject, text);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, token) => {
  const subject = i18n.__('sendVerificationEmail.subject');
  const text = i18n.__('sendVerificationEmail.text', `${config.apiUrl}/verify-email?token=${token}`);
  await sendEmail(to, subject, text);
};

module.exports = {
  transport,
  sendEmail,
  sendInviteEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
};
