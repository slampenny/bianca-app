#!/bin/bash
# Script to check staging application logs
# Run this via SSM or SSH to diagnose crashes

echo "=== Staging Application Diagnostic ==="
echo ""

cd /opt/bianca-staging 2>/dev/null || {
  echo "❌ Cannot access /opt/bianca-staging"
  exit 1
}

echo "=== Container Status ==="
sudo docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.RestartCount}}" | grep staging || echo "No staging containers found"
echo ""

echo "=== App Container Restart Count ==="
sudo docker inspect staging_app --format="Restarts: {{.RestartCount}}, Status: {{.State.Status}}, ExitCode: {{.State.ExitCode}}, Started: {{.State.StartedAt}}" 2>/dev/null || echo "App container not found"
echo ""

echo "=== App Container Logs (last 200 lines) ==="
sudo docker logs staging_app --tail 200 2>&1 || echo "Cannot get app logs"
echo ""

echo "=== App Container Recent Errors ==="
sudo docker logs staging_app --tail 500 2>&1 | grep -i "error\|exception\|crash\|fatal\|panic" | tail -20 || echo "No errors found in recent logs"
echo ""

echo "=== Frontend Container Logs (last 50 lines) ==="
sudo docker logs staging_frontend --tail 50 2>&1 || echo "Cannot get frontend logs"
echo ""

echo "=== Nginx Container Logs (last 50 lines) ==="
sudo docker logs staging_nginx --tail 50 2>&1 || echo "Cannot get nginx logs"
echo ""

echo "=== Docker Compose Status ==="
sudo docker-compose ps 2>/dev/null || echo "Cannot get docker-compose status"
echo ""

echo "=== System Resources ==="
free -h
df -h / | tail -1
echo ""

echo "=== Recent System Logs (docker related) ==="
sudo journalctl -u docker --since "10 minutes ago" --no-pager | tail -20 || echo "Cannot get system logs"
echo ""

echo "=== Done ==="

