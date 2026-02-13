# Blue-Green Deployment for Staging

## Overview

This document describes the budget blue-green deployment strategy implemented for the staging environment. This approach ensures zero-downtime deployments by:

1. Creating a fresh "green" instance
2. Deploying the new code to the green instance
3. Validating the green instance
4. Swapping ALB target groups to point to the green instance
5. Terminating the old "blue" instance

## How It Works

### Pipeline Stages

**Staging Pipeline** (Fast iteration - tests don't block):
1. **Source**: Pulls code from GitHub `staging` branch
2. **Build**: Builds Docker images and pushes to ECR
3. **CreateGreenInstance**: Creates a new EC2 instance tagged as `bianca-staging-green`
4. **Deploy**: Deploys code to the green instance using CodeDeploy
5. **PostDeployValidation**: Validates the green instance is healthy and accessible
6. **SwapAndTerminate**: 
   - **Migrates MongoDB EBS volume** from blue to green (so patient/data persists; green is launched without a data volume)
   - Registers green instance with ALB target groups
   - Waits for health checks to pass
   - Deregisters blue instance from target groups
   - Terminates the old blue instance
   - Renames green instance to `bianca-staging` for next deployment
7. **RunTests**: Runs unit and E2E tests (runs AFTER swap, non-blocking - for monitoring/feedback)

**Production Pipeline** (Safe - tests MUST pass before swap):
1. **Source**: Pulls code from GitHub `main` branch
2. **Build**: Builds Docker images and pushes to ECR
3. **CreateGreenInstance**: Creates a new green instance
4. **Deploy + RunTests**: Run in PARALLEL on green instance (both must pass to proceed)
5. **PostDeployValidation**: Validates green instance health
6. **SwapAndTerminate**: Same as staging (MongoDB volume migration, then register green, deregister blue, terminate blue, rename green). Only proceeds if Deploy, RunTests, AND PostDeployValidation all pass

### Cost Optimization

- **Budget-friendly**: Only runs 2 instances briefly during the swap (typically 1-2 minutes)
- **Automatic cleanup**: Old instance is terminated immediately after swap
- **No additional services**: Uses existing ALB and target groups
- **Same instance type**: Green instance uses the same `t3.small` instance type as blue

### Key Components

#### CodeBuild Projects

1. **`bianca-staging-create-green-instance`**: Creates the green instance
   - Uses the same launch template as the blue instance
   - Waits for instance to be ready and status checks to pass
   - Outputs instance ID and IP for subsequent stages

2. **`bianca-staging-swap-and-terminate`**: Handles the traffic swap
   - **Step 0 (volume migration)**: Stops app/MongoDB on blue, detaches the MongoDB EBS volume from blue, attaches it to green, mounts on green and restarts MongoDB (so the new instance uses the same data)
   - Registers green instance with ALB target groups
   - Waits for health checks
   - Deregisters and terminates blue instance
   - Renames green to become the new blue
   - **Step 7 (Terraform state)**: Updates Terraform state so the instance resource points at the new blue (avoids drift on the next `terraform apply`). Same step runs for production.

#### CodeDeploy Deployment Groups

- **`bianca-staging-ec2`**: Targets instances with `Name=bianca-staging` (blue)
- **`bianca-staging-green-ec2`**: Targets instances with `Name=bianca-staging-green` (green)

The pipeline uses the green deployment group to deploy to the newly created green instance.

## Validation

The validation stage tests the green instance **directly by IP** before swapping traffic:

- Tests API health endpoint: `http://<green-ip>:3000/health`
- Tests Frontend: `http://<green-ip>`

This ensures the green instance is fully functional before any traffic is routed to it.

## Rollback

If validation fails, the pipeline stops and:
- Green instance remains running (can be manually inspected)
- Blue instance continues serving traffic
- No traffic swap occurs
- Green instance can be manually terminated

## Limitations

### SIP Subdomain

The SIP subdomain (`staging-sip.biancawellness.com`) points to an Elastic IP (EIP) for Twilio connectivity. The current implementation:

- Green instance does **not** get an EIP initially
- SIP traffic continues to work on the blue instance until it's terminated
- For full blue-green SIP support, EIP swapping would need to be added

**Workaround**: SIP functionality is typically not critical for staging, and the blue instance remains available until termination.

### EBS Volume for MongoDB

Staging and production both use an EBS volume for MongoDB attached to the blue instance. The **SwapAndTerminate** stage migrates this volume so data persists:

- Before swapping traffic: the buildspec detaches the MongoDB volume from blue and attaches it to green, then mounts and restarts MongoDB on green.
- The deploy directory is derived from `BLUE_TAG` (`/opt/bianca-staging` or `/opt/bianca-production`), so the same buildspec works for both environments.

## Monitoring

### CloudWatch Logs

- `/aws/codebuild/bianca-staging-create-green-instance`
- `/aws/codebuild/bianca-staging-swap-and-terminate`
- `/aws/codebuild/bianca-staging-post-deploy-validation`

### Pipeline Status

Monitor the pipeline in AWS CodePipeline console:
- Each stage shows success/failure
- Green instance creation time: ~2-3 minutes
- Deployment time: ~3-5 minutes
- Validation time: ~2-3 minutes
- Swap time: ~1-2 minutes

**Total deployment time**: ~10-15 minutes (similar to previous single-instance deployment)

## Troubleshooting

### Green Instance Creation Fails

- Check CloudWatch logs for the create-green-instance project
- Verify IAM permissions for EC2 instance creation
- Check launch template exists and is valid
- Verify subnet and security group exist

### Deployment to Green Instance Fails

- Check CodeDeploy agent is running on green instance
- Verify green instance has correct IAM permissions
- Check CodeDeploy deployment logs in AWS Console
- Ensure green instance is tagged correctly (`Name=bianca-staging-green`)

### Validation Fails

- Green instance remains running for inspection
- SSH to green instance: `ssh -i ~/.ssh/<key>.pem ec2-user@<green-ip>`
- Check container logs: `docker ps` and `docker logs <container>`
- Verify security groups allow traffic on ports 80 and 3000

### Swap Fails

- Check ALB target group health status
- Verify green instance is registered with target groups
- Check security group rules allow ALB to reach instance
- Review CloudWatch logs for swap-and-terminate project

### Data wiped after deploy (MongoDB empty)

If the app shows no data after a blue-green deploy, the MongoDB EBS volume may not have been mounted or restarted on the new instance (e.g. Step 0’s `docker compose` command failed on instances that only have `docker-compose`). The **data may still exist** on an EBS volume.

**Immediate recovery (production or staging):**

1. **Find the MongoDB volume** (attached to current instance or available):
   ```bash
   # Current instance ID (the one serving traffic)
   INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].InstanceId' --output text --region us-east-2 --profile jordan)
   # Volumes attached to this instance
   aws ec2 describe-volumes --filters "Name=attachment.instance-id,Values=$INSTANCE_ID" --query 'Volumes[*].[VolumeId,Attachments[0].Device,Size]' --output table --region us-east-2 --profile jordan
   # Or find unattached volumes by name (staging/production MongoDB data)
   aws ec2 describe-volumes --filters "Name=tag:Name,Values=bianca-production-mongodb-data" "Name=status,Values=available" --query 'Volumes[*].VolumeId' --output text --region us-east-2 --profile jordan
   ```

2. **If volume is attached at `/dev/sdf` but app still has no data:** SSH to the instance and ensure it’s mounted and MongoDB is using it:
   ```bash
   ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<PRODUCTION_IP>
   sudo mount | grep mongodb   # should show /dev/sdf on /opt/mongodb-data
   # If not mounted:
   sudo mount /dev/sdf /opt/mongodb-data
   sudo chown -R 999:999 /opt/mongodb-data
   cd /opt/bianca-production && (docker compose restart mongodb 2>/dev/null || docker-compose restart mongodb)
   ```

3. **If volume is available (detached):** Attach it to the current instance, then do step 2:
   ```bash
   aws ec2 attach-volume --volume-id vol-xxxxx --instance-id $INSTANCE_ID --device /dev/sdf --region us-east-2 --profile jordan
   # Wait ~30s then SSH and mount/restart as in step 2
   ```

4. **If the volume was attached to the terminated (old blue) instance when it was terminated**, the volume may still exist but data can be lost depending on EBS behavior. Prefer avoiding this by ensuring Step 0 always succeeds (pipeline now fails the stage if green mount/restart fails).

**Pipeline fix (already in buildspec):** Step 0 now uses `(docker compose ... || docker-compose ...)` so it works on instances with either the plugin or standalone binary, and **the pipeline exits with an error** if the green mount/restart step fails, so we do not swap traffic to an instance with an empty DB.

## Future Enhancements

1. **EIP Swapping**: Add EIP allocation and Route53 update for SIP subdomain
2. **Volume Migration**: Copy MongoDB data from blue to green before swap
3. **Automatic Rollback**: Automatically terminate green instance if validation fails
4. **Health Check Improvements**: More comprehensive health checks before swap
5. **Production Support**: Extend to production environment with full feature set

## Files Modified

- `packages/backend/devops/terraform/codepipeline-staging.tf`: Added blue-green CodeBuild projects and pipeline stages
- `packages/backend/devops/terraform/codedeploy-staging.tf`: Added green deployment group
- `packages/backend/devops/buildspec-create-green-instance.yml`: New buildspec for creating green instance
- `packages/backend/devops/buildspec-swap-and-terminate.yml`: New buildspec for swapping and terminating
- `packages/backend/devops/buildspec-post-deploy-validation.yml`: Updated to validate green instance directly

## IAM Permissions Added

The CodeBuild staging role now has permissions for:
- EC2 instance creation and termination
- EIP allocation and association
- EBS volume attachment/detachment
- ALB target group registration/deregistration
- EC2 tagging and instance management
