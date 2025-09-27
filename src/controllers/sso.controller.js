const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');
const Caregiver = require('../models/caregiver.model');
const Org = require('../models/org.model');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const { tokenService } = require('../services');
const { tokenTypes } = require('../config/tokens');

const login = async (req, res) => {
  try {
    const { provider, email, name, id: providerId, picture } = req.body;
    

    // Check if caregiver exists with this email
    let caregiver = await Caregiver.findOne({ email });

    if (!caregiver) {
      // Create new caregiver for SSO
      caregiver = new Caregiver({
        email,
        name,
        ssoProvider: provider,
        ssoProviderId: providerId,
        avatar: picture,
        isEmailVerified: true, // SSO users are pre-verified
        role: 'orgAdmin', // SSO users become org admins by default
        // phone is optional for SSO users
      });

      await caregiver.save();

      // Create default organization for the caregiver
      const organization = new Org({
        name: `${name}'s Organization`,
        email: email,
        // phone is optional
        caregivers: [caregiver._id]
      });

      await organization.save();

      // Update caregiver with organization
      caregiver.org = organization._id;
      await caregiver.save();
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
    }

    // Generate JWT tokens with correct structure
    const accessToken = jwt.sign(
      {
        type: tokenTypes.ACCESS,
        sub: caregiver._id,
        iat: Math.floor(Date.now() / 1000)
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      {
        type: tokenTypes.REFRESH,
        sub: caregiver._id,
        iat: Math.floor(Date.now() / 1000)
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    // Calculate expiration dates
    const accessExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

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
      user: {
        id: caregiver._id,
        email: caregiver.email,
        name: caregiver.name,
        role: caregiver.role,
        avatar: caregiver.avatar,
        organization: caregiver.org
      }
    });

  } catch (error) {
    console.error('SSO login error:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Internal server error');
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
    console.error('SSO verify error:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
};

module.exports = {
  login,
  verify,
};
