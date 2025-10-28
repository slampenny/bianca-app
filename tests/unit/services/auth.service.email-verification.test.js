const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Caregiver, Token } = require('../../models');
const { tokenTypes } = require('../../config/tokens');
const authService = require('../../services/auth.service');
const caregiverService = require('../../services/caregiver.service');
const tokenService = require('../../services/token.service');
const ApiError = require('../../utils/ApiError');

describe('Auth Service - Email Verification', () => {
  describe('verifyEmail', () => {
    let mockCaregiver;
    let mockTokenDoc;

    beforeEach(() => {
      mockCaregiver = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        isEmailVerified: false,
      };

      mockTokenDoc = {
        caregiver: mockCaregiver._id,
        type: tokenTypes.VERIFY_EMAIL,
      };

      caregiverService.getCaregiverById = jest.fn();
      tokenService.verifyToken = jest.fn();
      Token.deleteMany = jest.fn();
      caregiverService.updateCaregiverById = jest.fn();
    });

    test('should verify email successfully', async () => {
      const verifyEmailToken = 'valid-token-123';
      
      tokenService.verifyToken.mockResolvedValue(mockTokenDoc);
      caregiverService.getCaregiverById.mockResolvedValue(mockCaregiver);
      Token.deleteMany.mockResolvedValue({ deletedCount: 1 });
      caregiverService.updateCaregiverById.mockResolvedValue(mockCaregiver);

      await authService.verifyEmail(verifyEmailToken);

      expect(tokenService.verifyToken).toHaveBeenCalledWith(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
      expect(caregiverService.getCaregiverById).toHaveBeenCalledWith(mockTokenDoc.caregiver);
      expect(Token.deleteMany).toHaveBeenCalledWith({ 
        caregiver: mockCaregiver._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });
      expect(caregiverService.updateCaregiverById).toHaveBeenCalledWith(mockCaregiver._id, { 
        isEmailVerified: true 
      });
    });

    test('should throw error for invalid token', async () => {
      const verifyEmailToken = 'invalid-token-123';
      
      tokenService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await expect(authService.verifyEmail(verifyEmailToken)).rejects.toThrow(ApiError);
      
      const error = await authService.verifyEmail(verifyEmailToken).catch(e => e);
      expect(error.statusCode).toBe(httpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Email verification failed');
    });

    test('should throw error for non-existent caregiver', async () => {
      const verifyEmailToken = 'valid-token-123';
      
      tokenService.verifyToken.mockResolvedValue(mockTokenDoc);
      caregiverService.getCaregiverById.mockResolvedValue(null);

      await expect(authService.verifyEmail(verifyEmailToken)).rejects.toThrow(ApiError);
      
      const error = await authService.verifyEmail(verifyEmailToken).catch(e => e);
      expect(error.statusCode).toBe(httpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Email verification failed');
    });

    test('should throw error when token verification fails', async () => {
      const verifyEmailToken = 'expired-token-123';
      
      tokenService.verifyToken.mockRejectedValue(new Error('Token expired'));

      await expect(authService.verifyEmail(verifyEmailToken)).rejects.toThrow(ApiError);
      
      const error = await authService.verifyEmail(verifyEmailToken).catch(e => e);
      expect(error.statusCode).toBe(httpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Email verification failed');
    });

    test('should handle database errors gracefully', async () => {
      const verifyEmailToken = 'valid-token-123';
      
      tokenService.verifyToken.mockResolvedValue(mockTokenDoc);
      caregiverService.getCaregiverById.mockResolvedValue(mockCaregiver);
      Token.deleteMany.mockRejectedValue(new Error('Database error'));
      caregiverService.updateCaregiverById.mockResolvedValue(mockCaregiver);

      await expect(authService.verifyEmail(verifyEmailToken)).rejects.toThrow(ApiError);
      
      const error = await authService.verifyEmail(verifyEmailToken).catch(e => e);
      expect(error.statusCode).toBe(httpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Email verification failed');
    });
  });

  describe('loginCaregiverWithEmailAndPassword', () => {
    let mockCaregiver;

    beforeEach(() => {
      mockCaregiver = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        isEmailVerified: true,
        isPasswordMatch: jest.fn(),
      };

      caregiverService.getLoginCaregiverData = jest.fn();
    });

    test('should login successfully with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'Password123';
      
      mockCaregiver.isPasswordMatch.mockResolvedValue(true);
      caregiverService.getLoginCaregiverData.mockResolvedValue({
        caregiver: mockCaregiver,
        patients: [],
      });

      const result = await authService.loginCaregiverWithEmailAndPassword(email, password);

      expect(caregiverService.getLoginCaregiverData).toHaveBeenCalledWith(email);
      expect(mockCaregiver.isPasswordMatch).toHaveBeenCalledWith(password);
      expect(result).toEqual({
        caregiver: mockCaregiver,
        patients: [],
      });
    });

    test('should throw error for invalid credentials', async () => {
      const email = 'test@example.com';
      const password = 'WrongPassword';
      
      mockCaregiver.isPasswordMatch.mockResolvedValue(false);
      caregiverService.getLoginCaregiverData.mockResolvedValue({
        caregiver: mockCaregiver,
        patients: [],
      });

      await expect(authService.loginCaregiverWithEmailAndPassword(email, password)).rejects.toThrow(ApiError);
      
      const error = await authService.loginCaregiverWithEmailAndPassword(email, password).catch(e => e);
      expect(error.statusCode).toBe(httpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Incorrect email or password');
    });

    test('should throw error for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'Password123';
      
      caregiverService.getLoginCaregiverData.mockResolvedValue(null);

      await expect(authService.loginCaregiverWithEmailAndPassword(email, password)).rejects.toThrow(ApiError);
      
      const error = await authService.loginCaregiverWithEmailAndPassword(email, password).catch(e => e);
      expect(error.statusCode).toBe(httpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Incorrect email or password');
    });

    test('should handle password verification errors', async () => {
      const email = 'test@example.com';
      const password = 'Password123';
      
      mockCaregiver.isPasswordMatch.mockRejectedValue(new Error('Password verification failed'));
      caregiverService.getLoginCaregiverData.mockResolvedValue({
        caregiver: mockCaregiver,
        patients: [],
      });

      await expect(authService.loginCaregiverWithEmailAndPassword(email, password)).rejects.toThrow(ApiError);
      
      const error = await authService.loginCaregiverWithEmailAndPassword(email, password).catch(e => e);
      expect(error.statusCode).toBe(httpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Incorrect email or password');
    });
  });
});
