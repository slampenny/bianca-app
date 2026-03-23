# Stable external addressing (Terraform + blue/green)

**Requirement:** Anything the internet, Twilio, DNS, or partners reaches must **not** depend on an **ephemeral** EC2 public IP. **Terraform** is the source of truth; **blue/green** must keep the same stable addresses.

## What is stable today (in this repo)

| Traffic / purpose | Stable mechanism | Where it lives |
|-------------------|------------------|----------------|
| **HTTPS API & app** | **Application Load Balancer** — DNS points to the ALB; listeners swap target groups during deploy. Instance IPs behind the ALB can change. | `production.tf` — `aws_lb.production`, `aws_lb_target_group.*`, Route53 alias records as configured |
| **SIP / voice edge** (e.g. `sip.myphonefriend.com`) | **Elastic IP** — single allocation; **same public IP forever** until you release the EIP in AWS. | `production.tf` — `aws_eip.production`, `aws_eip_association.production`, Route53 `A` records to `aws_eip.production.public_ip` |
| **Blue/green** | After traffic moves to the new instance, the **same EIP allocation** is **re-associated** to the instance that is now “blue” (live). | `codepipeline-production-bluegreen.tf` passes `PRODUCTION_EIP_ALLOCATION_ID` → `buildspec-swap-and-terminate.yml` (Step 6) |

Green instances are launched **without** the production EIP in userdata (`production_green` launch template uses `eip_address = ""`) so they get a **temporary** public IP only until **swap** completes; then the **Terraform-managed EIP** moves to the winning instance.

## Rules for changes

1. **Do not** document or configure Twilio, SIP trunks, or firewall allowlists using **raw instance public IPs** unless that IP is **guaranteed** to be an **Elastic IP** managed in Terraform (or an ALB hostname).
2. **Do not** create production “voice” or “webhook” endpoints on instances that only have **ephemeral** public IPs — either attach the existing `aws_eip.production` (after import into state if needed) or put the service behind the **ALB** with a stable DNS name.
3. After **blue/green** production deploys, confirm **Step 6** in `buildspec-swap-and-terminate.yml` ran successfully (EIP associated + Asterisk/app config updated as in the script). If EIP association fails, SIP will still point at the **old** IP until fixed.

## CI/CD: what was wiping the EIP (fixed)

Blue/green **Step 4 terminated the blue instance while it still held the SIP Elastic IP**. Terminating an instance **disassociates** its EIP; the address stays allocated but can show as **unassociated** in the console. **Step 6** then tried to attach the EIP to green — if that step failed (or was masked by `2>/dev/null`), the pipeline could still “succeed” and **SIP pointed at nothing useful**.

**Fix in `buildspec-swap-and-terminate.yml`:**

1. **Step 2.5** — `associate-address` to **green** (with `--allow-reassociation`) **before** deregistering/terminating blue, so the EIP is never left orphaned by termination.
2. **Fail the build** if association fails when `PRODUCTION_EIP_ALLOCATION_ID` / `STAGING_EIP_ALLOCATION_ID` is set.
3. **Step 6** — verify the EIP’s `InstanceId` matches the live (green) instance before Terraform state update.

**Emergency repair (run from laptop with AWS creds):**  
`packages/backend/devops/scripts/reassociate-sip-eip.sh production` (or `staging`).

## Related files

- `production.tf` — VPC, `aws_eip.production`, production instance, ALB, target groups, SIP DNS to EIP
- `codepipeline-production-bluegreen.tf` — production CodeBuild env including `aws_eip.production.id` for swap
- `buildspec-swap-and-terminate.yml` — ALB target group swap, Mongo volume migration, **EIP move before blue termination**, verification
- `staging.tf` / `codepipeline-staging.tf` — staging EIP + staging swap (`STAGING_EIP_ALLOCATION_ID`)

## Drift / console changes

If EC2 instances are created or replaced **only in the console** without updating Terraform, you can end up with **no Elastic IP** on the instance that actually receives traffic — even if Terraform still shows an `aws_eip` resource. **Apply** or **import** so state matches reality, and prefer **`terraform apply`** for production topology changes.
