import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { Caregiver } from '../models/caregiver.model';
import { Org } from '../models/org.model';

const router = Router();

// SSO login endpoint
router.post('/sso/login', [
  body('provider').isIn(['google', 'microsoft']).withMessage('Provider must be google or microsoft'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('id').notEmpty().withMessage('Provider ID is required'),
  body('picture').optional().isURL().withMessage('Picture must be a valid URL'),
], async (req: Request, res: Response) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

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
        phone: '000-000-0000', // Placeholder phone for SSO users
      });

      await caregiver.save();

      // Create default organization for the caregiver
      const organization = new Org({
        name: `${name}'s Organization`,
        email: email,
        phone: '000-000-0000', // Placeholder phone
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

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { 
        userId: caregiver._id, 
        email: caregiver.email,
        role: caregiver.role 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: caregiver._id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'SSO login successful',
      tokens: {
        accessToken,
        refreshToken
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
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify SSO token endpoint (for backend verification)
router.post('/sso/verify', [
  body('provider').isIn(['google', 'microsoft']).withMessage('Provider must be google or microsoft'),
  body('token').notEmpty().withMessage('Token is required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

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
        return res.status(401).json({
          success: false,
          message: 'Invalid Google token'
        });
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
        return res.status(401).json({
          success: false,
          message: 'Invalid Microsoft token'
        });
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
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
