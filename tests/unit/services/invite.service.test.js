const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const inviteService = require('../../../src/services');
const { Token } = require('../../../src/models');
const config = require('../../../src/config/config');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start(); // Fix: Use start() function instead of new keyword
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
const { generateInviteToken } = require('../path/to/inviteService');

describe ('inviteService', () => {
  describe('generateInviteToken', () => {
    beforeEach(() => {
      jwt.sign.mockClear();
      Token.deleteMany();
    });

    it('should generate an invite token and store it in the database', async () => {
      const orgId = 'org123';
      const email = 'test@example.com';
      const expectedToken = 'fakeToken123';
      jwt.sign.mockReturnValue(expectedToken);
      Token.create.mockResolvedValue({ token: expectedToken, type: 'INVITE' });

      const result = await generateInviteToken(orgId, email);

      expect(jwt.sign).toHaveBeenCalledWith({ org: orgId, email }, config.jwt.secret, { expiresIn: config.jwt.accessExpirationMinutes });
      expect(Token.create).toHaveBeenCalledWith({ token: expectedToken, type: 'INVITE' });
      expect(result).toBe(expectedToken);
    });

    it('should handle token storage failure', async () => {
      const orgId = 'org123';
      const email = 'test@example.com';
      jwt.sign.mockReturnValue('validToken');
      Token.create.mockRejectedValue(new Error('DB Error'));

      await expect(generateInviteToken(orgId, email)).rejects.toThrow('DB Error');

      expect(jwt.sign).toHaveBeenCalledWith({ org: orgId, email }, config.jwt.secret, { expiresIn: config.jwt.accessExpirationMinutes });
      expect(Token.create).toHaveBeenCalled();
    });
  });

  describe('verifyInviteToken', () => {
    it('should verify the token and return the payload if valid and exists in the database', async () => {
      const validToken = 'validToken123';
      const payload = { org: 'org123', email: 'test@example.com' };
      jwt.verify.mockReturnValue(payload);
      Token.findOne.mockResolvedValue({ token: validToken, type: 'INVITE' });

      const result = await verifyInviteToken(validToken);

      expect(jwt.verify).toHaveBeenCalledWith(validToken, config.jwt.secret);
      expect(Token.findOne).toHaveBeenCalledWith({ token: validToken, type: 'INVITE' });
      expect(result).toEqual(payload);
    });

    it('should throw an error if the token is invalid', async () => {
      const invalidToken = 'invalidToken123';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(verifyInviteToken(invalidToken)).rejects.toThrow('Invalid token');

      expect(jwt.verify).toHaveBeenCalledWith(invalidToken, config.jwt.secret);
    });

    it('should throw an error if the token is not found in the database', async () => {
      const notFoundToken = 'notFoundToken123';
      jwt.verify.mockReturnValue({}); // valid jwt but not in db
      Token.findOne.mockResolvedValue(null);

      await expect(verifyInviteToken(notFoundToken)).rejects.toThrow('Invalid or expired invite token');

      expect(Token.findOne).toHaveBeenCalledWith({ token: notFoundToken, type: 'INVITE' });
    });
  });
});
