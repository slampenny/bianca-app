# Options for Handling Userdata Scripts

## Current Problem
The userdata script (367 lines) does too much:
- Installs Docker, docker-compose, AWS CLI
- Creates docker-compose.yml
- **Pulls and starts containers** (conflicts with CodeDeploy)
- Installs CodeDeploy agent
- Has `set -e` which exits on any error

This can cause issues:
1. Userdata starts containers, CodeDeploy tries to manage them → conflict
2. Userdata creates docker-compose.yml, CodeDeploy might want to manage it
3. If userdata fails, CodeDeploy can't deploy
4. Long-running userdata might not finish before CodeDeploy starts

## Option 1: Minimal Userdata (RECOMMENDED)
**Only install prerequisites, let CodeDeploy handle everything**

Pros:
- Clear separation of concerns
- No conflicts with CodeDeploy
- Faster instance startup
- CodeDeploy has full control

Cons:
- First deployment must wait for CodeDeploy
- Need to ensure CodeDeploy scripts create docker-compose.yml

Changes needed:
- Remove container startup from userdata
- Remove docker-compose.yml creation (or make it minimal)
- Keep only: Docker install, CodeDeploy agent, SSM agent
- Let CodeDeploy scripts handle docker-compose.yml and containers

## Option 2: Make Userdata Idempotent
**Check if things exist before doing them**

Pros:
- Can run multiple times safely
- Less likely to conflict

Cons:
- More complex logic
- Still potential for timing issues

## Option 3: Remove set -e
**Make userdata more resilient to errors**

Pros:
- Userdata won't fail on minor errors
- CodeDeploy can still deploy even if userdata has issues

Cons:
- Might hide real problems
- Doesn't solve the container conflict

## Option 4: Use Pre-built AMI
**Bake everything into an AMI, minimal userdata**

Pros:
- Fastest instance startup
- No installation delays
- More reliable

Cons:
- Need to maintain AMI
- Updates require new AMI
- More complex CI/CD

## Option 5: Separate Infrastructure from Application
**Userdata = infrastructure, CodeDeploy = application**

Pros:
- Clear separation
- Userdata can finish, then CodeDeploy runs

Cons:
- Still need to coordinate timing
- CodeDeploy must wait for userdata

## Recommendation: Option 1 (Minimal Userdata)

Remove from userdata:
- docker-compose.yml creation (move to CodeDeploy)
- Container startup (move to CodeDeploy)
- ECR login and image pulling (move to CodeDeploy)

Keep in userdata:
- Docker installation
- docker-compose installation
- AWS CLI installation
- CodeDeploy agent installation
- SSM agent installation
- Directory creation (/opt/bianca-staging)
- EBS volume mounting

Move to CodeDeploy scripts:
- docker-compose.yml creation
- ECR login
- Image pulling
- Container management




