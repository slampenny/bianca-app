const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');
const Caregiver = require('../models/caregiver.model');
const Org = require('../models/org.model');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const logger = require('../config/logger');
const { tokenService, orgService, emailService } = require('../services');
const { tokenTypes } = require('../config/tokens');
const { CaregiverDTO, OrgDTO } = require('../dtos');

const login = async (req, res) => {
  try {
    const { provider, email, name, id: providerId, picture } = req.body;
    logger.info('SSO login attempt', { provider, email, name, id: providerId });

    // Validate required fields
    if (!provider || !email || !name || !providerId) {
      logger.error('SSO login missing required fields', { provider, email, name, id: providerId });
      throw new ApiError(httpStatus.BAD_REQUEST, 'Missing required SSO fields: provider, email, name, and id are required');
    }

    // Check if caregiver exists with this email
    let caregiver = await Caregiver.findOne({ email });
    logger.debug('SSO login caregiver lookup', { email, found: !!caregiver });

    let orgForDTO = null;
    
    if (!caregiver) {
      logger.info('SSO login creating new org and caregiver', { email, name, provider });
      try {
        // Create new user through the proper registration workflow
        const org = await orgService.createOrg(
        {
          email: email,
          name: `${name}'s Organization`,
          // phone will be set later when user completes profile
        },
        {
          email: email,
          name: name,
          // phone will be set later when user completes profile
          password: null, // SSO users don't have passwords
          ssoProvider: provider,
          ssoProviderId: providerId,
          avatar: picture,
          isEmailVerified: true, // SSO users are pre-verified
          role: 'orgAdmin', // User creating the org should be orgAdmin from the start
        }
        );

        caregiver = org.caregivers[0];
        // Use the org we just created
        orgForDTO = org;
        logger.info('SSO login successfully created new org and caregiver', { 
          orgId: org._id, 
          caregiverId: caregiver._id 
        });
      } catch (createError) {
        logger.error('SSO login failed to create org and caregiver', {
          error: createError.message,
          stack: createError.stack,
          email,
          provider
        });
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          `Failed to create organization and caregiver: ${createError.message}`
        );
      }
      
      // Send verification email automatically after registration (even though SSO users are pre-verified)
      // Temporarily disabled to fix crash
      // try {
      //   const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
      //   await emailService.sendVerificationEmail(caregiver.email, verifyEmailToken);
      // } catch (emailError) {
      //   // Log the error but don't fail the registration
      //   console.error('Failed to send verification email during SSO registration:', emailError);
      // }
    } else {
      // Update existing caregiver with SSO info if not already set
      if (!caregiver.ssoProvider) {
        caregiver.ssoProvider = provider;
        caregiver.ssoProviderId = providerId;
        if (picture) {
          caregiver.avatar = picture;
        }
        await caregiver.save();
      }
      
      // Fetch org data if caregiver has an org
      if (caregiver.org) {
        const mongoose = require('mongoose');
        const orgId = caregiver.org instanceof mongoose.Types.ObjectId || 
                      (caregiver.org.constructor && caregiver.org.constructor.name === 'ObjectId')
                      ? caregiver.org 
                      : (caregiver.org._id || caregiver.org.toString());
        
        // Check if org is already populated
        if (caregiver.org.name !== undefined || caregiver.org.email !== undefined) {
          orgForDTO = caregiver.org;
        } else {
          // Fetch org from database
          orgForDTO = await Org.findById(orgId);
        }
      }
    }

    // Generate JWT tokens with correct structure
    let accessToken, refreshToken;
    try {
      accessToken = jwt.sign(
        {
          type: tokenTypes.ACCESS,
          sub: caregiver._id,
          iat: Math.floor(Date.now() / 1000)
        },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      refreshToken = jwt.sign(
        {
          type: tokenTypes.REFRESH,
          sub: caregiver._id,
          iat: Math.floor(Date.now() / 1000)
        },
        config.jwt.secret,
        { expiresIn: '7d' }
      );
    } catch (jwtError) {
      logger.error('SSO login failed to generate JWT tokens', {
        error: jwtError.message,
        stack: jwtError.stack,
        caregiverId: caregiver._id
      });
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to generate authentication tokens: ${jwtError.message}`
      );
    }

    // Calculate expiration dates
    const accessExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Generate DTOs
    let userDTO, orgDTO;
    try {
      userDTO = CaregiverDTO(caregiver);
      orgDTO = orgForDTO ? OrgDTO(orgForDTO) : null;
    } catch (dtoError) {
      logger.error('SSO login failed to generate DTOs', {
        error: dtoError.message,
        stack: dtoError.stack,
        caregiverId: caregiver._id,
        orgId: orgForDTO?._id
      });
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to generate response data: ${dtoError.message}`
      );
    }

    logger.info('SSO login successful', {
      provider,
      email,
      caregiverId: caregiver._id,
      orgId: orgForDTO?._id
    });

    res.json({
      success: true,
      message: 'SSO login successful',
      tokens: {
        access: {
          token: accessToken,
          expires: accessExpires,
        },
        refresh: {
          token: refreshToken,
          expires: refreshExpires,
        },
      },
      user: userDTO,
      org: orgDTO
    });

  } catch (error) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      logger.error('SSO login error (ApiError)', {
        statusCode: error.statusCode,
        message: error.message,
        provider: req.body?.provider,
        email: req.body?.email
      });
      throw error;
    }
    
    // Log the full error for debugging
    logger.error('SSO login error (unexpected)', {
      error: error.message,
      stack: error.stack,
      provider: req.body?.provider,
      email: req.body?.email,
      errorName: error.name,
      errorType: error.constructor?.name
    });
    
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `SSO login failed: ${error.message || 'Unknown error'}`
    );
  }
};

const verify = async (req, res) => {
  try {
    const { provider, token } = req.body;

    let userInfo;

    if (provider === 'google') {
      // Verify Google token
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid Google token');
      }

      userInfo = await response.json();
    } else if (provider === 'microsoft') {
      // Verify Microsoft token
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid Microsoft token');
      }

      const msUserInfo = await response.json();
      userInfo = {
        id: msUserInfo.id,
        email: msUserInfo.mail || msUserInfo.userPrincipalName,
        name: msUserInfo.displayName,
        picture: msUserInfo.photo ? `https://graph.microsoft.com/v1.0/me/photo/$value` : undefined,
      };
    }

    res.json({
      success: true,
      userInfo
    });

  } catch (error) {
    logger.error('SSO verify error', {
      error: error.message,
      stack: error.stack,
      provider: req.body?.provider
    });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `SSO verification failed: ${error.message || 'Unknown error'}`
    );
  }
};

module.exports = {
  login,
  verify,
};
