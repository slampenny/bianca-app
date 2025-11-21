# Release Notes

## 🎨 Major Frontend Features

### Complete Dark Mode & Theme System
- **Full Dark Mode Implementation**: Complete dark mode support across all screens and components
  - Modern 2025 color palette with warm undertones and sophisticated colors
  - Light theme: Modern indigo primary, emerald success, rose errors, warm grays
  - Dark theme: Rich dark grays (not pure black), balanced bright colors
  - Colorblind theme: Modern colors while maintaining full accessibility
  
- **UI/UX Improvements**:
  - Fixed invisible text bubbles in conversation messages
  - Fixed invisible text in all input fields (PhoneInputWeb, TextField)
  - Fixed invisible back buttons and navigation icons
  - Fixed invisible button text across all screens
  - Fixed invisible text in modals, cards, and all UI components
  - Replaced TextInput with TextField (Ignite) for theme consistency
  - Replaced Pressable with Button components for standardized styling
  
- **Consistent Button System**:
  - Primary (blue): Main actions (Save, Invite, Submit, Call)
  - Default (outlined): Secondary actions (View, Navigate, Cancel)
  - Success (green): Assign/confirm actions
  - Danger (red): Destructive actions (Delete, Logout)
  - Fully theme-aware navigation system

### Email Verification Workflow
- **Complete Frontend Implementation**:
  - New `EmailVerificationRequiredScreen` component for unverified users
  - Updated registration flow to handle verification requirement
  - Resend verification email functionality with comprehensive error handling
  - Updated login error handling for unverified emails
  - New `EmailVerifiedScreen` for successful verification
  - Proper navigation flow for SSO and direct registration
  - Deep linking support for email verification links

- **Localization Support**:
  - Email verification screens fully localized in 12+ languages
  - Backend email verification pages support multiple locales
  - Localized error messages and success messages
  - RTL (Right-to-Left) support for Arabic and Hebrew

- **LoadingButton Component Enhancements**:
  - Fixed async handler support with proper Promise handling
  - Added error handling for async operations
  - Improved type safety with `Promise<void>` support
  - Enhanced error logging for debugging

## Infrastructure & Deployment Fixes

### Terraform Configuration Updates
- **Fixed Route53 Record Conflict**: Removed `wordpress_apex` resource from `main.tf` and `production/main-production.tf` to resolve conflicts with WordPress-managed DNS records
  - WordPress now exclusively manages the `biancawellness.com` root domain via `wordpress_root` in `wordpress.tf`
  - Prevents Terraform deployment errors when WordPress infrastructure already exists
  
- **Spot Instance Configuration**:
  - **Production**: Uses on-demand instances (removed lifecycle ignore_changes for user_data since on-demand instances can be stopped/restarted)
  - **WordPress**: Uses on-demand instances (no spot configuration)
  - **Staging**: Uses spot instances (kept lifecycle ignore_changes since one-time spot instances cannot be stopped)
  
- **Production Deployment**: Resolved issues preventing successful production deployments
  - Fixed EC2 instance stop errors for spot instances
  - Removed unnecessary WordPress references from production Terraform

### Email Service Fixes
- **Staging Environment**: Updated email service to use AWS SES for staging deployments
  - Previously staging was falling back to Ethereal (development email service)
  - Now staging correctly uses AWS SES like production

- **Corporate Email Infrastructure**:
  - Corporate email forwarding via Lambda functions
  - Email authentication and SMTP credential management
  - Comprehensive email testing and debugging tools
  - Documentation for email setup and troubleshooting

### WordPress Infrastructure
- **WordPress ALB Configuration**: Added Application Load Balancer for WordPress
  - Improved scalability and reliability
  - Health checks and target group configuration
  - SSL/TLS termination via ACM certificates
  - Route53 integration for DNS management

## Backend Improvements

### Email Verification Backend
- **Localized Email Verification Pages**: Backend generates localized HTML pages for email verification
  - Supports multiple languages (English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Hindi)
  - Dynamic locale detection from request headers
  - Styled, themed verification pages with proper error handling
  - Support for expired tokens, already verified accounts, and invalid tokens

### Service Enhancements
- **Conversation Service**: Improved conversation handling and context management
- **Emergency Processor**: Enhanced emergency detection and processing
- **Email Service**: Better error handling and logging

## Technical Details

### Files Changed

**Backend:**
- `devops/terraform/main.tf` - Removed wordpress_apex resource
- `devops/terraform/production/main-production.tf` - Removed WordPress references
- `devops/terraform/production.tf` - Updated lifecycle configuration
- `devops/terraform/staging.tf` - Updated lifecycle configuration for spot instances
- `src/services/email.service.js` - Fixed staging to use SES
- `src/controllers/auth.controller.js` - Localized email verification pages
- `src/services/conversation.service.js` - Improved conversation handling
- `src/services/emergencyProcessor.service.js` - Enhanced emergency processing
- `src/locales/*.json` - Localization files for email verification

**Frontend:**
- `app/components/LoadingButton.tsx` - Fixed async handler support
- `app/screens/EmailVerificationRequiredScreen.tsx` - New screen with localization
- `app/screens/VerifyEmailScreen.tsx` - Updated navigation flow
- `app/screens/EmailVerifiedScreen.tsx` - New success screen
- `app/theme/` - Complete theme system implementation
- `app/i18n/*.ts` - Localization files for all supported languages
- All screens updated for theme awareness and dynamic colors

## Deployment Notes

### Before Deploying
1. Ensure WordPress infrastructure is already deployed (if applicable)
2. Verify AWS SES is configured for staging environment
3. Test email sending from staging environment

### Breaking Changes
- None

### Migration Required
- None

## Testing Recommendations

1. **Theme System**:
   - Test all three themes (Light, Dark, Colorblind)
   - Verify all screens display correctly in each theme
   - Test theme switching and persistence
   - Verify accessibility in colorblind theme

2. **Email Verification**:
   - Test complete registration → verification → login flow
   - Test resend verification email functionality
   - Test email verification links in different languages
   - Verify deep linking works correctly
   - Test expired token handling
   - Test already-verified account handling

3. **Localization**:
   - Test email verification in all supported languages
   - Verify RTL support for Arabic/Hebrew
   - Test error messages appear in correct language

4. **Terraform Deployment**:
   - Test production deployment to ensure Route53 conflicts are resolved
   - Verify spot instance lifecycle behavior on staging
   - Confirm on-demand instances can be stopped/restarted in production

5. **Frontend Components**:
   - Test LoadingButton with async operations
   - Verify error messages display correctly
   - Test navigation flow after email verification
   - Verify all buttons use correct theme colors

## Contributors
- Infrastructure fixes and Terraform configuration updates
- Frontend email verification improvements

