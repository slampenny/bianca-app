#!/bin/bash

# Script to pull database and files from myphonefriend production (AWS) to local
# This ensures we're working with the actual live site data

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Get from Terraform outputs or AWS CLI
AWS_REGION="us-east-2"
AWS_PROFILE="jordan"
SSH_KEY_NAME="bianca-key-pair"
SSH_KEY_PATH="$HOME/.ssh/${SSH_KEY_NAME}.pem"

# Remote configuration (from terraform-wordpress)
REMOTE_WP_DATA_DIR="/opt/wordpress-data"
REMOTE_WP_CONTENT_DIR="$REMOTE_WP_DATA_DIR/wp-content"
REMOTE_WP_DIR="/opt/bianca-wordpress"
DB_CONTAINER="bianca-wordpress-db"
DB_NAME="wordpress"
DB_USER="wordpress"

# Local configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_SITE_DIR="$MARKETING_ROOT"
LOCAL_WP_DIR="$LOCAL_SITE_DIR/wordpress"
LOCAL_WP_CONTENT_DIR="$LOCAL_WP_DIR/wp-content"
LOCAL_DB_DIR="$LOCAL_SITE_DIR/db"
LOCAL_DB_CONTAINER="${LOCAL_DB_CONTAINER:-bianca-marketing-db-1}"
DB_NAME_LOCAL="${DB_NAME_LOCAL:-biancawellness}"
TEMP_DIR="/tmp/biancawellness-pull-$$"

echo -e "${BLUE}📥 Pulling biancawellness from production (AWS)...${NC}"
echo ""

# Get instance IP from Terraform or AWS CLI
get_instance_ip() {
    echo -e "${YELLOW}🔍 Finding WordPress EC2 instance...${NC}"
    
    INSTANCE_IP=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --filters "Name=tag:Name,Values=bianca-wordpress" "Name=instance-state-name,Values=running" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "$INSTANCE_IP" || "$INSTANCE_IP" == "None" ]]; then
        echo -e "${RED}❌ Could not find WordPress EC2 instance${NC}"
        echo "Please ensure:"
        echo "  1. The instance is running"
        echo "  2. AWS CLI is configured with profile '$AWS_PROFILE'"
        echo "  3. You have permissions to describe EC2 instances"
        echo ""
        echo "You can also manually set INSTANCE_IP environment variable:"
        echo "  export INSTANCE_IP=your.instance.ip.address"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Found WordPress instance: $INSTANCE_IP${NC}"
}

# Check if SSH key exists
check_ssh_key() {
    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        echo -e "${RED}❌ SSH key not found at: $SSH_KEY_PATH${NC}"
        echo "Please ensure the SSH key exists or update SSH_KEY_PATH in the script"
        exit 1
    fi
    
    chmod 600 "$SSH_KEY_PATH" 2>/dev/null || true
    echo -e "${GREEN}✅ SSH key found${NC}"
}

# Check dependencies
check_dependencies() {
    echo -e "${YELLOW}📋 Checking dependencies...${NC}"
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed${NC}"
        exit 1
    fi
    
    if ! command -v rsync &> /dev/null; then
        echo -e "${RED}❌ rsync is not installed. Installing...${NC}"
        sudo apt-get update && sudo apt-get install -y rsync
    fi
    
    echo -e "${GREEN}✅ Dependencies check complete${NC}"
}

# Test SSH connection
test_ssh_connection() {
    echo -e "${YELLOW}📡 Testing SSH connection...${NC}"
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
        "ec2-user@$INSTANCE_IP" "echo 'SSH connection successful'" 2>&1
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ SSH connection successful${NC}"
    else
        echo -e "${RED}❌ SSH connection failed${NC}"
        exit 1
    fi
}

# Create temporary directory and local db directory
setup_temp_dir() {
    echo -e "${YELLOW}📁 Setting up directories...${NC}"
    mkdir -p "$TEMP_DIR"
    mkdir -p "$LOCAL_DB_DIR"
    mkdir -p "$LOCAL_WP_DIR"
    echo -e "${GREEN}✅ Temporary directory created: $TEMP_DIR${NC}"
    echo -e "${GREEN}✅ Local db directory created: $LOCAL_DB_DIR${NC}"
}

