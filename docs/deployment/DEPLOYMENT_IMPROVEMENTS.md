# Production Deployment Improvements

## Problems Fixed

### 1. **Elastic IP (EIP) for Production Instance**
- **Problem**: Instance IP changed every time it was recreated, breaking DNS and Asterisk config
- **Solution**: Added `aws_eip.production` resource that provides a static IP
- **Benefit**: IP never changes, DNS always points to correct address

### 2. **Automatic DNS Updates**
- **Problem**: DNS had to be manually updated when instance IP changed
- **Solution**: Added `aws_route53_record.production_sip` in Terraform that automatically uses EIP
- **Benefit**: DNS updates automatically when Terraform applies

### 3. **Correct IP in Userdata Script**
- **Problem**: Userdata script used instance metadata IP which could be wrong during creation
- **Solution**: Pass EIP from Terraform to userdata script via template variable
- **Benefit**: Asterisk always gets the correct external IP from the start

### 4. **Post-Deployment Validation**
- **Problem**: Issues only discovered after deployment failed
- **Solution**: Added `validate-production-deployment.sh` script
- **Benefit**: Automatically checks DNS, Asterisk config, containers, security groups after deploy

### 5. **Security Group Fix**
- **Problem**: Missing port 5061 TCP (required for Twilio SIP)
- **Solution**: Added port 5061 TCP ingress rule in Terraform
- **Benefit**: Security group is correct by default, no manual fixes needed

## How It Works Now

1. **Terraform creates EIP** → Static IP assigned to production instance
2. **Route53 automatically points** `sip.biancawellness.com` → EIP
3. **Userdata script uses EIP** → Asterisk gets correct external address
4. **Deploy script validates** → Catches issues immediately

## Next Deployment

When you run `./scripts/deploy-production.sh`:

1. ✅ Builds and pushes Docker images
2. ✅ Runs Terraform (creates/updates EIP, DNS, security groups)
3. ✅ Updates containers on instance
4. ✅ Validates deployment automatically
5. ✅ Reports any issues found

## Manual Fixes (No Longer Needed)

These are now automated:
- ❌ ~~Manually update DNS~~ → Terraform handles it
- ❌ ~~Manually fix Asterisk IP~~ → Userdata script uses EIP
- ❌ ~~Manually check security groups~~ → Terraform ensures correct config
- ❌ ~~Manually verify deployment~~ → Validation script checks everything

## Future Improvements (Optional)

1. **Health checks**: Add automatic health checks that restart containers if unhealthy
2. **Rolling deployments**: Deploy new version alongside old, then switch
3. **Backup before deploy**: Automatically backup MongoDB before deployment
4. **Smoke tests**: Run automated tests after deployment to verify functionality








