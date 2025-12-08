# Compacting Docker Desktop VHDX File

## The Problem

Docker Desktop on WSL2 uses a VHDX (virtual hard disk) file that grows as you use Docker but **doesn't automatically shrink** when you delete images/containers. This is why:

- `docker system df` shows: ~21GB (actual data)
- File tree shows: 163GB (VHDX file size)

## Important: Two-Step Process

**Compacting is NOT the same as cleaning!** You need to do BOTH:

1. **First:** Clean up Docker data (remove unused images, containers, etc.)
   ```bash
   cd bianca-app-backend/scripts
   ./cleanup-docker.sh --aggressive
   ```
   This removes actual Docker data, reducing what's stored inside the VHDX.

2. **Then:** Compact the VHDX file (removes unused space from the file itself)
   - This step is what actually frees up the disk space on Windows
   - Without compacting, the VHDX file stays large even after cleaning

**Why not just delete the VHDX?** The VHDX file contains ALL your Docker data (images, containers, volumes). Deleting it would wipe out everything. Compacting just removes unused space without deleting data.

The VHDX file is located at:
```
C:\Users\<username>\AppData\Local\Docker\wsl\disk\docker_data.vhdx
```

## Solution: Compact the VHDX File

### Method 1: Using PowerShell (Recommended)

1. **Stop Docker Desktop completely**
   - Right-click Docker Desktop icon in system tray
   - Select "Quit Docker Desktop"
   - Wait for it to fully shut down

2. **Open PowerShell as Administrator** (right-click → Run as Administrator)

3. **Run the compact command:**
   ```powershell
   Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx" -Mode Full
   ```

   This will:
   - Analyze the VHDX file
   - Remove unused space
   - Compact it to the actual size needed

4. **Restart Docker Desktop**

### Method 2: Using diskpart (Alternative)

1. **Stop Docker Desktop completely**

2. **Open Command Prompt as Administrator**

3. **Run diskpart:**
   ```cmd
   diskpart
   ```

4. **In diskpart, run:**
   ```diskpart
   select vdisk file="C:\Users\<username>\AppData\Local\Docker\wsl\disk\docker_data.vhdx"
   compact vdisk
   exit
   ```

5. **Restart Docker Desktop**

### Method 3: Using WSL Command (From WSL2)

1. **Stop Docker Desktop**

2. **From WSL2, run:**
   ```bash
   wsl --shutdown
   ```

3. **From Windows PowerShell (as Admin):**
   ```powershell
   Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx" -Mode Full
   ```

4. **Restart Docker Desktop**

## Expected Results

After compacting, the VHDX file should shrink from ~163GB to approximately:
- **~20-30GB** (actual data + some overhead)

This will free up **~130-140GB** of disk space!

## Prevention

To prevent this from happening again:

1. **Run cleanup regularly:**
   ```bash
   cd bianca-app-backend/scripts
   ./cleanup-docker.sh --aggressive
   ```

2. **Compact the VHDX periodically** (every few months or when disk space is low)

3. **Configure Docker Desktop log rotation** to prevent log files from growing too large

## Troubleshooting

### "Cannot compact: file is in use"
- Make sure Docker Desktop is completely stopped
- Check Task Manager for any Docker processes still running
- Try: `wsl --shutdown` before compacting

### "Access denied"
- Make sure you're running PowerShell/CMD as Administrator
- Close any file explorers that might have the Docker directory open

### Compact doesn't reduce size much
- Run `docker system prune -a --volumes` first to remove more data
- Then compact the VHDX
- The compact operation only removes unused space, not actual data

