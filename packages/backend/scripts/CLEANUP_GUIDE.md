# Cleanup Guide

This guide explains how to free up disk space on your development machine, particularly for Docker and Ubuntu.

## Problem Summary

Your deployment scripts were building Docker images locally but not cleaning them up after pushing to ECR, leading to:
- **18.76GB** of Docker build cache
- **21.71GB** of unused Docker images
- **12GB** in Ubuntu cache directories
- Multiple untagged images from previous deployments

## Quick Cleanup

Run the master cleanup script to clean everything:

```bash
cd bianca-app-backend/scripts
./cleanup-all.sh
```

For aggressive cleanup (removes more, including recently used images):

```bash
./cleanup-all.sh --aggressive
```

To see what would be cleaned without actually cleaning:

```bash
./cleanup-all.sh --dry-run
```

## Individual Cleanup Scripts

### Docker Cleanup

Clean up Docker images, containers, volumes, and build cache:

```bash
./cleanup-docker.sh
```

Options:
- `--aggressive`: Remove ALL unused images (including recently used)
- `--dry-run`: Show what would be cleaned
- `--keep-recent`: Keep images created in the last 24 hours

### Ubuntu Cleanup

Clean up apt cache, logs, and temporary files:

```bash
./cleanup-ubuntu.sh
```

Options:
- `--aggressive`: Also clean old logs
- `--dry-run`: Show what would be cleaned

## What's Fixed in Deployment Scripts

The deployment scripts (`deploy-staging.sh` and `deploy-production.sh`) now automatically:

1. **Remove local images after pushing to ECR** - Once an image is successfully pushed, the local copy is removed
2. **Clean build cache** - Removes Docker build cache after deployment
3. **Remove untagged images** - Cleans up old untagged ECR images

This means future deployments will automatically clean up, preventing disk space issues.

## Manual Cleanup Commands

If you prefer to run cleanup manually:

### Docker

```bash
# Remove all unused images
docker image prune -a -f

# Remove build cache (often the biggest space saver)
docker builder prune -a -f

# Remove untagged images
docker images | grep "730335291008.dkr.ecr.us-east-2.amazonaws.com" | grep "<none>" | awk '{print $3}' | xargs docker rmi -f

# Full system cleanup
docker system prune -a -f --volumes
```

### Ubuntu

```bash
# Clean apt cache
sudo apt clean
sudo apt autoclean
sudo apt autoremove -y

# Clean user cache (be careful!)
rm -rf ~/.cache/pip
rm -rf ~/.cache/yarn
rm -rf ~/.cache/npm

# Clean old logs (requires sudo)
sudo journalctl --vacuum-time=7d
sudo find /var/log -type f -name "*.log" -mtime +30 -delete
```

## Monitoring Disk Space

Check current usage:

```bash
# Overall disk usage
df -h

# Docker disk usage (reported by Docker)
docker system df

# User cache size
du -sh ~/.cache

# Apt cache size
sudo du -sh /var/cache/apt
```

### Understanding Docker Disk Usage Discrepancy

**Important:** `docker system df` only reports Docker-managed resources (images, containers, volumes, build cache). The actual disk usage can be much higher due to:

1. **Container logs** - Can grow to hundreds of GB if not rotated
2. **BuildKit cache** - Separate from regular build cache, not always reported
3. **Overlay2 filesystem layers** - Orphaned layers that aren't tracked
4. **Docker Desktop VM files** (if using Docker Desktop on WSL2)
5. **Image metadata and databases** - Internal Docker storage

**To diagnose the full disk usage:**

```bash
cd bianca-app-backend/scripts
./diagnose-docker-space.sh
```

This script will show you:
- What `docker system df` reports
- Actual size of Docker root directory
- Container logs size (often the culprit)
- Overlay2 filesystem size
- BuildKit cache size
- Volume storage size
- Docker Desktop data (if applicable)

The cleanup script now also handles:
- Truncating large container logs (>100MB)
- Cleaning BuildKit cache
- More thorough system pruning

## Expected Space Savings

After running cleanup, you should free up approximately:
- **~18-20GB** from Docker build cache
- **~15-20GB** from unused Docker images
- **~5-10GB** from Ubuntu cache (depending on usage)
- **Total: ~40-50GB** of disk space

## Best Practices

1. **Run cleanup regularly** - Especially after deployments
2. **Use the cleanup scripts** - They're safer than manual commands
3. **Monitor disk space** - Check `df -h` regularly
4. **Deployments auto-clean** - Future deployments will clean up automatically

## Troubleshooting

### "Permission denied" errors
Some cleanup operations require sudo. The scripts will prompt you when needed.

### "Cannot remove image" errors
If an image is in use, stop the container first:
```bash
docker ps -a  # Find the container
docker stop <container-id>
docker rm <container-id>
docker rmi <image-id>
```

### Still running out of space?
1. Check for large files: `du -sh ~/* | sort -h`
2. Check Docker volumes: `docker volume ls` and `docker volume inspect <volume>`
3. Check for large log files: `sudo find /var/log -type f -size +100M`

