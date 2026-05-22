# staging-schedule.tf
# Cost optimization: Schedule staging instance to run only during business hours
#
# Hourly start/stop is gated by SSM /bianca/staging/hourly-ec2-schedule-enabled (default "false").
# When false, the Lambda no-ops so staging stays under manual control (no automatic starts).

resource "aws_ssm_parameter" "staging_hourly_ec2_schedule_enabled" {
  name        = "/bianca/staging/hourly-ec2-schedule-enabled"
  description = "When 'true', hourly Lambda may start/stop staging EC2. When 'false', invocations no-op (manual control)."
  type        = "String"
  value       = "false"
}

# Lambda function to start/stop instance on schedule
resource "aws_lambda_function" "staging_scheduler" {
  filename         = data.archive_file.staging_scheduler.output_path
  function_name    = "bianca-staging-scheduler"
  role             = aws_iam_role.staging_lambda_role.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  timeout          = 60
  source_code_hash = data.archive_file.staging_scheduler.output_base64sha256

  environment {
    variables = {
      INSTANCE_ID = aws_instance.staging.id
    }
  }

  depends_on = [
    aws_iam_role_policy.staging_lambda_policy,
    data.archive_file.staging_scheduler
  ]
}

data "archive_file" "staging_scheduler" {
  type        = "zip"
  output_path = "staging-scheduler.zip"

  source {
    content  = <<EOF
import boto3
import os
from datetime import datetime
from botocore.exceptions import ClientError

SSM_NAME = "/bianca/staging/hourly-ec2-schedule-enabled"

def _hourly_schedule_enabled():
    ssm = boto3.client("ssm")
    try:
        r = ssm.get_parameter(Name=SSM_NAME)
        v = (r.get("Parameter") or {}).get("Value", "").strip().lower()
        return v in ("true", "1", "yes", "enabled")
    except ClientError as e:
        code = (e.response.get("Error") or {}).get("Code", "")
        if code == "ParameterNotFound":
            # Legacy stacks without the parameter: preserve old hourly behavior
            return True
        print(f"[staging-scheduler] SSM read error ({e}); defaulting to disabled")
        return False
    except Exception as e:
        print(f"[staging-scheduler] SSM read error ({e}); defaulting to disabled")
        return False

def handler(event, context):
    if not _hourly_schedule_enabled():
        print("[staging-scheduler] hourly EC2 schedule disabled via SSM; no-op")
        return {"statusCode": 200, "body": "hourly schedule disabled (SSM)"}

    ec2 = boto3.client('ec2')
    instance_id = os.environ['INSTANCE_ID']
    
    # Get current time in UTC
    now = datetime.utcnow()
    hour = now.hour
    
    # Business hours: 6 AM - 10 PM UTC (adjust as needed)
    # This covers most US time zones during business hours
    if 6 <= hour <= 22:
        # Start instance if stopped
        response = ec2.describe_instances(InstanceIds=[instance_id])
        state = response['Reservations'][0]['Instances'][0]['State']['Name']
        
        if state == 'stopped':
            print(f"Starting staging instance {instance_id} for business hours")
            ec2.start_instances(InstanceIds=[instance_id])
            return {'statusCode': 200, 'body': 'Instance started'}
        else:
            return {'statusCode': 200, 'body': 'Instance already running'}
    else:
        # Stop instance if running (outside business hours)
        response = ec2.describe_instances(InstanceIds=[instance_id])
        state = response['Reservations'][0]['Instances'][0]['State']['Name']
        
        if state == 'running':
            print(f"Stopping staging instance {instance_id} outside business hours")
            ec2.stop_instances(InstanceIds=[instance_id])
            return {'statusCode': 200, 'body': 'Instance stopped'}
        else:
            return {'statusCode': 200, 'body': 'Instance already stopped'}
EOF
    filename = "index.py"
  }
}

# CloudWatch Event to run every hour
resource "aws_cloudwatch_event_rule" "staging_scheduler" {
  name                = "staging-scheduler-check"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "staging_scheduler" {
  rule      = aws_cloudwatch_event_rule.staging_scheduler.name
  target_id = "StagingSchedulerLambda"
  arn       = aws_lambda_function.staging_scheduler.arn
}

resource "aws_lambda_permission" "staging_scheduler" {
  statement_id  = "AllowCloudWatchInvokeScheduler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.staging_scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.staging_scheduler.arn
}
