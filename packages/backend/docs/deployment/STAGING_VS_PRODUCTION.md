# Staging vs production — what differs

Use this when **staging works but production doesn’t** and you need to compare behavior.

## CodePipeline stage order (same for both)

`Source → Build → CreateGreenInstance → Deploy → RunTests → PostDeployValidation → SwapAndTerminate`

Failed **RunTests** or **PostDeployValidation** stops the pipeline before swap. Pipelines use **V2 + QUEUED** execution mode so only one run is active at a time (avoids the console showing a failed swap on one run while tests from an older run still appear in progress).

## Deployment model (same for both)

- Code is **not** deployed via `git pull` on the server.
- **CodeDeploy** writes `docker-compose.yml` and pulls images from **ECR** (`:staging` vs `:production`).
- “Latest code” on an instance = **latest images** → `docker compose pull` then `docker compose up -d`.

## Typical differences

| Area | Staging | Production |
|------|---------|------------|
| **ECR image tag** | `staging` | `production` |
| **Deploy directory** | `/opt/bianca-staging` | `/opt/bianca-production` |
| **Container prefix** | `staging_*` | `production_*` |
| **API / app URLs** | `staging-api.biancawellness.com`, etc. | `api.biancawellness.com`, `app.biancawellness.com` |
| **Secrets** | Staging Secrets Manager secret | Production secret |
| **NODE_ENV in containers** | `staging` | `production` |
| **Blue/green** | Same pattern (green dir may exist during deploy) | Same |

## Which production instance is live?

Check the **API target group** (only healthy targets receive traffic):

```bash
aws elbv2 describe-target-health \
  --target-group-arn "$(aws elbv2 describe-target-groups --names bianca-production-api-tg --query 'TargetGroups[0].TargetGroupArn' --output text)" \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' \
  --output table
```

SSH or SSM should target the instance that is **healthy** there (often `bianca-production`, not `bianca-production-green`, **after** a swap).

## Manually refresh production to latest images (on the live instance)

```bash
# SSH (use your key and the instance public IP or EIP)
ssh -i ~/.ssh/<your-key>.pem ec2-user@<PRODUCTION_PUBLIC_IP>

cd /opt/bianca-production

export AWS_DEFAULT_REGION=us-east-2
ACCOUNT=730335291008
aws ecr get-login-password --region "$AWS_DEFAULT_REGION" | \
  docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"

docker compose pull || docker-compose pull
docker compose up -d || docker-compose up -d

docker ps
```

Requires instance IAM permission for `ecr:GetAuthorizationToken` and ECR pull (normal for deploy instances).

## After blue-green: SIP / Asterisk external IP

If SIP breaks after a swap, `EXTERNAL_ADDRESS` in `docker-compose.yml` may still point at an old public IP. See `devops/docs/ASTERISK_PRODUCTION_DEBUG.md` section 5.

## EC2 cost schedules (Terraform)

### Production — daily window (default 07:00–13:00 Pacific)

Defined in `devops/terraform/production-schedule.tf`:

- **EventBridge Scheduler** invokes Lambda `bianca-production-ec2-scheduler` to **start** then **stop** the primary instance (`aws_instance.production`, tag `Name=bianca-production`).
- **Timezone** defaults to **`America/Los_Angeles`** (PST/PDT).
- **Times** default to **07:00** start and **13:00** stop (7am–1pm local Pacific). Override with `production_schedule_*` variables.
- **Disable** the schedules entirely: set `production_ec2_cost_schedule_enabled = false` and `terraform apply`.

After apply, `terraform output production_ec2_schedule_summary` shows the resolved cron + timezone.

**Caveats:** Only the **primary** blue instance is controlled; a transient **`bianca-production-green`** instance during CodeDeploy is not stopped by this Lambda. Stopping production drops ALB health until the instance is started again—plan for the scheduled off-hours window only if that is acceptable for your users.

### Marketing WordPress (apex site)

Lightsail + separate Terraform state: **`packages/backend/devops/terraform-marketing-wordpress/`** (not the main `devops/terraform/` stack). SSH uses the same **`~/.ssh/bianca-key-pair.pem`** as EC2 (imported into Lightsail by Terraform). WordPress source and `deploy-to-lightsail.sh` remain in **`~/code/wp-dev`** — see `sites/biancawellness/LIGHTSAIL.md` there.

### Staging — manual start, idle auto-stop

Staging EC2 is **started only by you** (`yarn staging:up` or `staging-control.sh start`). Nothing in AWS will start it on a schedule.

**`bianca-staging-auto-stop`** (`staging.tf`) runs every **30 minutes** and **stops** the instance if network traffic looks idle (~30 min). It never starts the instance. The Lambda resolves the live instance by EC2 tag **`Name=bianca-staging`** (newest running), not a baked-in instance ID, so blue/green swaps do not break auto-stop.

The old hourly **`bianca-staging-scheduler`** Lambda (clock-based start/stop) was **removed** from Terraform — run `terraform apply` in `devops/terraform` to delete it from AWS if still deployed.

```bash
bash packages/backend/scripts/staging-control.sh start   # or yarn staging:up
bash packages/backend/scripts/staging-control.sh stop    # or yarn staging:down
bash packages/backend/scripts/staging-control.sh status
```

Root `yarn staging:down` / `yarn staging:status` / `yarn staging:up` wrap the same script.
