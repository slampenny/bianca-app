// src/services/smsVerification.service.js

const { snsService } = require('./sns.service');
const logger = require('../config/logger');
const { Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

/**
 * SMS Verification Service
 * Handles phone number verification via AWS SNS
 */
class SMSVerificationService {
  constructor() {
    this.snsService = snsService; // Use existing SNS service
  }

  /**
   * Generate a 6-digit verification code
   * @returns {string} 6-digit code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Mask phone number for display (privacy)
   * @param {string} phone - Phone number in E.164 format
   * @returns {string} Masked phone number
   */
  maskPhoneNumber(phone) {
    if (!phone) return '';
    
    // Format: +1234567890 -> +1 (234) ***-7890
    const match = phone.match(/^(\+\d{1,2})(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `${match[1]} (${match[2]}) ***-${match[4]}`;
    }
    
    // Fallback: format as (XXX) XXX-XXXX
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ***-${digits.slice(6)}`;
    }
    
    return phone;
  }

  /**
   * Send verification code via SMS using AWS SNS
   * @param {string} phoneNumber - Phone number (will be formatted)
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object>} Verification code details
   */
  async sendVerificationCode(phoneNumber, caregiverId) {
    try {
      // Validate SNS service
      if (!this.snsService || !this.snsService.isInitialized) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'SMS service not configured');
      }

      // Generate verification code
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Find caregiver (select hidden fields for rate limiting check)
      const caregiver = await Caregiver.findById(caregiverId)
        .select('+phoneVerificationAttempts +phoneVerificationCodeExpires');
      if (!caregiver) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
      }

      // Check if phone is already verified
      if (caregiver.isPhoneVerified) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is already verified');
      }

      // Check rate limiting (max 3 attempts per hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (caregiver.phoneVerificationAttempts >= 3 && 
          caregiver.phoneVerificationCodeExpires && 
          caregiver.phoneVerificationCodeExpires > oneHourAgo) {
        throw new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          'Too many verification attempts. Please try again later.'
        );
      }

      // Format phone number (reuse existing SNS service method)
      const formattedPhone = this.snsService.formatPhoneNumber(phoneNumber || caregiver.phone);
      if (!formattedPhone) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is required');
      }
      
      if (!this.snsService.isValidPhoneNumber(formattedPhone)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format');
      }

      // Create SMS message
      const message = `Your Bianca verification code is: ${code}. This code expires in 10 minutes.`;

      // Send SMS via SNS (reuse existing sendToPhone method)
      // Note: sendToPhone expects alertData, but we can pass minimal data
      const response = await this.snsService.sendToPhone(formattedPhone, message, {
        severity: 'INFO',
        category: 'phone_verification',
        patientId: caregiverId
      });

      logger.info(`[SMS Verification] Code sent to ${formattedPhone}, MessageId: ${response.MessageId}`);

      // Store verification code in database
      // Use select to include fields that are normally excluded
      const caregiverWithCode = await Caregiver.findById(caregiverId).select('+phoneVerificationCode +phoneVerificationCodeExpires +phoneVerificationAttempts');
      caregiverWithCode.phoneVerificationCode = code;
      caregiverWithCode.phoneVerificationCodeExpires = expiresAt;
      caregiverWithCode.phoneVerificationAttempts = (caregiverWithCode.phoneVerificationAttempts || 0) + 1;
      await caregiverWithCode.save();

      return {
        messageId: response.MessageId,
        expiresAt,
        phoneNumber: this.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error(`[SMS Verification] Error sending code: ${error.message}`);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle AWS SNS-specific errors
      if (error.name === 'InvalidParameter' || error.name === 'InvalidParameterException') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format');
      } else if (error.name === 'AuthorizationError' || error.name === 'AuthorizationErrorException') {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'SMS service authentication failed');
      } else if (error.name === 'Throttling' || error.name === 'ThrottlingException') {
        throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'SMS service rate limit exceeded. Please try again later.');
      }

      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send verification code');
    }
  }

  /**
   * Verify the code entered by user
   * @param {string} caregiverId - Caregiver ID
   * @param {string} code - Verification code
   * @returns {Promise<boolean>} True if verified
   */
  async verifyCode(caregiverId, code) {
    try {
      // Find caregiver with verification fields
      const caregiver = await Caregiver.findById(caregiverId)
        .select('+phoneVerificationCode +phoneVerificationCodeExpires +phoneVerificationAttempts +isPhoneVerified');

      if (!caregiver) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
      }

      // Check if already verified
      if (caregiver.isPhoneVerified) {
        return true; // Already verified, return success
      }

      // Check if code exists
      if (!caregiver.phoneVerificationCode) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'No verification code found. Please request a new code.');
      }

      // Check if code expired
      if (new Date() > caregiver.phoneVerificationCodeExpires) {
        // Clear expired code
        caregiver.phoneVerificationCode = undefined;
        caregiver.phoneVerificationCodeExpires = undefined;
        await caregiver.save();
        throw new ApiError(httpStatus.BAD_REQUEST, 'Verification code expired. Please request a new code.');
      }

      // Verify code
      if (caregiver.phoneVerificationCode !== code) {
        caregiver.phoneVerificationAttempts = (caregiver.phoneVerificationAttempts || 0) + 1;
        await caregiver.save();
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid verification code');
      }

      // Code is valid - mark phone as verified
      caregiver.isPhoneVerified = true;
      caregiver.phoneVerifiedAt = new Date();
      caregiver.phoneVerificationCode = undefined;
      caregiver.phoneVerificationCodeExpires = undefined;
      caregiver.phoneVerificationAttempts = 0;
      await caregiver.save();

      logger.info(`[SMS Verification] Phone verified for caregiver ${caregiverId}`);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`[SMS Verification] Error verifying code: ${error.message}`);
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to verify code');
    }
  }

  /**
   * Resend verification code
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object>} Verification code details
   */
  async resendVerificationCode(caregiverId) {
    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
    }

    if (!caregiver.phone) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number not set');
    }

    if (caregiver.isPhoneVerified) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is already verified');
    }

    return this.sendVerificationCode(caregiver.phone, caregiverId);
  }

  /**
   * Check if phone verification is required for a user role
   * @param {string} role - User role
   * @returns {boolean} True if verification required
   */
  isVerificationRequired(role) {
    // All caregivers and admins need phone verification (they receive emergency alerts)
    // Patients don't create accounts, so this applies to all account creators
    return role !== 'unverified' && role !== 'invited';
  }
}

module.exports = new SMSVerificationService();