# Export database from production
export_database() {
    echo -e "${YELLOW}💾 Exporting database from production...${NC}"
    
    # Get database password from remote
    echo -e "${YELLOW}🔍 Getting database password from remote server...${NC}"
    DB_PASSWORD=$(ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ec2-user@$INSTANCE_IP" \
        "docker exec $DB_CONTAINER printenv MYSQL_PASSWORD" 2>/dev/null || echo "")
    
    if [[ -z "$DB_PASSWORD" ]]; then
        echo -e "${YELLOW}⚠️  Could not get database password, trying default...${NC}"
        DB_PASSWORD="wordpress"
    fi
    
    # Method 1: Try using .my.cnf file for authentication (avoids password on command line)
    echo -e "${YELLOW}🔍 Attempting database export (Method 1: .my.cnf file)...${NC}"
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ec2-user@$INSTANCE_IP" << 'METHOD1'
CONTAINER="bianca-wordpress-db"
DB_USER="wordpress"
DB_NAME="wordpress"
PASSWORD=$(docker exec $CONTAINER printenv MYSQL_PASSWORD)

# Create .my.cnf file inside container
docker exec $CONTAINER bash -c "echo -e '[client]\nuser=$DB_USER\npassword=$PASSWORD' > /tmp/.my.cnf && chmod 600 /tmp/.my.cnf" 2>/dev/null

# Use .my.cnf for authentication
docker exec $CONTAINER mysqldump --defaults-file=/tmp/.my.cnf --no-tablespaces --single-transaction --quick $DB_NAME > /tmp/myphonefriend-production-database.sql 2>&1

if [ $? -eq 0 ] && [ -s /tmp/myphonefriend-production-database.sql ]; then
    echo "SUCCESS"
    du -h /tmp/myphonefriend-production-database.sql | cut -f1
    # Verify it's valid SQL
    if head -1 /tmp/myphonefriend-production-database.sql | grep -qE '^(--|/\*)'; then
        echo "VALID_SQL"
    else
        echo "INVALID_SQL"
    fi
else
    echo "FAILED"
    tail -10 /tmp/myphonefriend-production-database.sql 2>&1
    exit 1
fi
METHOD1
    
    EXPORT_STATUS=$?
    
    if [[ $EXPORT_STATUS -ne 0 ]]; then
        echo -e "${YELLOW}⚠️  Method 1 failed, trying Method 2 (MYSQL_PWD environment variable)...${NC}"
        
        # Method 2: Use MYSQL_PWD environment variable
        ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ec2-user@$INSTANCE_IP" << 'METHOD2'
CONTAINER="bianca-wordpress-db"
DB_USER="wordpress"
DB_NAME="wordpress"
MYSQL_PWD=$(docker exec $CONTAINER printenv MYSQL_PASSWORD)

# Use MYSQL_PWD environment variable (safer than -p flag)
MYSQL_PWD="$MYSQL_PWD" docker exec $CONTAINER mysqldump -u $DB_USER --no-tablespaces --single-transaction --quick $DB_NAME > /tmp/myphonefriend-production-database.sql 2>&1

if [ $? -eq 0 ] && [ -s /tmp/myphonefriend-production-database.sql ]; then
    echo "SUCCESS"
    du -h /tmp/myphonefriend-production-database.sql | cut -f1
    if head -1 /tmp/myphonefriend-production-database.sql | grep -qE '^(--|/\*)'; then
        echo "VALID_SQL"
    else
        echo "INVALID_SQL"
    fi
else
    echo "FAILED"
    tail -10 /tmp/myphonefriend-production-database.sql 2>&1
    exit 1
fi
METHOD2
        
        EXPORT_STATUS=$?
    fi
    
    if [[ $EXPORT_STATUS -ne 0 ]]; then
        echo -e "${YELLOW}⚠️  Method 2 failed, trying Method 3 (direct stream)...${NC}"
        
        # Method 3: Stream directly to local file
        ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ec2-user@$INSTANCE_IP" \
            "CONTAINER='bianca-wordpress-db'; DB_USER='wordpress'; DB_NAME='wordpress'; MYSQL_PWD=\$(docker exec \$CONTAINER printenv MYSQL_PASSWORD); MYSQL_PWD=\"\$MYSQL_PWD\" docker exec \$CONTAINER mysqldump -u \$DB_USER --no-tablespaces --single-transaction --quick \$DB_NAME 2>/dev/null" > "$TEMP_DIR/database.sql" 2>&1
        
        if [[ -f "$TEMP_DIR/database.sql" && -s "$TEMP_DIR/database.sql" ]]; then
            if head -1 "$TEMP_DIR/database.sql" | grep -qE '^(--|/\*)'; then
                echo -e "${GREEN}✅ Database export successful using Method 3${NC}"
                EXPORT_STATUS=0
            else
                echo -e "${RED}❌ Exported file is not valid SQL${NC}"
                head -5 "$TEMP_DIR/database.sql"
                EXPORT_STATUS=1
            fi
        else
            EXPORT_STATUS=1
        fi
    fi
    
    # If methods 1 or 2 succeeded, download the file
    if [[ $EXPORT_STATUS -eq 0 ]] && [[ ! -f "$TEMP_DIR/database.sql" ]] || [[ ! -s "$TEMP_DIR/database.sql" ]]; then
        echo -e "${YELLOW}📥 Downloading database file from remote server...${NC}"
        scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
            "ec2-user@$INSTANCE_IP:/tmp/myphonefriend-production-database.sql" \
            "$TEMP_DIR/database.sql" 2>&1 || {
            echo -e "${RED}❌ Failed to download database file${NC}"
            exit 1
        }
    fi
    
    if [[ ! -f "$TEMP_DIR/database.sql" ]] || [[ ! -s "$TEMP_DIR/database.sql" ]]; then
        echo -e "${RED}❌ All export methods failed${NC}"
        echo -e "${YELLOW}💡 Manual export instructions:${NC}"
        echo "  1. SSH: ssh -i $SSH_KEY_PATH ec2-user@$INSTANCE_IP"
        echo "  2. Export: docker exec bianca-wordpress-db mysqldump -u wordpress -p[password] wordpress > /tmp/db.sql"
        echo "  3. Download: scp -i $SSH_KEY_PATH ec2-user@$INSTANCE_IP:/tmp/db.sql ./db/database.sql"
        exit 1
    fi
    
    # Copy to local db directory
    cp "$TEMP_DIR/database.sql" "$LOCAL_DB_DIR/database.sql"
    
    if [[ -f "$TEMP_DIR/database.sql" && -f "$LOCAL_DB_DIR/database.sql" ]]; then
        echo -e "${GREEN}✅ Database exported and downloaded: $TEMP_DIR/database.sql${NC}"
        echo -e "${GREEN}✅ Database also saved to: $LOCAL_DB_DIR/database.sql${NC}"
        # Show file size
        FILE_SIZE=$(du -h "$TEMP_DIR/database.sql" | cut -f1)
        echo -e "${BLUE}ℹ️  Database file size: $FILE_SIZE${NC}"
    else
        echo -e "${RED}❌ Failed to export database${NC}"
        exit 1
    fi
    
    # Clean up remote file
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "ec2-user@$INSTANCE_IP" \
        "rm /tmp/myphonefriend-production-database.sql" 2>/dev/null || true
}

# Download WordPress files (wp-content)
download_files() {
    echo -e "${YELLOW}📥 Downloading WordPress files (wp-content)...${NC}"
    
    # Create local wp-content directory if it doesn't exist
    mkdir -p "$LOCAL_WP_CONTENT_DIR"
    
    # Download wp-content using rsync over SSH
    # Use --partial to continue partial transfers and ignore some errors
    rsync -avz --partial \
        -e "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no" \
        --exclude='cache/' \
        --exclude='*.log' \
        --exclude='upgrade/' \
        --exclude='backup-db/' \
        --exclude='endurance-page-cache/' \
        "ec2-user@$INSTANCE_IP:$REMOTE_WP_CONTENT_DIR/" \
        "$LOCAL_WP_CONTENT_DIR/" 2>&1 || {
        echo -e "${YELLOW}⚠️  Some files may not have transferred due to permissions, but continuing...${NC}"
    }
    
    echo -e "${GREEN}✅ WordPress files download completed${NC}"
}

# Backup local database
backup_local_database() {
    echo -e "${YELLOW}💾 Backing up local database...${NC}"
    
    cd "$LOCAL_SITE_DIR"
    BACKUP_FILE="/tmp/myphonefriend-local-db-backup-$(date +%Y%m%d-%H%M%S).sql"
    
    # Table prefix will be detected from production SQL file during import
    # This is just for backup, will be updated during import_to_local
    DB_NAME_LOCAL=$(grep "define('DB_NAME'" "$LOCAL_WP_DIR/wp-config.php" | sed "s/.*'\([^']*\)'.*/\1/" || echo "wordpress")
    
    docker exec "$LOCAL_DB_CONTAINER" mariadb-dump -u wordpress -pwordpress "$DB_NAME_LOCAL" > "$BACKUP_FILE" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Could not backup local database (might not exist yet)${NC}"
        return
    }
    
    if [[ -f "$BACKUP_FILE" && -s "$BACKUP_FILE" ]]; then
        echo -e "${GREEN}✅ Local database backed up to: $BACKUP_FILE${NC}"
    fi
}

