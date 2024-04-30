const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../config/logger');
const i18n = require('i18n');
const transport = nodemailer.createTransport(config.email.smtp);

process.on('exit', () => {
  if (transport) {
    transport.close();
  }
});

/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch(() => logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env'));
}

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
  const subject = i18n.__('inviteEmail.subject');
  const text = i18n.__('inviteEmail.text', inviteLink);
  await sendEmail(to, subject, text);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = i18n.__('sendResetPasswordEmail.subject');
  const text = i18n.__('sendResetPasswordEmail.text', `http://link-to-app/reset-password?token=${token}`);
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
const text = i18n.__('sendVerificationEmail.text', `http://link-to-app/verify-email?token=${token}`);
await sendEmail(to, subject, text);
};

module.exports = {
  transport,
  sendEmail,
  sendInviteEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
};
