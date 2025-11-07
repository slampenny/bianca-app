# Release Notes

## Infrastructure Updates - Email and Notification Configuration

### Changes Made

#### 1. SNS Backup Notification Email Update
- **Changed:** Default backup notification email from `devops@myphonefriend.com` to `jlapp@biancatechnologies.com`
- **Files Modified:**
  - `devops/terraform/hipaa-backups.tf` (variable default updated)
  - `devops/terraform-new/hipaa-backups.tf` (variable default updated)
  - `devops/terraform-backup/hipaa-backups.tf` (variable default updated)
- **Impact:** HIPAA backup success/failure notifications now sent to `jlapp@biancatechnologies.com` by default
- **Status:** ✅ SNS subscription confirmed and active

#### 2. Zoho Mail DNS Configuration
- **Added:** DNS records for `biancatechnologies.com` email forwarding via Zoho Mail
- **Files Modified:**
  - `devops/terraform/corp-email-forwarding.tf`
- **Records Added:**
  - MX records: `mx.zohocloud.ca`, `mx2.zohocloud.ca`, `mx3.zohocloud.ca`
  - SPF record: `v=spf1 include:zohocloud.ca include:zoho.com include:amazonses.com ~all`
  - DKIM record: Zoho Mail DKIM public key
- **Impact:** Email forwarding now working for `jlapp@biancatechnologies.com` and `vthaker@biancatechnologies.com`
- **Status:** ✅ DNS records created and verified

### Infrastructure Status

- **SNS Backup Notifications:** ✅ Active and confirmed
- **Zoho Mail Email Forwarding:** ✅ Configured and working
- **Terraform State:** ✅ Applied successfully with `environment=production`

### Notes

- SNS subscription confirmation email was found in Zoho Mail notifications section
- All DNS records propagated successfully
- Email forwarding tested and confirmed working (Gmail → Zoho Mail)

### Next Steps

- [ ] Monitor SNS backup notifications to ensure delivery
- [ ] Verify email forwarding for all `@biancatechnologies.com` addresses
- [ ] AWS Support case submitted for SMS Sandbox → Production migration (pending approval)

