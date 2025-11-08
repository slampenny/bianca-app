# WordPress Email Setup Guide (Docker Container)

This guide explains how to configure WordPress running in a Docker container to send emails via AWS SES.

## Problem

WordPress containers don't have email capabilities by default. The WordPress container needs to be configured to send emails through AWS SES. Since WordPress runs in Docker, we need container-specific solutions.

## Important: Docker Container Considerations

- WordPress runs in container `bianca-wordpress`
- Only `/opt/wordpress-data/wp-content` is persisted (plugins/themes)
- `wp-config.php` is inside the container (not persisted)
- Container doesn't have direct AWS SDK access - must use SMTP
- **SES SMTP requires username/password** - IAM roles don't work for SMTP

## Prerequisites

1. ✅ **SES Domain Verified**: The domain `myphonefriend.com` should be verified in AWS SES
2. ✅ **IAM Permissions**: The WordPress EC2 instance has SES permissions (already configured)
3. ✅ **SES Out of Sandbox**: If SES is in sandbox mode, you can only send to verified email addresses
4. ⚠️ **SES SMTP Credentials**: You need to create SMTP credentials in AWS SES Console (IAM role won't work for SMTP)

## Quick Start: Automated Setup Script

The easiest way is to use the provided setup script:

```bash
# SSH into WordPress instance
ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<wordpress-instance-ip>

# Run the setup script
sudo /path/to/setup-wordpress-email.sh
```

Or manually copy the script to the instance and run it.

## Solution Options

### Option 1: Use Must-Use Plugin (MU-Plugin) - Recommended for Docker

This is the best solution for Docker containers. MU-plugins persist in the mounted volume and are always active.

#### Step 1: Run the Setup Script

```bash
# SSH into WordPress instance
ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<wordpress-instance-ip>

# Copy and run the setup script
sudo bash setup-wordpress-email.sh
```

This will:
- Create the mu-plugins directory
- Install the SMTP configuration plugin
- Install WP Mail SMTP plugin via WP-CLI

#### Step 2: Create SES SMTP Credentials

**Important**: SES SMTP requires username/password credentials. IAM roles don't work for SMTP.

1. Go to AWS SES Console: https://console.aws.amazon.com/ses/
2. Navigate to **SMTP Settings** (in the left sidebar)
3. Click **Create SMTP credentials**
4. Save the **SMTP Username** and **SMTP Password** securely

#### Step 3: Add Credentials to WordPress

**Option A: Add to docker-compose.yml (Recommended)**

```bash
# Edit docker-compose.yml
cd /opt/bianca-wordpress
sudo nano docker-compose.yml

# Add to the wordpress service environment section:
environment:
  WORDPRESS_DB_HOST: wordpress-db:3306
  WORDPRESS_DB_NAME: wordpress
  WORDPRESS_DB_USER: wordpress
  WORDPRESS_DB_PASSWORD: $DB_PASSWORD
  WORDPRESS_DEBUG: false
  SES_SMTP_USERNAME: "your-smtp-username-here"
  SES_SMTP_PASSWORD: "your-smtp-password-here"

# Restart WordPress container
sudo docker-compose restart wordpress
```

**Option B: Add to wp-config.php**

```bash
# Add credentials to wp-config.php
sudo docker exec bianca-wordpress bash -c "cat >> /var/www/html/wp-config.php << 'WPEOF'

// SES SMTP Configuration
define('SES_SMTP_USERNAME', 'your-smtp-username-here');
define('SES_SMTP_PASSWORD', 'your-smtp-password-here');
WPEOF"

# Restart container to ensure changes are loaded
sudo docker restart bianca-wordpress
```

#### Step 4: Test Email

```bash
# Test via WP-CLI
sudo docker exec bianca-wordpress wp mail test your-email@example.com --allow-root
```

Or test via WordPress admin:
1. Go to `https://myphonefriend.com/wp-admin`
2. Navigate to **WP Mail SMTP → Tools → Email Test**
3. Enter your email and send

### Option 2: Use Must-Use Plugin (MU-Plugin) - Persists Across Container Rebuilds

Create a must-use plugin that configures SMTP. MU-plugins are in `/wp-content/mu-plugins/` and are always active.

#### Step 1: Create MU-Plugin File

```bash
# SSH into WordPress instance
ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<wordpress-instance-ip>

# Create mu-plugins directory (persists in mounted volume)
sudo mkdir -p /opt/wordpress-data/wp-content/mu-plugins

# Create SMTP configuration plugin
sudo tee /opt/wordpress-data/wp-content/mu-plugins/ses-smtp-config.php > /dev/null <<'EOF'
<?php
/**
 * Plugin Name: AWS SES SMTP Configuration
 * Description: Configures WordPress to send emails via AWS SES SMTP
 * Version: 1.0
 */

add_action('phpmailer_init', 'configure_ses_smtp');

function configure_ses_smtp($phpmailer) {
    $phpmailer->isSMTP();
    $phpmailer->Host = 'email-smtp.us-east-2.amazonaws.com';
    $phpmailer->SMTPAuth = true;
    $phpmailer->Port = 587;
    $phpmailer->SMTPSecure = 'tls';
    
    // Get SMTP credentials from environment or use IAM role
    // Note: SES SMTP requires username/password, not IAM role
    // You'll need to create SMTP credentials in SES Console
    $phpmailer->Username = getenv('SES_SMTP_USERNAME') ?: '';
    $phpmailer->Password = getenv('SES_SMTP_PASSWORD') ?: '';
    
    $phpmailer->From = 'noreply@myphonefriend.com';
    $phpmailer->FromName = 'My Phone Friend';
    
    // Enable debugging if needed
    // $phpmailer->SMTPDebug = 2;
}
EOF

# Set proper permissions
sudo chown -R 33:33 /opt/wordpress-data/wp-content/mu-plugins
sudo chmod 644 /opt/wordpress-data/wp-content/mu-plugins/ses-smtp-config.php
```

#### Step 2: Create SES SMTP Credentials

Since SES SMTP requires username/password (not IAM role), create SMTP credentials:

1. Go to AWS SES Console → **SMTP Settings**
2. Click **Create SMTP credentials**
3. Save the username and password securely

#### Step 3: Store Credentials Securely

**Option A: Use AWS Secrets Manager (Recommended)**

```bash
# Store SMTP credentials in AWS Secrets Manager
aws secretsmanager create-secret \
  --name wordpress/ses-smtp-credentials \
  --secret-string '{"username":"YOUR_SMTP_USERNAME","password":"YOUR_SMTP_PASSWORD"}' \
  --region us-east-2
```

Then update the MU-plugin to fetch from Secrets Manager (requires AWS SDK in container).

**Option B: Add to Docker Compose Environment**

Update the userdata script to add environment variables (less secure):

```bash
# Edit docker-compose.yml in userdata script
# Add to wordpress service environment:
environment:
  SES_SMTP_USERNAME: "your-smtp-username"
  SES_SMTP_PASSWORD: "your-smtp-password"
```

**Option C: Use wp-config.php (Simpler but less secure)**

Add to `wp-config.php` via Docker exec:

```bash
sudo docker exec bianca-wordpress bash -c "cat >> /var/www/html/wp-config.php << 'WPEOF'

// SES SMTP Configuration
define('SMTP_USER', 'your-smtp-username');
define('SMTP_PASS', 'your-smtp-password');
WPEOF"
```

Then update the MU-plugin to use these constants.

### Option 3: Custom Docker Image with Pre-installed Plugin

Create a custom Dockerfile that extends the WordPress image with SMTP plugin pre-installed:

```dockerfile
FROM wordpress:latest

# Install WP-CLI
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar \
    && chmod +x wp-cli.phar \
    && mv wp-cli.phar /usr/local/bin/wp

# Install WP Mail SMTP plugin (will be activated on first run)
RUN wp plugin install wp-mail-smtp --allow-root || true
```

Then update the docker-compose.yml to use this custom image.

## Troubleshooting

### Emails Not Sending

1. **Check SES Sandbox Mode**:
   ```bash
   aws ses get-account-sending-enabled --region us-east-2
   ```
   If in sandbox mode, you can only send to verified email addresses. Request production access in AWS SES Console.

2. **Check IAM Permissions**:
   - Verify the WordPress instance has the IAM role `bianca-wordpress-instance-role`
   - Check CloudWatch Logs for permission errors

3. **Check WordPress Debug Logs**:
   - Enable WordPress debugging in `wp-config.php`:
     ```php
     define('WP_DEBUG', true);
     define('WP_DEBUG_LOG', true);
     ```
   - Check logs at `/opt/wordpress-data/wp-content/debug.log`

4. **Check SES Domain Verification**:
   ```bash
   aws ses get-identity-verification-attributes \
     --identities myphonefriend.com \
     --region us-east-2
   ```
   Should show `VerificationStatus: Success`

5. **Test SES Directly**:
   ```bash
   # SSH into WordPress instance
   aws ses send-email \
     --from noreply@myphonefriend.com \
     --to your-email@example.com \
     --subject "Test Email" \
     --text "This is a test" \
     --region us-east-2
   ```

### Common Issues

**Issue**: "Email address is not verified"
- **Solution**: Verify the "from" email address in SES Console, or use a verified domain

**Issue**: "Access Denied" or permission errors
- **Solution**: Check IAM role is attached to the instance and has SES permissions

**Issue**: Emails going to spam
- **Solution**: Ensure DKIM and SPF records are properly configured (already done via Terraform)

**Issue**: Plugin can't connect to SES
- **Solution**: Check security group allows outbound HTTPS (already configured)

## Verification Checklist

- [ ] SES domain `myphonefriend.com` is verified
- [ ] DKIM records are configured (3 CNAME records)
- [ ] SPF record is configured
- [ ] WordPress SMTP plugin is installed and configured
- [ ] Test email sent successfully
- [ ] SES is out of sandbox mode (if sending to unverified addresses)

## Additional Resources

- [AWS SES SMTP Endpoints](https://docs.aws.amazon.com/ses/latest/dg/smtp-endpoints.html)
- [WP Mail SMTP Documentation](https://wpmailsmtp.com/docs/)
- [AWS SES Getting Started](https://docs.aws.amazon.com/ses/latest/dg/send-email.html)

