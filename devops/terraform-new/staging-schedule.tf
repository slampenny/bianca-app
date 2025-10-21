# staging-schedule.tf
# Cost optimization: Schedule staging instance to run only during business hours

# Lambda function to start/stop instance on schedule
resource "aws_lambda_function" "staging_scheduler" {
  filename      = "staging-scheduler.zip"
  function_name = "bianca-staging-scheduler"
  role          = aws_iam_role.staging_lambda_role.arn
  handler       = "index.handler"
  runtime       = "python3.9"
  timeout       = 60

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

def handler(event, context):
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
