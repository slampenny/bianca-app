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
6. **SwapAndTerminate**: Only proceeds if Deploy, RunTests, AND PostDeployValidation all pass

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
   - Registers green instance with ALB target groups
   - Waits for health checks
   - Deregisters and terminates blue instance
   - Renames green to become the new blue

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

The staging MongoDB uses an EBS volume attached to the instance. The current implementation:

- Green instance starts with a fresh MongoDB (empty database)
- For staging, this is typically acceptable as data can be reset
- For production blue-green, volume migration would be needed

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
