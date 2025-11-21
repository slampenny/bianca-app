# WordPress Deployment Status

**Deployment Date**: January 15, 2025

## Deployment Commands

```bash
cd devops/terraform
terraform apply -var="create_wordpress=true"
```

## Safety Guarantees

✅ **App subdomains are UNTOUCHED**:
- `api.biancawellness.com` - **UNCHANGED** ✓
- `app.biancawellness.com` - **UNCHANGED** ✓
- `staging.biancawellness.com` - **UNCHANGED** ✓
- `staging-api.biancawellness.com` - **UNCHANGED** ✓
- `sip.biancawellness.com` - **UNCHANGED** ✓
- `staging-sip.biancawellness.com` - **UNCHANGED** ✓

✅ **WordPress only manages**:
- `biancawellness.com` (root domain)
- `www.biancawellness.com`

## Verification Steps

1. **Check instance is running**:
   ```bash
   aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-wordpress" --query "Reservations[0].Instances[0].[InstanceId,PublicIpAddress,State.Name]"
   ```

2. **Check DNS records**:
   ```bash
   terraform output wordpress_elastic_ip
   dig biancawellness.com
   dig www.biancawellness.com
   ```

3. **Verify app subdomains unchanged**:
   ```bash
   dig api.biancawellness.com
   dig app.biancawellness.com
   dig staging.biancawellness.com
   ```

4. **Test WordPress**:
   ```bash
   curl -I http://$(terraform output -raw wordpress_instance_ip)
   curl -I https://biancawellness.com
   ```

5. **Check SSL**:
   ```bash
   openssl s_client -connect biancawellness.com:443 -servername biancawellness.com < /dev/null 2>/dev/null | grep -E "subject|issuer"
   ```

## Troubleshooting

If WordPress isn't responding:
1. Check instance logs: SSH and check `/var/log/wordpress-userdata.log`
2. Check Docker: `sudo docker ps` and `sudo docker logs bianca-wordpress`
3. Check nginx: `sudo docker logs bianca-wordpress-nginx`
4. Verify DNS propagation: Can take 5-15 minutes

## Next Steps After Deployment

1. **Complete WordPress Setup**:
   - Visit `https://biancawellness.com`
   - Complete WordPress installation wizard
   - Create admin account

2. **Verify SSL Certificate**:
   - Let's Encrypt certificate should be obtained automatically
   - Check with: `curl -I https://biancawellness.com`

3. **Test App Subdomains Still Work**:
   - Verify `https://app.biancawellness.com` still works
   - Verify `https://api.biancawellness.com` still works
   - Verify `https://staging.biancawellness.com` still works

---

**Important**: WordPress deployment is isolated and will NOT affect app deployments.





