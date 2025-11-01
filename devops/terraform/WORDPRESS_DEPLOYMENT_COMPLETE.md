# WordPress Deployment Complete ✅

**Deployment Date**: January 15, 2025  
**Status**: WordPress instance deployed and configured

## Deployment Summary

✅ **WordPress instance created**: `i-0c212fd606476f74a`  
✅ **DNS records updated**: `myphonefriend.com` and `www.myphonefriend.com` → WordPress instance  
✅ **App subdomains unchanged**: All app subdomains remain untouched  
✅ **SSL configured**: Let's Encrypt certificate setup in user_data  

## Configuration Decisions

### EIP (Elastic IP) - DISABLED
- **Reason**: AWS account has reached EIP limit (5 addresses)
- **Solution**: Using auto-assigned public IP from instance
- **Impact**: IP is static as long as instance isn't terminated
- **Note**: If you need a true Elastic IP, release an unused one first

### Route53 Records
- **Managed by Terraform**: `aws_route53_record.wordpress_root` and `aws_route53_record.wordpress_www`
- **Uses**: Instance public IP (`aws_instance.wordpress[0].public_ip`)
- **Only manages**: Root domain and www subdomain - NO app subdomains touched

## Current State

- **Instance**: Running
- **IP**: Auto-assigned public IP (static while instance runs)
- **DNS**: Propagating (5-15 minutes for full propagation)
- **Containers**: Still initializing (Docker Compose starting WordPress + MySQL + nginx)

## Access WordPress

1. **Via IP** (immediate):
   ```bash
   terraform output wordpress_instance_ip
   # Then visit: http://<ip>
   ```

2. **Via Domain** (after DNS propagates):
   ```
   http://myphonefriend.com
   https://myphonefriend.com (once SSL cert is obtained)
   ```

## SSL Certificate

Let's Encrypt certificate will be obtained automatically during instance initialization via certbot. If it fails, you can manually run:

```bash
# SSH to instance
terraform output wordpress_ssh_command

# Then run:
cd /opt/bianca-wordpress
certbot certonly --standalone -d myphonefriend.com -d www.myphonefriend.com
docker-compose restart nginx
```

## Verification Checklist

- [x] WordPress instance created
- [x] DNS records created for root domain
- [x] App subdomains verified unchanged
- [ ] WordPress containers running (check with `docker ps`)
- [ ] WordPress accessible via HTTP
- [ ] SSL certificate obtained
- [ ] WordPress installation wizard completed

## Troubleshooting

### Containers Not Running
```bash
# SSH to instance
terraform output wordpress_ssh_command

# Check logs
sudo tail -f /var/log/wordpress-userdata.log
sudo docker ps
sudo docker logs bianca-wordpress
sudo docker logs bianca-wordpress-db
```

### DNS Not Propagated
```bash
# Check DNS
dig myphonefriend.com
nslookup myphonefriend.com

# Should show WordPress instance IP
```

### SSL Certificate Not Obtained
- Check certbot logs: `/var/log/letsencrypt/`
- Ensure DNS is propagated before obtaining cert
- Run certbot manually if needed (see SSL Certificate section above)

## Important Notes

1. **EIP Limit**: WordPress doesn't use Elastic IP (limit reached). Uses auto-assigned IP which is static while instance runs.

2. **App Isolation**: WordPress deployment does NOT affect app subdomains:
   - `api.myphonefriend.com` - **UNCHANGED** ✓
   - `app.myphonefriend.com` - **UNCHANGED** ✓
   - `staging.myphonefriend.com` - **UNCHANGED** ✓
   - `staging-api.myphonefriend.com` - **UNCHANGED** ✓

3. **Reproducibility**: All Terraform code is saved in `wordpress.tf` and can be reproduced by running:
   ```bash
   terraform apply -var="create_wordpress=true"
   ```

---

**Terraform State**: All WordPress resources are tracked in Terraform state and can be managed/reproduced.


