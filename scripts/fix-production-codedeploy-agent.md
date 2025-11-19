# Fix CodeDeploy Agent on Production Instance

The production instance was created before CodeDeploy agent was added to userdata. Here's how to fix it:

## Option 1: Use SSM Session Manager (Recommended)

1. Connect to the instance:
```bash
aws ssm start-session --target i-0a2c5b5ad1c61d4c4 --profile jordan --region us-east-2
```

2. Once connected, run:
```bash
cd /tmp
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
sudo systemctl stop codedeploy-agent 2>/dev/null || true
sudo yum remove -y codedeploy-agent 2>/dev/null || true
wget https://aws-codedeploy-${REGION}.s3.${REGION}.amazonaws.com/latest/install -O install
chmod +x ./install
sudo ./install auto
sudo systemctl enable codedeploy-agent
sudo systemctl start codedeploy-agent
sudo systemctl status codedeploy-agent
```

3. Verify it's running:
```bash
sudo systemctl is-active codedeploy-agent
```

## Option 2: Recreate Instance with Updated Userdata

If SSM Session Manager doesn't work, you can update Terraform and recreate the instance:

1. The launch template already has `update_default_version = true`
2. Run `terraform apply` to update the launch template
3. Terminate and recreate the instance (or use `terraform taint` and `apply`)

## Option 3: Use the Fix Script via SSM

If SSM commands work, you can run the fix script:

```bash
cd bianca-app-backend
./devops/scripts/fix-codedeploy-agent.sh
```

But you'll need to upload it to the instance first via SSM or S3.

