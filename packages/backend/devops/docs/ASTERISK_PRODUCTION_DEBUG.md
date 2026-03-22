# Asterisk not connecting in production

When Asterisk works in staging but not in production, use this checklist.

## 1. Pipeline and orphans

- **Orphan cleanup**: Production uses the **same** `buildspec-swap-and-terminate.yml` as staging, including **Step 1.5** (deregister any target that isn’t the current green). So on each production swap, only the green instance stays in the ALB target groups.
- **Two `bianca-production` instances = split MongoDB**: Each EC2 has its **own** Docker Mongo on `/opt/mongodb-data`. If the **ALB** sends HTTPS to instance **A** but the **SIP EIP** is on instance **B**, the API and voice paths see **different databases** (e.g. clients created in the UI don’t exist for calls). **Fix:** associate **`bianca-production-eip`** with the **same** instance ID that is registered in **`bianca-production-api-tg`**, run `EXTERNAL_ADDRESS` sync + restart Asterisk/app on that host, then **terminate** the stray instance.

## 2. Single production instance

- **Intended instance**: Exactly **one** running `Name=bianca-production` instance. The production **EIP** must be attached to that instance (so `sip.*` and Twilio hit the same Mongo as `api.*` via the ALB).
- **Containers**: App talks to Asterisk over the Docker network at `http://asterisk:8088` (ARI). If the Asterisk container isn’t running on that instance, the app will never connect.

## 3. Debug on the production instance

SSH to the production instance (EIP or IP from Terraform/outputs), then:

```bash
# Which instance has the production EIP (run locally)
aws ec2 describe-addresses --filters "Name=tag:Name,Values=bianca-production-eip" \
  --query 'Addresses[*].[PublicIp,InstanceId]' --output text
# SSH: ssh -i ~/.ssh/YOUR_KEY.pem ec2-user@<EIP>

cd /opt/bianca-production   # or /opt/bianca-production-green before swap

# 1) Is Asterisk container running?
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep asterisk

# 2) Asterisk logs (startup / ARI)
docker logs production_asterisk --tail 100
# or: docker logs bianca-production_asterisk --tail 100

# 3) Can the app container reach Asterisk ARI?
docker exec production_app curl -s -o /dev/null -w "%{http_code}" http://asterisk:8088/ari/asterisk/info
# Expect 401 (auth required) or 200 if you pass auth; connection refused = Asterisk not listening

# 4) App logs for ARI connection errors
docker logs production_app --tail 200 2>&1 | grep -i -E 'ARI|asterisk|connect'
```

## 4. REGISTER "Failed to authenticate" for unknown usernames (e.g. 543)

If Asterisk logs show `Request 'REGISTER' from '<sip:543@...>' failed ... Failed to authenticate'` (or similar for other usernames):

- **We do not send REGISTER** – Our app only sends TwiML with `sip:bianca@sip.biancawellness.com:5061` to Twilio. Twilio then sends **INVITE** to us, not REGISTER. So this REGISTER is **not** from our config or Twilio.
- **Likely cause:** External SIP probing. Public SIP ports (5060/5061) are often scanned; bots try common extensions (100, 101, 543, etc.) and weak passwords. **"Failed to authenticate" is correct** – do not add auth for random usernames.
- **IP 69.74.119.166** is not in Twilio’s documented SIP IP ranges; treat it as untrusted. No change needed – rejecting it is the right behavior.

## 5. EXTERNAL_ADDRESS wrong after blue-green (EIP swap)

After a blue-green deploy, the EIP is associated with the new instance in **Step 6**, but `docker-compose.yml` was written at **deploy time** with the instance’s **pre-EIP** public IP. So Asterisk keeps using the wrong IP for SIP (e.g. Twilio can’t reach it, or SIP fails).

**One-time fix on the current production instance** (SSH or SSM):

