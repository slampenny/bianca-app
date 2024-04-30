const request = require('supertest');
const httpStatus = require('http-status');
const httpMocks = require('node-mocks-http');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../../src/config/config');
const auth = require('../../src/middlewares/auth');
const { tokenService, emailService } = require('../../src/services');
const ApiError = require('../../src/utils/ApiError');
const { Org, Caregiver, Token } = require('../../src/models');
const { roleRights } = require('../../src/config/roles');
const { tokenTypes } = require('../../src/config/tokens');
const { caregiverOne, caregiverOneWithPassword, password, fakeId, admin, insertCaregivers, caregiverTwo } = require('../fixtures/caregiver.fixture');

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

describe('Auth routes', () => {
  afterEach(async () => {
    // Delete the org after each test
    await Org.deleteMany();
    // Delete the caregiver after each test
    await Caregiver.deleteMany();
    await Token.deleteMany();
  });

  describe('POST /v1/auth/register', () => {
    test('should return 201 and successfully register caregiver if request data is ok', async () => {
      const res = await request(app).post('/v1/auth/register').send({
        name: caregiverOne.name,
        email: caregiverOne.email,
        phone: caregiverOne.phone,
        password: password,
      }).expect(httpStatus.CREATED);
      
      const caregiver = res.body.org.caregivers[0];

      expect(caregiver).not.toHaveProperty('password');
      expect(caregiver).toEqual({
        id: expect.anything(),
        name: caregiverOne.name,
        email: caregiverOne.email,
        phone: caregiverOne.phone,
        role: 'orgAdmin',
        patients: [],
        isEmailVerified: false,
      });

      const dbCaregiver = await Caregiver.findById(caregiver.id);
      expect(dbCaregiver).toBeDefined();
      expect(dbCaregiver).toMatchObject({ name: caregiverOne.name, email: caregiverOne.email, role: 'orgAdmin', isEmailVerified: false });

      expect(res.body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    test('should return 400 error if email is invalid', async () => {
      await request(app).post('/v1/auth/register').send({
        name: caregiverOne.name,
        email: 'invalidEmail',
        phone: caregiverOne.phone,
        password: password,
      }).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if email is already used', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).post('/v1/auth/register').send({
        name: caregiverTwo.name,
        email: caregiverOne.email,
        phone: caregiverTwo.phone,
        password: password,
      }).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password length is less than 8 characters', async () => {
      await request(app).post('/v1/auth/register').send({
        name: caregiverOne.name,
        email: caregiverOne.email,
        phone: caregiverOne.phone,
        password: 'passwo1',
      }).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password does not contain both letters and numbers', async () => {
      await request(app).post('/v1/auth/register').send({
        name: caregiverOne.name,
        email: caregiverOne.email,
        phone: caregiverOne.phone,
        password: 'password',
      }).expect(httpStatus.BAD_REQUEST);

      await request(app).post('/v1/auth/register').send({
        name: caregiverOne.name,
        email: caregiverOne.email,
        phone: caregiverOne.phone,
        password: '11111111',
      }).expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/login', () => {
    test('should return 200 and login caregiver if email and password match', async () => {
      await insertCaregivers([caregiverOneWithPassword]);
      const loginCredentials = {
        email: caregiverOneWithPassword.email,
        password: password,
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.OK);

      expect(res.body.caregiver).toEqual({
        id: expect.anything(),
        name: caregiverOne.name,
        email: caregiverOne.email,
        phone: caregiverOne.phone,
        role: 'staff',
        patients: [],
        isEmailVerified: false,
      });

      expect(res.body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    test('should return 401 error if there are no caregivers with that email', async () => {
      const loginCredentials = {
        email: caregiverOneWithPassword.email,
        password: caregiverOneWithPassword.password,
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });

    test('should return 401 error if password is wrong', async () => {
      await insertCaregivers([caregiverOneWithPassword]);
      const loginCredentials = {
        email: caregiverOne.email,
        password: 'wrongPassword1',
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });
  });

  describe('POST /v1/auth/logout', () => {
    test('should return 204 if refresh token is valid', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOneWithPassword]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, dbCaregiver.id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(httpStatus.NO_CONTENT);

      const dbRefreshTokenDoc = await Token.findOne({ token: refreshToken });
      expect(dbRefreshTokenDoc).toBe(null);
    });

    test('should return 400 error if refresh token is missing from request body', async () => {
      await request(app).post('/v1/auth/logout').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if refresh token is not found in the database', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOneWithPassword]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(httpStatus.NOT_FOUND);
    });

    test('should return 404 error if refresh token is blacklisted', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOneWithPassword]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, dbCaregiver.id, expires, tokenTypes.REFRESH, true);

      await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /v1/auth/refresh-tokens', () => {
    test('should return 200 and new auth tokens if refresh token is valid', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOneWithPassword]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, dbCaregiver.id, expires, tokenTypes.REFRESH);

      const res = await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.OK);

      expect(res.body).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });

      const dbRefreshTokenDoc = await Token.findOne({ token: res.body.refresh.token });
      expect(dbRefreshTokenDoc.caregiver.toHexString()).toBe(dbCaregiver.id);
      expect(dbRefreshTokenDoc).toMatchObject({ type: tokenTypes.REFRESH, blacklisted: false });
      //expect(dbRefreshTokenDoc).toMatchObject({ type: tokenTypes.REFRESH, caregiver: dbCaregiver.id, blacklisted: false });

      const dbRefreshTokenCount = await Token.countDocuments();
      expect(dbRefreshTokenCount).toBe(1);
    });

    test('should return 400 error if refresh token is missing from request body', async () => {
      await request(app).post('/v1/auth/refresh-tokens').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 error if refresh token is signed using an invalid secret', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOneWithPassword]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH, 'invalidSecret');
      await tokenService.saveToken(refreshToken, dbCaregiver.id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is not found in the database', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is blacklisted', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, dbCaregiver.id, expires, tokenTypes.REFRESH, true);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is expired', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().subtract(1, 'minutes');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires);
      await tokenService.saveToken(refreshToken, dbCaregiver.id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if caregiver is not found', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOneWithPassword]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, dbCaregiver.id, expires, tokenTypes.REFRESH);

      dbCaregiver.remove();
      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/forgot-password', () => {
    beforeEach(() => {
      jest.spyOn(emailService.transport, 'sendMail').mockResolvedValue();
    });

    test('should return 204 and send reset password email to the caregiver', async () => {
      await insertCaregivers([caregiverOne]);
      const sendResetPasswordEmailSpy = jest.spyOn(emailService, 'sendResetPasswordEmail');

      await request(app).post('/v1/auth/forgot-password').send({ email: caregiverOne.email }).expect(httpStatus.NO_CONTENT);

      expect(sendResetPasswordEmailSpy).toHaveBeenCalledWith(caregiverOne.email, expect.any(String));
      const resetPasswordToken = sendResetPasswordEmailSpy.mock.calls[0][1];
      const dbResetPasswordTokenDoc = await Token.findOne({ token: resetPasswordToken, caregiver: caregiverOne._id });
      expect(dbResetPasswordTokenDoc).toBeDefined();
    });

    test('should return 400 if email is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).post('/v1/auth/forgot-password').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 if email does not belong to any caregiver', async () => {
      await request(app).post('/v1/auth/forgot-password').send({ email: caregiverOne.email }).expect(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /v1/auth/reset-password', () => {
    test('should return 204 and reset the password', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOneWithPassword]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.NO_CONTENT);

      const dbNewCaregiver = await Caregiver.findById(dbCaregiver.id);
      const isPasswordMatch = await bcrypt.compare('password2', dbNewCaregiver.password);
      expect(isPasswordMatch).toBe(true);

      const dbResetPasswordTokenCount = await Token.countDocuments({ caregiver: dbNewCaregiver.id, type: tokenTypes.RESET_PASSWORD });
      expect(dbResetPasswordTokenCount).toBe(0);
    });

    test('should return 400 if reset password token is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).post('/v1/auth/reset-password').send({ password: 'password2' }).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if reset password token is blacklisted', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD, true);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if reset password token is expired', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().subtract(1, 'minutes');
      const resetPasswordToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if caregiver is not found', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);
      dbCaregiver.remove();
      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 400 if password is missing or invalid', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, dbCaregiver.id, expires, tokenTypes.RESET_PASSWORD);

      await request(app).post('/v1/auth/reset-password').query({ token: resetPasswordToken }).expect(httpStatus.BAD_REQUEST);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'short1' })
        .expect(httpStatus.BAD_REQUEST);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password' })
        .expect(httpStatus.BAD_REQUEST);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: '11111111' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/send-verification-email', () => {
    beforeEach(() => {
      jest.spyOn(emailService.transport, 'sendMail').mockResolvedValue();
    });

    test('should return 204 and send verification email to the caregiver', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const sendVerificationEmailSpy = jest.spyOn(emailService, 'sendVerificationEmail');
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const accessToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.ACCESS);
      await request(app)
        .post('/v1/auth/send-verification-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.NO_CONTENT);

      expect(sendVerificationEmailSpy).toHaveBeenCalledWith(caregiverOne.email, expect.any(String));
      const verifyEmailToken = sendVerificationEmailSpy.mock.calls[0][1];
      const dbVerifyEmailToken = await Token.findOne({ token: verifyEmailToken, caregiver: dbCaregiver.id });

      expect(dbVerifyEmailToken).toBeDefined();
    });

    test('should return 401 error if access token is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).post('/v1/auth/send-verification-email').send().expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/verify-email', () => {
    test('should return 204 and verify the email', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(dbCaregiver.id, expires);
      await tokenService.saveToken(verifyEmailToken, dbCaregiver.id, expires, tokenTypes.VERIFY_EMAIL);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbNewCaregiver = await Caregiver.findById(dbCaregiver._id);

      expect(dbNewCaregiver.isEmailVerified).toBe(true);

      const dbVerifyEmailToken = await Token.countDocuments({
        caregiver: dbNewCaregiver.id,
        type: tokenTypes.VERIFY_EMAIL,
      });
      expect(dbVerifyEmailToken).toBe(0);
    });

    test('should return 400 if verify email token is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).post('/v1/auth/verify-email').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if verify email token is blacklisted', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(dbCaregiver.id, expires);
      await tokenService.saveToken(verifyEmailToken, dbCaregiver.id, expires, tokenTypes.VERIFY_EMAIL, true);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if verify email token is expired', async () => {
      const [dbCaregiver] = await insertCaregivers([caregiverOne]);
      const expires = moment().subtract(1, 'minutes');
      const verifyEmailToken = tokenService.generateToken(dbCaregiver.id, expires);
      await tokenService.saveToken(verifyEmailToken, dbCaregiver.id, expires, tokenTypes.VERIFY_EMAIL);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if caregiver is not found', async () => {
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(fakeId, expires);
      await tokenService.saveToken(verifyEmailToken, fakeId, expires, tokenTypes.VERIFY_EMAIL);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });
  });
});