# Import production database to local
import_to_local() {
    echo -e "${YELLOW}💾 Importing production database to local...${NC}"
    
    if [[ ! -f "$TEMP_DIR/database.sql" || ! -s "$TEMP_DIR/database.sql" ]]; then
        echo -e "${RED}❌ No database file to import${NC}"
        exit 1
    fi
    
    # Detect production table prefix from the SQL file (e.g. wp_ or eMd_)
    echo -e "${YELLOW}🔍 Detecting production table prefix from SQL file...${NC}"
    PROD_PREFIX=$(grep -m 1 'CREATE TABLE' "$TEMP_DIR/database.sql" 2>/dev/null | sed -n "s/.*CREATE TABLE \`\([a-zA-Z0-9]*\)_.*/\1_/p" | head -1 || echo "")
    
    if [[ -z "$PROD_PREFIX" ]]; then
        # Try to detect from INSERT statements
        PROD_PREFIX=$(grep -m 1 'INSERT INTO' "$TEMP_DIR/database.sql" 2>/dev/null | sed -n "s/.*INSERT INTO \`\([a-zA-Z0-9]*\)_.*/\1_/p" | head -1 || echo "")
    fi
    
    if [[ -z "$PROD_PREFIX" ]]; then
        echo -e "${YELLOW}⚠️  Could not detect production table prefix from SQL, defaulting to wp_${NC}"
        PROD_PREFIX="wp_"
    else
        echo -e "${GREEN}✅ Detected production table prefix: $PROD_PREFIX${NC}"
    fi
    
    # Update local wp-config.php to match production prefix
    CURRENT_PREFIX=$(grep "table_prefix" "$LOCAL_WP_DIR/wp-config.php" | sed "s/.*= '\([^']*\)'.*/\1/" || echo "")
    if [[ "$CURRENT_PREFIX" != "$PROD_PREFIX" ]]; then
        echo -e "${YELLOW}🔧 Updating local wp-config.php to use production prefix: $PROD_PREFIX${NC}"
        sed -i "s/\$table_prefix = '.*';/\$table_prefix = '$PROD_PREFIX';/" "$LOCAL_WP_DIR/wp-config.php"
        echo -e "${GREEN}✅ Local wp-config.php updated to match production${NC}"
    else
        echo -e "${GREEN}✅ Local wp-config.php already matches production prefix${NC}"
    fi
    
    # Ensure local marketing database is running
    (cd "$MARKETING_ROOT" && docker compose up -d db)
    
    # Wait for database to be ready
    echo "Waiting for database to be ready..."
    sleep 5
    
    # Get local database name from wordpress/wp-config.php (the actual config file)
    DB_NAME_LOCAL=$(grep "define('DB_NAME'" "$LOCAL_WP_DIR/wp-config.php" | sed "s/.*'\([^']*\)'.*/\1/" || echo "wordpress")
    
    # Drop and recreate database to ensure clean import
    echo -e "${YELLOW}🗑️  Dropping existing local database...${NC}"
    docker exec "$LOCAL_DB_CONTAINER" mariadb -u wordpress -pwordpress -e "DROP DATABASE IF EXISTS $DB_NAME_LOCAL;" 2>/dev/null || true
    
    echo -e "${YELLOW}📦 Creating fresh local database...${NC}"
    docker exec "$LOCAL_DB_CONTAINER" mariadb -u wordpress -pwordpress -e "CREATE DATABASE IF NOT EXISTS $DB_NAME_LOCAL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || {
        echo -e "${RED}❌ Failed to create local database${NC}"
        exit 1
    }
    
    # Import the database
    echo -e "${YELLOW}📥 Importing database...${NC}"
    docker exec -i "$LOCAL_DB_CONTAINER" mariadb -u wordpress -pwordpress "$DB_NAME_LOCAL" < "$TEMP_DIR/database.sql" 2>&1 || {
        echo -e "${RED}❌ Failed to import database${NC}"
        exit 1
    }
    
    # Update URLs in database to local
    echo -e "${YELLOW}🔗 Updating URLs in database to local...${NC}"
    # Use the production prefix we detected
    TABLE_PREFIX="$PROD_PREFIX"
    
    docker exec "$LOCAL_DB_CONTAINER" mariadb -u wordpress -pwordpress "$DB_NAME_LOCAL" << EOF