```bash
cd /opt/bianca-production
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
sed -i.bak -e "s|EXTERNAL_ADDRESS=[^[:space:]]*|EXTERNAL_ADDRESS=$PUBLIC_IP|" \
           -e "s|ASTERISK_PUBLIC_IP=[^[:space:]]*|ASTERISK_PUBLIC_IP=$PUBLIC_IP|" docker-compose.yml
docker compose up -d asterisk app
```

Then check: `docker logs production_asterisk --tail 20` (should show correct external address).

**Pipeline fix (two layers):**

1. **Step 6** in `buildspec-swap-and-terminate.yml`: after associating the EIP with the new blue instance, SSM runs `sed` on `docker-compose.yml` and restarts Asterisk + app so SIP is correct **immediately** after swap (before the next app deploy).
2. **`application_start.sh` (CodeDeploy)**: before `docker compose up`, syncs `EXTERNAL_ADDRESS` and `ASTERISK_PUBLIC_IP` from **instance metadata** (`public-ipv4`). That fixes drift whenever someone deploys—even if Step 6 SSM failed, the instance was fixed manually once, or the EIP changed outside Terraform.

Step 6 uses `(docker compose ... || docker-compose ...)` so it works on both staging (standalone binary) and production (plugin).

**Staging one-time fix** (if Asterisk stopped working after a blue-green deploy): SSH to the staging instance (or use SSM), then:

```bash
cd /opt/bianca-staging
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
sudo sed -i.bak -e "s|EXTERNAL_ADDRESS=[^[:space:]]*|EXTERNAL_ADDRESS=$PUBLIC_IP|" \
           -e "s|ASTERISK_PUBLIC_IP=[^[:space:]]*|ASTERISK_PUBLIC_IP=$PUBLIC_IP|" docker-compose.yml
docker-compose up -d asterisk app
# or: docker compose up -d asterisk app
docker logs staging_asterisk --tail 20
```

## 6. Common causes

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| Asterisk container not running | Crash on start, missing env (e.g. ARI_PASSWORD), or deploy didn’t start it | Check `docker logs production_asterisk`. Ensure Secrets Manager has ARI_PASSWORD/BIANCA_PASSWORD and instance role can read the secret. Restart: `docker-compose up -d asterisk` or redeploy. |
| App logs "ARI connection" / "connect ECONNREFUSED" | Asterisk container down or not on same Docker network | Ensure Asterisk is up and on `bianca-network` with the app. |
| App logs "authentication" / 401 to ARI | ARI_PASSWORD mismatch (app vs Asterisk) | App and Asterisk must use the same ARI_PASSWORD (from same Secrets Manager secret). |
| Twilio can’t reach SIP | Wrong instance has traffic, or SIP (5061) not open | Ensure only the EIP instance is in the ALB (no orphans). Production SG allows 5060/5061 from internet (see production.tf). |

## 7. Security groups

Production SG (`production.tf`) already allows:

- SIP UDP 5060, TCP 5061 (Twilio)
- RTP UDP 10000–20000

So Asterisk connectivity from the internet is not blocked by the SG if the correct instance (with EIP) is the one receiving traffic.

## 8. After fixing

- Restart containers: `cd /opt/bianca-production && docker-compose up -d` (or `docker-compose` if that’s what the instance uses).
- Or trigger a new CodeDeploy to production so the single instance gets a full deploy with Asterisk started and validated (validate_service.sh checks Asterisk when present in compose).

## 9. Safe Docker cleanup (disk / stale containers)

If the instance is low on disk or you suspect leftover images/containers after many deploys:

- Script (prune **stopped** containers, **dangling** images, **build cache** only — **does not** `volume prune`):

  `packages/backend/devops/scripts/cleanup-production-docker.sh`

- Run on the box (SSH): `bash cleanup-production-docker.sh` after copying it, or paste the commands from that file.

- **SSM note:** `send-command` sometimes stays `Delayed`; Session Manager interactive shell or SSH is more reliable for long `docker compose up` runs.
