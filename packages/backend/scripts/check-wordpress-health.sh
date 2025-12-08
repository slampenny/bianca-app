#!/bin/bash
# Script to check if WordPress health check is running and diagnose issues

echo "=========================================="
echo "WordPress Health Check Diagnostic"
echo "=========================================="
echo ""

# Check if health check script exists
if [ -f "/usr/local/bin/wordpress-health-check.sh" ]; then
    echo "✅ Health check script exists: /usr/local/bin/wordpress-health-check.sh"
else
    echo "❌ Health check script NOT FOUND: /usr/local/bin/wordpress-health-check.sh"
    echo "   This should have been created during instance setup."
fi
echo ""

# Check if health check is scheduled in cron
if crontab -l 2>/dev/null | grep -q "wordpress-health-check"; then
    echo "✅ Health check is scheduled in cron:"
    crontab -l 2>/dev/null | grep "wordpress-health-check"
else
    echo "❌ Health check NOT scheduled in cron!"
    echo "   Expected: */2 * * * * /usr/local/bin/wordpress-health-check.sh"
fi
echo ""

# Check health check log
if [ -f "/var/log/wordpress-health-check.log" ]; then
    echo "✅ Health check log exists: /var/log/wordpress-health-check.log"
    echo "   Last 20 lines:"
    tail -20 /var/log/wordpress-health-check.log
else
    echo "⚠️  Health check log NOT FOUND (script may not have run yet)"
fi
echo ""

# Check if containers are running
echo "Container Status:"
if docker ps | grep -q "bianca-wordpress\$"; then
    echo "✅ WordPress container is running"
else
    echo "❌ WordPress container is NOT running"
fi

if docker ps | grep -q "bianca-wordpress-nginx\$"; then
    echo "✅ Nginx container is running"
else
    echo "❌ Nginx container is NOT running"
fi

if docker ps | grep -q "bianca-wordpress-db\$"; then
    echo "✅ Database container is running"
else
    echo "❌ Database container is NOT running"
fi
echo ""

# Check nginx response (with timeout)
echo "Testing nginx response (5 second timeout):"
if curl -f -s -m 5 http://localhost:80 >/dev/null 2>&1; then
    echo "✅ Nginx responding on port 80"
else
    echo "❌ Nginx NOT responding on port 80"
fi
echo ""

# Check WordPress response (with longer timeout for gateway timeout detection)
echo "Testing WordPress response (30 second timeout to detect gateway timeouts):"
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" -m 30 http://localhost:80 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ WordPress responding (took ${RESPONSE_TIME}s)"
    if (( $(echo "$RESPONSE_TIME > 10" | bc -l) )); then
        echo "⚠️  WARNING: Response time is very slow (${RESPONSE_TIME}s) - may cause gateway timeouts"
    fi
else
    echo "❌ WordPress NOT responding or timed out"
fi
echo ""

# Check database connectivity
echo "Testing database connectivity:"
if docker exec bianca-wordpress ping -c 2 wordpress-db >/dev/null 2>&1; then
    echo "✅ WordPress can reach database"
else
    echo "❌ WordPress cannot reach database"
fi
echo ""

# Check recent container logs for errors
echo "Recent WordPress container errors (last 10 lines):"
docker logs --tail 10 bianca-wordpress 2>&1 | grep -i "error\|timeout\|fatal" || echo "   No recent errors found"
echo ""

# Check nginx logs
echo "Recent nginx errors (last 10 lines):"
docker logs --tail 10 bianca-wordpress-nginx 2>&1 | grep -i "error\|timeout\|fatal" || echo "   No recent errors found"
echo ""

# Check if health check script is executable
if [ -x "/usr/local/bin/wordpress-health-check.sh" ]; then
    echo "✅ Health check script is executable"
else
    echo "❌ Health check script is NOT executable - fixing..."
    chmod +x /usr/local/bin/wordpress-health-check.sh
    echo "   Fixed!"
fi
echo ""

# Run health check manually
echo "Running health check manually..."
/usr/local/bin/wordpress-health-check.sh
echo ""

echo "=========================================="
echo "Diagnostic complete"
echo "=========================================="




