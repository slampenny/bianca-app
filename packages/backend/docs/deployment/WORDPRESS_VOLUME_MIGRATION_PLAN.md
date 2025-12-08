# WordPress Root Volume Migration Plan
## Migrate from 50GB to 8GB Root Volume

### Current State
- **Instance**: `i-0ba6819e1666cd736` (bianca-wordpress)
- **Root Volume**: `vol-09ed561b3d0e2cb7c` (50GB, /dev/xvda/nvme0n1)
- **Data Volume**: `vol-0faa284e2fd34a9d1` (20GB, /dev/xvdf/nvme1n1) - mounted at `/opt/wordpress-data` ✅
- **DB Volume**: `vol-0b76b9776c452e7a0` (10GB, /dev/xvdg/nvme2n1) - mounted at `/opt/wordpress-db` ✅
- **Current Usage**: 4.1GB used on root volume (well under 8GB limit)
- **Availability Zone**: Check with `aws ec2 describe-instances --instance-ids i-0ba6819e1666cd736 --query 'Reservations[0].Instances[0].Placement.AvailabilityZone'`

### Prerequisites
1. Verify current disk usage is under 8GB (already confirmed: 4.1GB used)
2. Note the instance's availability zone (required for new volume)
3. Have AWS CLI access with appropriate permissions

### Migration Steps

#### Step 1: Create Backup Snapshot (5-10 minutes)
```bash
# Create snapshot of current root volume as backup
aws ec2 create-snapshot \
  --volume-id vol-09ed561b3d0e2cb7c \
  --description "WordPress root volume backup before 50GB->8GB migration" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=wordpress-root-backup-pre-migration}]' \
  --profile jordan

# Wait for snapshot to complete (check status)
aws ec2 describe-snapshots --filters "Name=volume-id,Values=vol-09ed561b3d0e2cb7c" --query 'Snapshots[0].[SnapshotId,State,Progress]' --profile jordan
```

#### Step 2: Create New 8GB Volume (1 minute)
```bash
# Get availability zone
AZ=$(aws ec2 describe-instances --instance-ids i-0ba6819e1666cd736 --profile jordan --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' --output text)

# Create new 8GB gp3 volume in same AZ
aws ec2 create-volume \
  --availability-zone $AZ \
  --size 8 \
  --volume-type gp3 \
  --encrypted \
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=wordpress-root-8gb}]' \
  --profile jordan

# Note the new volume ID (e.g., vol-XXXXXXXX)
```

#### Step 3: Stop WordPress Services (2-3 minutes downtime starts)
```bash
# Option A: Stop Docker containers (minimal downtime)
aws ssm send-command \
  --instance-ids i-0ba6819e1666cd736 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /opt/bianca-wordpress && docker-compose down"]' \
  --profile jordan

# Option B: Stop instance entirely (more downtime but safer)
# aws ec2 stop-instances --instance-ids i-0ba6819e1666cd736 --profile jordan
# aws ec2 wait instance-stopped --instance-ids i-0ba6819e1666cd736 --profile jordan
```

#### Step 4: Copy Data from 50GB to 8GB Volume (10-15 minutes)
```bash
# Attach new 8GB volume as /dev/xvdb (temporary)
NEW_VOL_ID="vol-XXXXXXXX"  # From Step 2
aws ec2 attach-volume \
  --volume-id $NEW_VOL_ID \
  --instance-id i-0ba6819e1666cd736 \
  --device /dev/xvdb \
  --profile jordan

# Wait for attachment
aws ec2 wait volume-in-use --volume-ids $NEW_VOL_ID --profile jordan
sleep 5  # Give OS time to recognize device

# Format and copy data
aws ssm send-command \
  --instance-ids i-0ba6819e1666cd736 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "sudo mkfs.ext4 -F /dev/nvme3n1",
    "sudo mkdir -p /mnt/newroot",
    "sudo mount /dev/nvme3n1 /mnt/newroot",
    "sudo rsync -aAXv --exclude={"/dev/*","/proc/*","/sys/*","/tmp/*","/run/*","/mnt/*","/media/*","/lost+found","/opt/wordpress-data","/opt/wordpress-db"} / /mnt/newroot/",
    "sudo umount /mnt/newroot"
  ]' \
  --profile jordan

# Monitor progress
aws ssm list-command-invocations --command-id <COMMAND_ID> --details --profile jordan
```

#### Step 5: Swap Volumes (2-3 minutes)
```bash
# Detach old 50GB volume
aws ec2 detach-volume \
  --volume-id vol-09ed561b3d0e2cb7c \
  --profile jordan

# Detach new 8GB volume from temporary device
aws ec2 detach-volume \
  --volume-id $NEW_VOL_ID \
  --profile jordan

# Attach new 8GB volume as /dev/xvda (root)
aws ec2 attach-volume \
  --volume-id $NEW_VOL_ID \
  --instance-id i-0ba6819e1666cd736 \
  --device /dev/xvda \
  --profile jordan

# Wait for attachment
aws ec2 wait volume-in-use --volume-ids $NEW_VOL_ID --profile jordan
```

#### Step 6: Start Instance and Verify (5 minutes)
```bash
# If instance was stopped, start it
aws ec2 start-instances --instance-ids i-0ba6819e1666cd736 --profile jordan
aws ec2 wait instance-running --instance-ids i-0ba6819e1666cd736 --profile jordan

# Wait for instance to be ready
sleep 30

# Verify filesystem and services
aws ssm send-command \
  --instance-ids i-0ba6819e1666cd736 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "df -h",
    "docker ps",
    "curl -I http://localhost || echo \"WordPress not responding\""
  ]' \
  --profile jordan

# Check WordPress site is accessible
curl -I https://biancatechnologies.com
```

#### Step 7: Cleanup (after verification)
```bash
# Wait 24-48 hours to ensure everything works, then:
# Delete old 50GB volume
aws ec2 delete-volume --volume-id vol-09ed561b3d0e2cb7c --profile jordan

# Optional: Keep snapshot for 30 days, then delete
# aws ec2 delete-snapshot --snapshot-id <SNAPSHOT_ID> --profile jordan
```

### Estimated Timeline
- **Total Downtime**: 15-25 minutes (if stopping containers only)
- **Total Downtime**: 20-30 minutes (if stopping instance)
- **Total Process**: 30-45 minutes including verification

### Risk Mitigation
1. **Snapshot backup** created before any changes
2. **Verify disk usage** is under 8GB (confirmed: 4.1GB used)
3. **Test in staging first** if possible (but WordPress is production-only)
4. **Keep snapshot for 30 days** before deletion
5. **Monitor WordPress site** after migration

### Rollback Plan
If something goes wrong:
1. Detach new 8GB volume
2. Re-attach old 50GB volume as /dev/xvda
3. Restart instance
4. Site should be back to original state

### Cost Savings
- **Current**: 50GB * $0.08/GB-month = $4.00/month
- **After**: 8GB * $0.08/GB-month = $0.64/month
- **Savings**: $3.36/month ($40.32/year)

### Notes
- WordPress data and database are on separate volumes (not affected)
- Only root volume (OS, Docker) is being migrated
- rsync will preserve all permissions and ownership
- Exclude patterns prevent copying mounted volumes and system directories

