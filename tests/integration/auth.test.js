const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');
const httpMocks = require('node-mocks-http');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const config = require('../../src/config/config');
const auth = require('../../src/middlewares/auth');
const { tokenService, emailService } = require('../../src/services');
const ApiError = require('../../src/utils/ApiError');
const setupTestDB = require('../utils/setupTestDB');
const { Caregiver, Token } = require('../../src/models');
const { roleRights } = require('../../src/config/roles');
const { tokenTypes } = require('../../src/config/tokens');
const { caregiverOne, admin, insertCaregivers } = require('../fixtures/caregiver.fixture');

setupTestDB();

describe('Auth routes', () => {
  describe('POST /v1/auth/register', () => {
    let newCaregiver;
    beforeEach(() => {
      newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: '+16045624263'
      };
    });

    test('should return 201 and successfully register caregiver if request data is ok', async () => {
      const res = await request(app).post('/v1/auth/register').send(newCaregiver).expect(httpStatus.CREATED);

      expect(res.body.caregiver).not.toHaveProperty('password');
      expect(res.body.caregiver).toEqual({
        id: expect.anything(),
        name: newCaregiver.name,
        email: newCaregiver.email,
        phone: newCaregiver.phone,
        role: 'staff',
        caregiver: null,
        schedules: [],
        isEmailVerified: false,
      });

      const dbCaregiver = await Caregiver.findById(res.body.caregiver.id);
      expect(dbCaregiver).toBeDefined();
      expect(dbCaregiver.password).not.toBe(newCaregiver.password);
      expect(dbCaregiver).toMatchObject({ name: newCaregiver.name, email: newCaregiver.email, role: 'caregiver', isEmailVerified: false });

      expect(res.body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    test('should return 400 error if email is invalid', async () => {
      newCaregiver.email = 'invalidEmail';

      await request(app).post('/v1/auth/register').send(newCaregiver).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if email is already used', async () => {
      await insertCaregivers([caregiverOne]);
      newCaregiver.email = caregiverOne.email;

      await request(app).post('/v1/auth/register').send(newCaregiver).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password length is less than 8 characters', async () => {
      newCaregiver.password = 'passwo1';

      await request(app).post('/v1/auth/register').send(newCaregiver).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password does not contain both letters and numbers', async () => {
      newCaregiver.password = 'password';

      await request(app).post('/v1/auth/register').send(newCaregiver).expect(httpStatus.BAD_REQUEST);

      newCaregiver.password = '11111111';

      await request(app).post('/v1/auth/register').send(newCaregiver).expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/login', () => {
    test('should return 200 and login caregiver if email and password match', async () => {
      await insertCaregivers([caregiverOne]);
      const loginCredentials = {
        email: caregiverOne.email,
        password: caregiverOne.password,
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.OK);

      expect(res.body.caregiver).toEqual({
        id: expect.anything(),
        name: caregiverOne.name,
        email: caregiverOne.email,
        phone: caregiverOne.phone,
        role: caregiverOne.role,
        caregiver: null,
        schedules: [],
        isEmailVerified: false,
      });

      expect(res.body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });
    });

    test('should return 401 error if there are no caregivers with that email', async () => {
      const loginCredentials = {
        email: caregiverOne.email,
        password: caregiverOne.password,
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });

    test('should return 401 error if password is wrong', async () => {
      await insertCaregivers([caregiverOne]);
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
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, caregiverOne._id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(httpStatus.NO_CONTENT);

      const dbRefreshTokenDoc = await Token.findOne({ token: refreshToken });
      expect(dbRefreshTokenDoc).toBe(null);
    });

    test('should return 400 error if refresh token is missing from request body', async () => {
      await request(app).post('/v1/auth/logout').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if refresh token is not found in the database', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(httpStatus.NOT_FOUND);
    });

    test('should return 404 error if refresh token is blacklisted', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, caregiverOne._id, expires, tokenTypes.REFRESH, true);

      await request(app).post('/v1/auth/logout').send({ refreshToken }).expect(httpStatus.NOT_FOUND);
    });
  });

  describe('POST /v1/auth/refresh-tokens', () => {
    test('should return 200 and new auth tokens if refresh token is valid', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, caregiverOne._id, expires, tokenTypes.REFRESH);

      const res = await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.OK);

      expect(res.body).toEqual({
        access: { token: expect.anything(), expires: expect.anything() },
        refresh: { token: expect.anything(), expires: expect.anything() },
      });

      const dbRefreshTokenDoc = await Token.findOne({ token: res.body.refresh.token });
      expect(dbRefreshTokenDoc).toMatchObject({ type: tokenTypes.REFRESH, caregiver: caregiverOne._id, blacklisted: false });

      const dbRefreshTokenCount = await Token.countDocuments();
      expect(dbRefreshTokenCount).toBe(1);
    });

    test('should return 400 error if refresh token is missing from request body', async () => {
      await request(app).post('/v1/auth/refresh-tokens').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 error if refresh token is signed using an invalid secret', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH, 'invalidSecret');
      await tokenService.saveToken(refreshToken, caregiverOne._id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is not found in the database', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is blacklisted', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, caregiverOne._id, expires, tokenTypes.REFRESH, true);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is expired', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().subtract(1, 'minutes');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires);
      await tokenService.saveToken(refreshToken, caregiverOne._id, expires, tokenTypes.REFRESH);

      await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken }).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if caregiver is not found', async () => {
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, caregiverOne._id, expires, tokenTypes.REFRESH);

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
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.NO_CONTENT);

      const dbCaregiver = await Caregiver.findById(caregiverOne._id);
      const isPasswordMatch = await bcrypt.compare('password2', dbCaregiver.password);
      expect(isPasswordMatch).toBe(true);

      const dbResetPasswordTokenCount = await Token.countDocuments({ caregiver: caregiverOne._id, type: tokenTypes.RESET_PASSWORD });
      expect(dbResetPasswordTokenCount).toBe(0);
    });

    test('should return 400 if reset password token is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).post('/v1/auth/reset-password').send({ password: 'password2' }).expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if reset password token is blacklisted', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, caregiverOne._id, expires, tokenTypes.RESET_PASSWORD, true);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if reset password token is expired', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().subtract(1, 'minutes');
      const resetPasswordToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if caregiver is not found', async () => {
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);

      await request(app)
        .post('/v1/auth/reset-password')
        .query({ token: resetPasswordToken })
        .send({ password: 'password2' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 400 if password is missing or invalid', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
      const resetPasswordToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);
      await tokenService.saveToken(resetPasswordToken, caregiverOne._id, expires, tokenTypes.RESET_PASSWORD);

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
      await insertCaregivers([caregiverOne]);
      const sendVerificationEmailSpy = jest.spyOn(emailService, 'sendVerificationEmail');

      await request(app)
        .post('/v1/auth/send-verification-email')
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .expect(httpStatus.NO_CONTENT);

      expect(sendVerificationEmailSpy).toHaveBeenCalledWith(caregiverOne.email, expect.any(String));
      const verifyEmailToken = sendVerificationEmailSpy.mock.calls[0][1];
      const dbVerifyEmailToken = await Token.findOne({ token: verifyEmailToken, caregiver: caregiverOne._id });

      expect(dbVerifyEmailToken).toBeDefined();
    });

    test('should return 401 error if access token is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).post('/v1/auth/send-verification-email').send().expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/verify-email', () => {
    test('should return 204 and verify the email', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(caregiverOne._id, expires);
      await tokenService.saveToken(verifyEmailToken, caregiverOne._id, expires, tokenTypes.VERIFY_EMAIL);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbCaregiver = await Caregiver.findById(caregiverOne._id);

      expect(dbCaregiver.isEmailVerified).toBe(true);

      const dbVerifyEmailToken = await Token.countDocuments({
        caregiver: caregiverOne._id,
        type: tokenTypes.VERIFY_EMAIL,
      });
      expect(dbVerifyEmailToken).toBe(0);
    });

    test('should return 400 if verify email token is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).post('/v1/auth/verify-email').send().expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if verify email token is blacklisted', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(caregiverOne._id, expires);
      await tokenService.saveToken(verifyEmailToken, caregiverOne._id, expires, tokenTypes.VERIFY_EMAIL, true);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if verify email token is expired', async () => {
      await insertCaregivers([caregiverOne]);
      const expires = moment().subtract(1, 'minutes');
      const verifyEmailToken = tokenService.generateToken(caregiverOne._id, expires);
      await tokenService.saveToken(verifyEmailToken, caregiverOne._id, expires, tokenTypes.VERIFY_EMAIL);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if caregiver is not found', async () => {
      const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
      const verifyEmailToken = tokenService.generateToken(caregiverOne._id, expires);
      await tokenService.saveToken(verifyEmailToken, caregiverOne._id, expires, tokenTypes.VERIFY_EMAIL);

      await request(app)
        .post('/v1/auth/verify-email')
        .query({ token: verifyEmailToken })
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });
  });
});

