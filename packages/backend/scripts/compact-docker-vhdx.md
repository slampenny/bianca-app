# Reclaiming Docker disk space on Windows (WSL2)

After `docker image prune` and friends, **Linux frees blocks inside the virtual disk**, but **Windows often still sees a huge `.vhdx` file** until you compact it. The file you compact depends on **how you run Docker**:

| Setup | What holds Docker data | What to compact |
|--------|-------------------------|-----------------|
| **Docker Desktop** | Dedicated WSL2 disk | `…\Docker\wsl\disk\docker_data.vhdx` |
| **Docker Engine inside WSL2** (e.g. Ubuntu + `docker.io` / Docker CE) — *typical on Windows Pro **without** Desktop* | Your distro’s root filesystem | That distro’s **`ext4.vhdx`** (not `docker_data.vhdx`) |
| **Docker on a remote Linux box** | That server’s disk | Use host tools (`fstrim`, LVM, etc.) — not this doc |

If you are **not** using Docker Desktop, **`docker_data.vhdx` usually does not exist**. Compacting **`ext4.vhdx`** for the WSL distro where you run `docker` is the right move.

---

## Step 1: Clean Docker, then wait for prunes to finish

1. Prune images/cache (e.g. `yarn docker:low-disk` from `packages/backend`).
2. If a big prune might still be running:
   ```bash
   cd packages/backend && yarn docker:wait-prune
   ```
3. Only after that, shut down Docker / WSL for compaction (below).

---

## Path A: Docker Desktop

Docker Desktop uses its own VHDX:

```
%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx
```

1. **Quit Docker Desktop** fully (system tray → Quit).
2. **PowerShell as Administrator:**
   ```powershell
   wsl --shutdown
   Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx" -Mode Full
   ```
3. Start Docker Desktop again.

*(Requires Hyper-V PowerShell — on Windows Pro, enable the Hyper-V feature or “Hyper-V Module for Windows PowerShell” if `Optimize-VHD` is missing.)*

---

## Path B: Docker in WSL2 only (no Docker Desktop) — **Windows Pro**

Here `/var/lib/docker` lives **inside** your Ubuntu (or other) distro disk.

### 1) Find your distro’s VHDX

In **PowerShell** (normal user is fine):

```powershell
wsl -l -v
```

Note the **NAME** of the distro where you run Docker (e.g. `Ubuntu`).

Common locations:

- **Store install** (e.g. Ubuntu from Microsoft Store):  
  `C:\Users\<you>\AppData\Local\Packages\<Publisher>.<DistroName>_...\LocalState\ext4.vhdx`  
  (folder name varies; search `ext4.vhdx` under `%LOCALAPPDATA%\Packages` if needed.)
- **Custom / imported** distro: often under  
  `%LOCALAPPDATA%\WSL\` or `%USERPROFILE%\AppData\Local\WSL\` — check `wsl --status` / docs for your install.

You can also open `\\wsl$\<DistroName>\` in Explorer to confirm the distro, then locate its `ext4.vhdx` on Windows as above.

### 2) Stop Docker and WSL

**Inside that WSL distro** (where Docker runs):

```bash
sudo service docker stop
# or: sudo systemctl stop docker   (if systemd is available)
```

Then **from Windows PowerShell or CMD**:

```powershell
wsl --shutdown
```

### 3) Compact the distro VHDX

**PowerShell as Administrator** (adjust the path you found):

```powershell
Optimize-VHD -Path "C:\Users\<you>\AppData\Local\Packages\...\LocalState\ext4.vhdx" -Mode Full
```

### 4) Start WSL again

Open your distro; start Docker:

```bash
sudo service docker start
```

---

## diskpart alternative (either VHDX)

```cmd
diskpart
select vdisk file="C:\full\path\to\file.vhdx"
compact vdisk
exit
```

Use the correct path: `docker_data.vhdx` **or** your distro `ext4.vhdx`.

---

## If `Optimize-VHD` is not found

- Turn on **Hyper-V** (optional Windows feature) or at least the **Hyper-V Module for Windows PowerShell** on Pro.
- Or use **diskpart** `compact vdisk` as above.

---

## Prevention

- Run `yarn docker:low-disk` (or `cleanup-docker.sh`) periodically.
- After pruning, compact the right VHDX when Windows still shows low free space.

## Troubleshooting

### “File is in use”
- Run `wsl --shutdown` before compacting.
- Ensure no `wsl.exe` / distro windows are using that disk.

### Compact barely helps
- Prune more inside Linux: `docker system df`, then `docker image prune -a -f`, `docker builder prune -af`.
- Confirm you compacted the **distro** `ext4.vhdx`, not only a missing `docker_data.vhdx`.

### Still stuck
- Check size of the correct `ext4.vhdx` in Explorer before/after.
- Consider moving WSL to another drive (`wsl --export` / `--import`) if C: is too small.
