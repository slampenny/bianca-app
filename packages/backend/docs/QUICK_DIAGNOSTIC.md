# Quick Diagnostic Guide

## Check Backend Logs and Status

### Using the Diagnostic Script (Local Machine)

```bash
# Check staging backend via SSM (uses jordan profile)
./packages/backend/scripts/check-backend-logs-remote.sh staging

# Check production backend via SSM
./packages/backend/scripts/check-backend-logs-remote.sh production
```

### Using the Diagnostic Script (On Server)

```bash
# SSH into the server
ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<staging-ip>

# Run diagnostic script
cd /opt/bianca-staging
bash /opt/bianca-deployment/scripts/check-backend-logs.sh staging
```

### Manual Commands

```bash
# SSH into the server
ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<instance-ip>

# Check container status
docker ps -a | grep staging_app  # or production_app

# Check if container is running
docker ps | grep staging_app

# Check container logs
docker logs staging_app --tail 100

# Check for errors
docker logs staging_app --tail 500 | grep -i "error\|exception\|crash\|fatal"

# Check if backend is responding
curl http://localhost:3000/health

# Test API endpoints
curl http://localhost:3000/v1/docs
curl http://localhost:3000/v1/auth/login

# Check container restart count
docker inspect staging_app --format 'Restarts: {{.RestartCount}}, Status: {{.State.Status}}, ExitCode: {{.State.ExitCode}}'
```

## Common Issues

### Container Not Running

**Symptoms:**
- `docker ps` shows no `staging_app` or `production_app`
- Health endpoint doesn't respond
- Network errors in frontend

**Check:**
```bash
# Check if container exists but stopped
docker ps -a | grep staging_app

# Check exit code
docker inspect staging_app --format '{{.State.ExitCode}}'

# Check logs for crash reason
docker logs staging_app --tail 200
```

**Fix:**
```bash
cd /opt/bianca-staging  # or /opt/bianca-production
docker compose up -d
```

### Container Running But Health Check Fails

**Symptoms:**
- Container shows as "Up" but `/health` doesn't respond
- Port 3000 not listening

**Check:**
```bash
# Check if port is listening
ss -tlnp | grep :3000

# Check container logs for startup errors
docker logs staging_app --tail 100 | grep -i "error\|listening\|started"

# Check if app actually started
docker logs staging_app | grep -i "server\|listening\|port 3000"
```

### API Endpoints Return 404

**Symptoms:**
- Health endpoint works (`/health` returns 200`)
- But API endpoints return 404 (`/v1/*`)

**Check:**
```bash
# Test endpoints
curl http://localhost:3000/v1/docs
curl http://localhost:3000/v1/auth/login

# Check logs for route registration
docker logs staging_app | grep -i "route\|v1"

# Check if routes are loaded
docker logs staging_app | grep -i "routes\|express\|app"
```

**Possible causes:**
- Routes not registered (check `routes/v1/index.js`)
- Application crashed after health check but before routes loaded
- Middleware blocking requests

### Network Error from Frontend

**Symptoms:**
- Frontend shows "Network error: Unable to connect to the server"
- Health check passes locally
- But frontend can't reach API

**Check:**
```bash
# Test from server
curl https://api.biancawellness.com/health
curl https://api.biancawellness.com/v1/docs

# Check ALB target group health
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn> \
  --region us-east-2 \
  --profile jordan

# Check CORS preflight
curl -X OPTIONS \
  -H "Origin: https://app.biancawellness.com" \
  -H "Access-Control-Request-Method: POST" \
  -v https://api.biancawellness.com/v1/sso/login
```

## Enhanced Validation

The pipeline now checks:
1. ✅ Backend container running
2. ✅ Health endpoint (`/health`)
3. ✅ **API endpoints registered** (`/v1/docs`, `/v1/auth/login`) - NEW
4. ✅ Nginx responding
5. ✅ Public URLs accessible
6. ✅ **Public API endpoints accessible** - NEW

If validation fails, check the logs using the diagnostic script above.
