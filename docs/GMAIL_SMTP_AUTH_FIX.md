# Gmail SMTP Authentication Not Working - Troubleshooting

## Problem
- ✅ Email forwarding works (you receive emails TO `jlapp@biancatechnologies.com`)
- ❌ Gmail won't authenticate SMTP to send FROM that address

## Common Causes & Solutions

### Issue 1: Using Wrong Password Type
**Problem**: Using Gmail account password instead of App Password

**Solution**:
1. Make sure you have 2-Step Verification enabled
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character App Password (not your regular password)
4. Remove any spaces if you copied it with spaces

### Issue 2: SMTP Settings Wrong
**Problem**: Incorrect server/port/encryption settings

**Correct Settings**:
- **SMTP Server**: `smtp.gmail.com` (NOT smtp.google.com or mail.gmail.com)
- **Port**: `587` (NOT 465)
- **Encryption**: TLS/STARTTLS (NOT SSL)
- **Username**: Your full Gmail address (e.g., `negascout@gmail.com`)
- **Password**: App Password (16 characters, no spaces)

### Issue 3: "Less Secure App" Issue
**Problem**: Gmail blocking the connection

**Solution**: 
- App Passwords should bypass this
- If you see "Less secure app" error, make sure you're using App Password
- Check: Security → Less secure app access (should be OFF if using App Password)

### Issue 4: Rate Limiting
**Problem**: Too many failed attempts

**Solution**:
- Wait 24 hours
- Try again with correct credentials

### Issue 5: Gmail Blocking Domain
**Problem**: Gmail might block SMTP auth for forwarded domains

**Workaround**: Use Google Workspace instead (see below)

## Step-by-Step: Fresh Setup

### 1. Generate New App Password
```
1. Go to: https://myaccount.google.com/apppasswords
2. Select: Mail
3. Device: Other (Custom name) → "Gmail SMTP"
4. Generate → Copy the password
```

### 2. Remove Old "Send mail as" Entry
```
1. Gmail → Settings → Accounts and Import
2. Find jlapp@biancatechnologies.com in "Send mail as"
3. Click "delete" to remove it
4. Start fresh
```

### 3. Add "Send mail as" Again
```
1. Click "Add another email address"
2. Name: Your name
3. Email: jlapp@biancatechnologies.com
4. UNCHECK "Treat as an alias"
5. Next Step
```

### 4. Enter SMTP Settings Carefully
```
SMTP Server: smtp.gmail.com
Port: 587
Username: negascout@gmail.com  (your actual Gmail address)
Password: <paste App Password here> (the 16-character code)
☑ Secured connection using TLS
```

**Important**: 
- Make sure there are NO spaces in the App Password
- Make sure you're using the App Password, not your Gmail password
- Make sure port is 587, not 465

### 5. If It Still Fails

**Test SMTP Connection Directly**:
Create a test script to verify credentials work:

```bash
python3 <<'EOF'
import smtplib

try:
    smtp = smtplib.SMTP('smtp.gmail.com', 587)
    smtp.set_debuglevel(1)  # See what's happening
    smtp.starttls()
    smtp.login('negascout@gmail.com', 'YOUR-APP-PASSWORD-HERE')
    print("✓ Authentication successful!")
    smtp.quit()
except Exception as e:
    print(f"✗ Error: {e}")
EOF
```

## Alternative: Use Google Workspace Instead

If Gmail personal account won't authenticate with your domain:

**Option**: Sign up for Google Workspace
- $6/month per user
- Full email hosting (receiving + sending)
- No SMTP authentication issues
- More professional

**Setup**:
1. Sign up for Google Workspace trial
2. Verify domain via DNS
3. Set up `jlapp@biancatechnologies.com` as a user
4. Use Google Workspace SMTP:
   - Server: `smtp.gmail.com`
   - Port: `587`
   - Username: `jlapp@biancatechnologies.com`
   - Password: Your Google Workspace password

## Quick Diagnostic

Run this to test your SMTP credentials directly:

```bash
# Test if App Password works
python3 <<'EOF'
import smtplib

APP_PASSWORD = "YOUR-16-CHAR-APP-PASSWORD"  # Replace this
GMAIL_USER = "negascout@gmail.com"  # Your Gmail

try:
    print("Connecting to Gmail SMTP...")
    smtp = smtplib.SMTP('smtp.gmail.com', 587)
    smtp.set_debuglevel(1)
    smtp.starttls()
    print(f"Authenticating as {GMAIL_USER}...")
    smtp.login(GMAIL_USER, APP_PASSWORD)
    print("✓ SUCCESS! Credentials work!")
    smtp.quit()
except smtplib.SMTPAuthenticationError as e:
    print(f"✗ Authentication failed: {e}")
    print("Check: App Password correct? 2FA enabled?")
except Exception as e:
    print(f"✗ Error: {e}")
EOF
```

If this test works but Gmail settings don't, there's a UI/config issue.
If this test fails, the App Password is wrong or not working.

