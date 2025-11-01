# Setting Up Gmail SMTP for BiancaTechnologies.com

## Overview
Use Gmail's SMTP servers to send emails FROM `yourname@biancatechnologies.com` while using your regular Gmail account.

## How It Works
- You authenticate with Gmail using your Gmail credentials
- Gmail sends the email on your behalf
- The recipient sees: FROM `yourname@biancatechnologies.com`
- They also see: "via gmail.com" (this is Gmail's SMTP relay indication)

## Step-by-Step Setup

### Step 1: Get Gmail App Password
Gmail requires an "App Password" for SMTP (not your regular password if you have 2FA enabled).

1. **Go to your Google Account**:
   - https://myaccount.google.com/
   - Or Gmail → Your profile picture → Manage your Google Account

2. **Enable 2-Step Verification** (if not already enabled):
   - Security → 2-Step Verification
   - Follow the prompts to enable it
   - This is required to generate App Passwords

3. **Generate App Password**:
   - Security → App passwords (or go directly to: https://myaccount.google.com/apppasswords)
   - Select app: "Mail"
   - Select device: "Other (Custom name)" → type "SMTP"
   - Click "Generate"
   - **Copy the 16-character password** (looks like: `abcd efgh ijkl mnop`)
   - You'll use this as your SMTP password

### Step 2: Configure Gmail to Send As BiancaTechnologies.com

1. **Open Gmail Settings**:
   - Gmail → Settings (gear icon) → See all settings

2. **Go to Accounts and Import tab**

3. **Find "Send mail as" section**:
   - Click "Add another email address"

4. **Add Email Address**:
   - Name: Your display name (e.g., "Jordan Lapp")
   - Email address: `jlapp@biancatechnologies.com`
   - **IMPORTANT**: Uncheck "Treat as an alias"
   - Click "Next Step"

5. **Configure SMTP Settings**:
   - SMTP Server: `smtp.gmail.com`
   - Port: `587`
   - Username: Your full Gmail address (e.g., `yourname@gmail.com`)
   - Password: The App Password you generated in Step 1 (the 16-character one, no spaces)
   - Select: "Secured connection using TLS"
   - Click "Add Account"

6. **Verify Email**:
   - Gmail will send a verification email to `jlapp@biancatechnologies.com`
   - Since you have email forwarding set up (SES → Lambda → Gmail), the verification email should arrive in your Gmail inbox
   - Click the verification link in the email
   - Done!

### Step 3: Set Default Behavior (Optional but Recommended)

1. **Back in Gmail Settings → Accounts and Import**:
   - Find "When replying to a message"
   - Select: "Reply from the same address the message was sent to"
   - This ensures replies use the correct address

## How to Use

### From Gmail Web Interface:
1. Compose a new email
2. Click the "From" dropdown (next to your email address)
3. Select `jlapp@biancatechnologies.com`
4. Send normally

### From Gmail Mobile App:
- The "From" address usually auto-selects based on replies
- You can change it in compose: tap your name → select the email address

### From Other Email Clients:
Use these SMTP settings:
- **SMTP Server**: `smtp.gmail.com`
- **Port**: `587`
- **Encryption**: TLS/STARTTLS
- **Username**: Your Gmail address
- **Password**: Gmail App Password (16-characters, no spaces)
- **From Address**: `jlapp@biancatechnologies.com`

## Important Notes

### What Recipients See:
```
From: Jordan Lapp <jlapp@biancatechnologies.com>
via gmail.com
```

The "via gmail.com" is Gmail's way of indicating it's relaying the email. This is normal and acceptable for most use cases, but:
- Some email clients may hide this
- It's less "professional" than a direct SMTP setup
- Spam filters generally accept it (Gmail has good reputation)

### Limitations:
- **500 emails/day limit** (Gmail free account)
- Shows "via gmail.com"
- Requires Gmail account to be active
- App Password needed if 2FA is enabled

### Advantages:
- ✅ Works immediately
- ✅ Free
- ✅ Reliable (Gmail's infrastructure)
- ✅ No complex setup
- ✅ Works with existing email forwarding

## Troubleshooting

### "Invalid Credentials" Error:
- Make sure you're using the **App Password**, not your regular Gmail password
- Remove spaces from the App Password if you copied them with spaces
- Verify 2-Step Verification is enabled

### "Less Secure App" Error:
- This shouldn't happen with App Passwords
- If you see this, make sure you're using an App Password, not your regular password

### Verification Email Not Arriving:
- Check your Gmail inbox (forwarded emails should arrive there)
- Check spam folder
- Wait a few minutes (email forwarding may have slight delay)

### "Authentication Failed":
- Double-check SMTP settings:
  - Server: `smtp.gmail.com` (not `smtp.google.com`)
  - Port: `587` (not 465)
  - TLS encryption (not SSL)

## Alternative: Use Existing SMTP Credentials

If you want to store these in Secrets Manager for your app:

```bash
aws secretsmanager update-secret \
  --secret-id ses/smtp/jlapp \
  --secret-string '{
    "server": "smtp.gmail.com",
    "port": 587,
    "username": "yourname@gmail.com",
    "password": "your-app-password-16-chars"
  }' \
  --profile jordan \
  --region us-east-2
```

Then your app can use these credentials instead of AWS SES SMTP.

## Next Steps

1. **Test it**: Send yourself a test email using the biancatechnologies.com address
2. **Check delivery**: Verify it arrives and shows correct FROM address
3. **For production**: Consider Google Workspace for a more professional setup (see EMAIL_ALTERNATIVES.md)