describe('Auth middleware', () => {
  test('should call next with no errors if access token is valid', async () => {
    await insertCaregivers([caregiverOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${caregiverOneAccessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.caregiver._id).toEqual(caregiverOne._id);
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
    await insertCaregivers([caregiverOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const refreshToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.REFRESH);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${refreshToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with unauthorized error if access token is generated with an invalid secret', async () => {
    await insertCaregivers([caregiverOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.ACCESS, 'invalidSecret');
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with unauthorized error if access token is expired', async () => {
    await insertCaregivers([caregiverOne]);
    const expires = moment().subtract(1, 'minutes');
    const accessToken = tokenService.generateToken(caregiverOne._id, expires, tokenTypes.ACCESS);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with unauthorized error if caregiver is not found', async () => {
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${caregiverOneAccessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' })
    );
  });

  test('should call next with forbidden error if caregiver does not have required rights and caregiverId is not in params', async () => {
    await insertCaregivers([caregiverOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${caregiverOneAccessToken}` } });
    const next = jest.fn();

    await auth('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: httpStatus.FORBIDDEN, message: 'Forbidden' }));
  });

  test('should call next with no errors if caregiver does not have required rights but caregiverId is in params', async () => {
    await insertCaregivers([caregiverOne]);
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${caregiverOneAccessToken}` },
      params: { caregiverId: caregiverOne._id.toHexString() },
    });
    const next = jest.fn();

    await auth('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should call next with no errors if caregiver has required rights', async () => {
    await insertCaregivers([admin]);
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${adminAccessToken}` },
      params: { caregiverId: caregiverOne._id.toHexString() },
    });
    const next = jest.fn();

    await auth(...roleRights.get('admin'))(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
