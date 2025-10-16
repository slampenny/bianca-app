#!/bin/bash
# MongoDB Encryption at Rest Setup Script
# HIPAA Compliance: Generate encryption key and configure MongoDB

set -e  # Exit on error

echo "🔐 MongoDB Encryption at Rest Setup"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Please run as root (sudo)"
    exit 1
fi

# Configuration
KEYFILE_PATH="/etc/mongodb-keyfile"
MONGODB_USER="mongodb"
MONGODB_GROUP="mongodb"

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "❌ MongoDB is not installed"
    exit 1
fi

echo "✅ MongoDB found: $(mongod --version | head -n 1)"
echo ""

# Check MongoDB edition
MONGODB_EDITION=$(mongod --version | grep -i "edition" || echo "Community")

if [[ $MONGODB_EDITION == *"Community"* ]]; then
    echo "⚠️  WARNING: MongoDB Community Edition detected"
    echo "   Encryption at rest requires MongoDB Enterprise or Atlas"
    echo ""
    echo "   Options:"
    echo "   1. Upgrade to MongoDB Enterprise (recommended for on-premise)"
    echo "   2. Migrate to MongoDB Atlas with HIPAA configuration"
    echo "   3. Use alternative encryption (dm-crypt, LUKS for disk encryption)"
    echo ""
    read -p "   Continue anyway to generate key file? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📝 Step 1: Generating encryption key..."
echo ""

# Generate 256-bit encryption key (32 bytes = 256 bits)
openssl rand -base64 32 > "$KEYFILE_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Encryption key generated: $KEYFILE_PATH"
else
    echo "❌ Failed to generate encryption key"
    exit 1
fi

echo ""
echo "🔒 Step 2: Setting key file permissions..."
echo ""

# Set restrictive permissions (owner read-only)
chmod 400 "$KEYFILE_PATH"

# Change ownership to MongoDB user
if id "$MONGODB_USER" &>/dev/null; then
    chown $MONGODB_USER:$MONGODB_GROUP "$KEYFILE_PATH"
    echo "✅ Ownership set to $MONGODB_USER:$MONGODB_GROUP"
else
    echo "⚠️  MongoDB user not found. Please set ownership manually:"
    echo "   chown mongodb:mongodb $KEYFILE_PATH"
fi

echo ""
echo "📋 Step 3: Displaying key file info..."
ls -lh "$KEYFILE_PATH"

echo ""
echo "⚙️  Step 4: MongoDB Configuration"
echo ""
echo "To enable encryption at rest, update your mongod.conf:"
echo ""
echo "security:"
echo "  enableEncryption: true"
echo "  encryptionKeyFile: $KEYFILE_PATH"
echo "  encryptionCipherMode: AES256-CBC"
echo ""
echo "For production, use mongod.production.conf"
echo ""

echo "🔄 Step 5: Restart MongoDB"
echo ""
echo "After updating configuration:"
echo "  systemctl restart mongod"
echo ""

echo "✅ Encryption key setup complete!"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "   1. BACKUP this key file securely - you cannot decrypt data without it"
echo "   2. Store backup in a secure location (AWS Secrets Manager, HashiCorp Vault)"
echo "   3. Rotate encryption keys periodically (every 90 days recommended)"
echo "   4. Document key rotation procedures"
echo ""
echo "📊 For MongoDB Atlas (recommended for HIPAA):"
echo "   1. Log into Atlas console"
echo "   2. Go to Security > Advanced Data Protection"
echo "   3. Enable 'Encryption at Rest using Customer Key Management'"
echo "   4. Configure AWS KMS, Azure Key Vault, or Google Cloud KMS"
echo ""

# Create backup reminder script
BACKUP_SCRIPT="/usr/local/bin/backup-mongodb-keyfile.sh"
cat > "$BACKUP_SCRIPT" << 'EOF'
#!/bin/bash
# Backup MongoDB encryption key to secure location
# Run this after key generation or rotation

KEYFILE="/etc/mongodb-keyfile"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_LOCATION="${MONGODB_KEYFILE_BACKUP_PATH:-/secure/backups}"
BACKUP_FILE="$BACKUP_LOCATION/mongodb-keyfile-$BACKUP_DATE.enc"

# Encrypt the keyfile with GPG before backing up
gpg --symmetric --cipher-algo AES256 --output "$BACKUP_FILE" "$KEYFILE"

# Upload to S3 (if AWS CLI configured)
if command -v aws &> /dev/null; then
    aws s3 cp "$BACKUP_FILE" s3://bianca-hipaa-secrets/mongodb-keyfile/ \
        --sse aws:kms \
        --sse-kms-key-id "${AWS_KMS_KEY_ID}"
fi

echo "✅ Key file backed up to: $BACKUP_FILE"
EOF

chmod +x "$BACKUP_SCRIPT"
echo "📦 Backup script created: $BACKUP_SCRIPT"
echo ""

echo "🎯 Next Steps:"
echo "   1. Backup the encryption key: $BACKUP_SCRIPT"
echo "   2. Update mongod.conf with encryption settings"
echo "   3. Restart MongoDB"
echo "   4. Verify encryption is active: db.serverStatus().security"
echo "   5. Document key location in your security documentation"
echo ""
echo "Done! 🎉"

