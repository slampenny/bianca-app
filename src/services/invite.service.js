const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { Token } = require('../models');

const generateInviteToken = async (orgId, email) => {
  const payload = { org: orgId, email };
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpirationMinutes });
  await Token.create({ token, type: 'invite' });
  return token;
};

const verifyInviteToken = async (token) => {
  const payload = jwt.verify(token, config.jwt.secret);
  const invite = await Token.findOne({ token, type: 'invite' });
  if (!invite) {
    throw new Error('Invalid or expired invite token');
  }
  return payload;
};

module.exports = {
  generateInviteToken,
  verifyInviteToken,
};