UPDATE ${TABLE_PREFIX}options SET option_value = 'http://localhost:80' WHERE option_name = 'home';
UPDATE ${TABLE_PREFIX}options SET option_value = 'http://localhost:80' WHERE option_name = 'siteurl';
EOF
    
    echo -e "${GREEN}✅ Database imported and URLs updated to local development environment${NC}"
}

# Update local wp-config.php URLs
update_local_config() {
    echo -e "${YELLOW}⚙️  Updating local wp-config.php URLs...${NC}"
    
    # Update wp-config.php to use localhost (check both possible locations)
    for CONFIG in "$LOCAL_SITE_DIR/wp-config.php" "$LOCAL_WP_DIR/wp-config.php"; do
        if [[ -f "$CONFIG" ]]; then
            sed -i "s|define('WP_HOME','.*');|define('WP_HOME','http://localhost:80');|" "$CONFIG"
            sed -i "s|define('WP_SITEURL','.*');|define('WP_SITEURL','http://localhost:80');|" "$CONFIG"
            echo -e "${GREEN}✅ Local wp-config.php updated: $CONFIG${NC}"
        fi
    done
}

# Clean up temporary files
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
    rm -rf "$TEMP_DIR"
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🎯 Pull Summary:${NC}"
    echo "  Source: AWS EC2 instance (biancawellness.com)"
    echo "  Destination: $LOCAL_SITE_DIR (biancawellness)"
    echo ""
    
    # Allow INSTANCE_IP to be set as environment variable
    if [[ -z "$INSTANCE_IP" ]]; then
        get_instance_ip
    else
        echo -e "${GREEN}✅ Using provided instance IP: $INSTANCE_IP${NC}"
    fi
    
    check_dependencies
    check_ssh_key
    test_ssh_connection
    setup_temp_dir
    backup_local_database
    export_database
    download_files
    import_to_local
    update_local_config
    cleanup
    
    echo ""
    echo -e "${GREEN}🎉 Pull completed successfully!${NC}"
    echo -e "${BLUE}🌐 Your local site should be available at: http://localhost:80${NC}"
    echo ""
    echo -e "${BLUE}📁 Files saved to:${NC}"
    echo "  - WordPress files: $LOCAL_WP_CONTENT_DIR/"
    echo "  - Database export: $LOCAL_DB_DIR/database.sql"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "  1. Restart the site: cd $LOCAL_SITE_DIR && cd .. && cd .. && ./start-site.sh biancawellness"
    echo "  2. Test your website at http://localhost:80"
    echo "  3. Check that all pages and functionality work"
    echo "  4. Make any necessary local development changes"
}

# Run main function
main "$@"

