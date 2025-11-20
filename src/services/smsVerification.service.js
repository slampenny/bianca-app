// src/services/smsVerification.service.js

const { twilioSmsService } = require('./twilioSms.service');
const logger = require('../config/logger');
const { Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

/**
 * SMS Verification Service
 * Handles phone number verification via Twilio SMS
 */
class SMSVerificationService {
  constructor() {
    this.twilioSmsService = twilioSmsService; // Use Twilio SMS service
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
    return this.twilioSmsService.maskPhoneNumber(phone);
  }

  /**
   * Send verification code via SMS using Twilio
   * @param {string} phoneNumber - Phone number (will be formatted)
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object>} Verification code details
   */
  async sendVerificationCode(phoneNumber, caregiverId) {
    try {
      // Validate Twilio SMS service
      if (!this.twilioSmsService || !this.twilioSmsService.isInitialized) {
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

      // Format phone number using Twilio SMS service
      const formattedPhone = this.twilioSmsService.formatPhoneNumber(phoneNumber || caregiver.phone);
      if (!formattedPhone) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is required');
      }
      
      if (!this.twilioSmsService.isValidPhoneNumber(formattedPhone)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format');
      }

      // Create SMS message
      const message = `Your Bianca verification code is: ${code}. This code expires in 10 minutes.`;

      // Send SMS via Twilio
      const response = await this.twilioSmsService.sendSMS(formattedPhone, message, {
        category: 'phone_verification',
        caregiverId: caregiverId
      });

      logger.info(`[SMS Verification] Code sent to ${formattedPhone}, MessageSid: ${response.messageSid}`);

      // Store verification code in database
      // Use select to include fields that are normally excluded
      const caregiverWithCode = await Caregiver.findById(caregiverId).select('+phoneVerificationCode +phoneVerificationCodeExpires +phoneVerificationAttempts');
      caregiverWithCode.phoneVerificationCode = code;
      caregiverWithCode.phoneVerificationCodeExpires = expiresAt;
      caregiverWithCode.phoneVerificationAttempts = (caregiverWithCode.phoneVerificationAttempts || 0) + 1;
      await caregiverWithCode.save();

      return {
        messageId: response.messageSid, // Twilio uses messageSid instead of MessageId
        expiresAt,
        phoneNumber: this.twilioSmsService.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error(`[SMS Verification] Error sending code: ${error.message}`);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle Twilio-specific errors
      if (error.code === 21211) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format');
      } else if (error.code === 20003 || error.status === 401) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'SMS service authentication failed');
      } else if (error.code === 20429 || error.status === 429) {
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

