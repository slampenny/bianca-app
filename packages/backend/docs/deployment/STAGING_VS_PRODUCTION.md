# Staging vs production — what differs

Use this when **staging works but production doesn’t** and you need to compare behavior.

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
