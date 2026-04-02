# Debug: "Unexpected token '<'" — Frontend JS returning HTML

When the browser requests a `.js` file but the server returns HTML (e.g. `index.html` or an error page), the parser throws **Uncaught SyntaxError: Unexpected token '<'**.

This doc is for **finding the root cause on the staging instance** and then applying the fix in the repo.

---

## 1. SSH into the staging instance

**Option A — Current instance (after blue/green swap):**

```bash
# From repo root, with AWS CLI and Terraform output (or use your key name)
cd packages/backend/devops/terraform
terraform output staging_ssh_command
# Run the printed command, e.g.:
# ssh -i ~/.ssh/YOUR_KEY.pem ec2-user@<STAGING_IP>
```

**Option B — Get IP from AWS (instance serving staging):**

```bash
# Instance with Name=bianca-staging (current serving instance)
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress]' --output text

# If using blue/green, the *green* instance (before swap) has Name=bianca-staging-green.
# After swap, the surviving instance is the one with the EIP / in the ALB target group.
```

Then:

```bash
ssh -i ~/.ssh/YOUR_KEY.pem ec2-user@<IP>
```

---

## 2. Run the investigation script on the instance

From your **local machine**, copy the script to the instance and run it (or paste the script contents and run in bash):

```bash
# Copy script to instance (from repo root)
scp -i ~/.ssh/YOUR_KEY.pem packages/backend/devops/scripts/investigate-frontend-js.sh ec2-user@<STAGING_IP>:~/
ssh -i ~/.ssh/YOUR_KEY.pem ec2-user@<STAGING_IP> 'bash ~/investigate-frontend-js.sh'
```

Or **after SSH**, run the script: `bash ~/investigate-frontend-js.sh` (or run the commands in `packages/backend/devops/scripts/investigate-frontend-js.sh` manually).

---

## 3. What to look for

| Finding | Likely cause | Fix (apply in repo) |
|--------|---------------|----------------------|
| `index.html` has `src="/_expo/static/.../index-xxx.js"` but that path returns 404 or HTML | File not at that path in container, or host nginx not forwarding path | Ensure frontend nginx serves `/_expo/` and Dockerfile copies full `dist/`; or fix base path in build |
| `index.html` has `src="index-xxx.js"` (no leading slash) | Relative path resolved against wrong base (e.g. `/some/route` → `/some/route/index-xxx.js`) | Set correct `base` or `assetPrefix` in Expo web build so script srcs are absolute |
| JS path returns 200 but body starts with `<!` or `<html` | Server (host nginx or frontend) serving index.html for JS request | Fix nginx: `.js` location must `try_files $uri =404` and not fall through to `location /` |
| Files in container are under `/_expo/static/...` but index references `/assets/...` (or vice versa) | Build output path vs. what index.html expects | Align Expo output (or public/index.html) with nginx root; or adjust copy in Dockerfile |

---

## 4. Root cause (likely)

- **Expo web** puts `index.html` and `_expo/static/js/web/index-<hash>.js` in `dist/`. The Dockerfile copies `dist/` to nginx root, so the file should be at `/_expo/static/js/web/index-<hash>.js`.
- If the **JS file is missing** (wrong path, failed copy, or stale/cached `index.html` with an old hash), nginx returns **404** and serves its **default HTML 404 page**. The browser then tries to parse that HTML as JS and throws **Unexpected token '<'**.

So the usual fix is: **ensure the file referenced by `index.html` exists in the container** (correct copy, no stale HTML).

---

## 5. Fixes already in the pipeline

- **Frontend Dockerfile** (`packages/mobile/devops/Dockerfile`): After copying `dist/`, a `RUN` step checks that the script `src` from `index.html` exists on disk. If it’s missing, the **image build fails** (no broken image is pushed).
- **Post-deploy validation** (`buildspec-post-deploy-validation.yml` and `validate_service.sh`): After deploy, we fetch the frontend page, resolve the first `.js` script URL, and **fail the pipeline** if that URL returns non-200 or HTML (so we don’t swap traffic when the app would show "Unexpected token '<'").

---

## 6. After you fix it on the instance

- **If the script showed “FILE MISSING” or “HTTP 404” for the JS URL:** The referenced file wasn’t in the container. Ensure the **same** `index.html` and `_expo/static/js/web/*.js` are produced and copied (no stale cache; Dockerfile copies full `dist/`). The new Dockerfile check will fail the build if the file is missing.
- **If you had to fix nginx config on the instance:** Update `packages/mobile/devops/nginx.conf` to match (and any host nginx in CodeDeploy if relevant).
- **If you had to fix path/base (e.g. base href):** Update `packages/mobile` app/Expo web config so the build emits the correct script URLs.

Then re-run the pipeline so the fix is baked into the next deploy.
