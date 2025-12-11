#!/usr/bin/env python3
"""
Run seed script on production and staging using AWS SSM
"""
import boto3
import time
import sys

profile = "jordan"
region = "us-east-2"

print("=== Running Seed Script via AWS SSM ===\n")

# Create session with profile
session = boto3.Session(profile_name=profile, region_name=region)
ec2 = session.client('ec2')
ssm = session.client('ssm')

# Find instances
print("Finding instances...")
try:
    prod_response = ec2.describe_instances(
        Filters=[
            {'Name': 'tag:Environment', 'Values': ['production']},
            {'Name': 'tag:Name', 'Values': ['bianca-production']}
        ]
    )
    
    staging_response = ec2.describe_instances(
        Filters=[
            {'Name': 'tag:Environment', 'Values': ['staging']},
            {'Name': 'tag:Name', 'Values': ['bianca-staging']}
        ]
    )
    
    prod_instance = None
    if prod_response['Reservations']:
        prod_instance = prod_response['Reservations'][0]['Instances'][0]['InstanceId']
        print(f"✓ Production instance: {prod_instance}")
    
    staging_instance = None
    if staging_response['Reservations']:
        staging_instance = staging_response['Reservations'][0]['Instances'][0]['InstanceId']
        print(f"✓ Staging instance: {staging_instance}")
    
    if not prod_instance and not staging_instance:
        print("❌ No instances found")
        sys.exit(1)
    
    print()
    
    # Function to run seed via SSM
    def run_seed(instance_id, env_name):
        print(f"=== Running seed script on {env_name} ({instance_id}) ===")
        
        commands = [
            "cd /opt/bianca-app-backend 2>/dev/null || cd /home/ec2-user/bianca-app-backend 2>/dev/null || { echo 'ERROR: Could not find app directory'; exit 1; }",
            f"export NODE_ENV={env_name}",
            f"echo 'Running seed script in {env_name} environment...'",
            "docker exec -i $(docker ps -q --filter 'name=app' | head -1) node src/scripts/seedDatabase.js || { echo 'Failed to run seed script'; exit 1; }",
            f"echo 'Seed script completed successfully on {env_name}'"
        ]
        
        try:
            response = ssm.send_command(
                InstanceIds=[instance_id],
                DocumentName="AWS-RunShellScript",
                Parameters={'commands': commands}
            )
            
            command_id = response['Command']['CommandId']
            print(f"Command ID: {command_id}")
            print("Waiting for command to complete (this may take 1-2 minutes)...")
            
            # Wait for command to complete
            for i in range(60):
                time.sleep(2)
                try:
                    result = ssm.get_command_invocation(
                        CommandId=command_id,
                        InstanceId=instance_id
                    )
                    
                    status = result['Status']
                    
                    if status == 'Success':
                        print(f"\n✓ {env_name} seed script completed successfully!")
                        print("\nOutput:")
                        print(result.get('StandardOutputContent', ''))
                        return True
                    elif status == 'Failed':
                        print(f"\n❌ {env_name} seed script failed!")
                        print("\nError output:")
                        print(result.get('StandardErrorContent', ''))
                        return False
                    elif status in ['InProgress', 'Pending']:
                        print(".", end="", flush=True)
                    else:
                        print(f"\n⚠️  Status: {status}")
                        return False
                except ssm.exceptions.InvocationDoesNotExist:
                    if i < 5:
                        print(".", end="", flush=True)
                        continue
                    else:
                        print("\n⚠️  Command not found yet, waiting...")
                        continue
            
            print("\n⚠️  Command timed out")
            return False
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            return False
    
    # Run seed on both environments
    success = True
    if prod_instance:
        if not run_seed(prod_instance, "production"):
            success = False
        print()
    
    if staging_instance:
        if not run_seed(staging_instance, "staging"):
            success = False
        print()
    
    print("=== Complete ===")
    if success:
        print("Seed scripts have been executed successfully on both environments.")
    else:
        print("Some seed scripts may have failed. Check the output above.")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