describe('Auth middleware', () => {
  afterEach(async () => {
    // Delete the org after each test
    await Org.deleteMany();
    // Delete the caregiver after each test
    await Caregiver.deleteMany();
    await Token.deleteMany();
  });

  test('should call next with no errors if access token is valid', async () => {
    const [dbCaregiver] = await insertCaregivers([caregiverOne]);
    const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.ACCESS);
    
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.caregiver.id).toEqual(dbCaregiver.id);
  });

  test('should call next with unauthorized error if access token is not found in header', async () => {
    await insertCaregivers([caregiverOne]);
    const req = httpMocks.createRequest();
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with unauthorized error if access token is not a valid jwt token', async () => {
    await insertCaregivers([caregiverOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: 'Bearer randomToken' } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with unauthorized error if the token is not an access token', async () => {
    const [dbCaregiver] = await insertCaregivers([caregiverOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const refreshToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.REFRESH);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${refreshToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with unauthorized error if access token is generated with an invalid secret', async () => {
    const [dbCaregiver] = await insertCaregivers([caregiverOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.ACCESS, 'invalidSecret');
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with unauthorized error if access token is expired', async () => {
    const [dbCaregiver] = await insertCaregivers([caregiverOne]);
    const expires = moment().subtract(1, 'minutes');
    const accessToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.ACCESS);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with unauthorized error if caregiver is not found', async () => {
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(fakeId, expires, tokenTypes.ACCESS);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with forbidden error if caregiver does not have required rights and caregiverId is not in params', async () => {
    const [dbCaregiver] = await insertCaregivers([caregiverOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.ACCESS);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: httpStatus.FORBIDDEN, message: 'Forbidden' }));
  });

  test('should call next with no errors if caregiver does not have required rights but caregiverId is in params', async () => {
    const [dbCaregiver] = await insertCaregivers([caregiverOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(dbCaregiver.id, expires, tokenTypes.ACCESS);
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { caregiverId: dbCaregiver.id },
    });
    const next = jest.fn();

    await auth('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should call next with no errors if caregiver has required rights', async () => {
    const [adminCaregiver] = await insertCaregivers([admin]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(adminCaregiver.id, expires, tokenTypes.ACCESS);
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { caregiverId: adminCaregiver.id },
    });
    const next = jest.fn();

    await auth(...roleRights.get('orgAdmin'))(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
