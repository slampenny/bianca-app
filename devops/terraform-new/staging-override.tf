# staging-override.tf
# Manual override to keep staging always available when needed

# SSM Parameter to control staging mode
resource "aws_ssm_parameter" "staging_always_on" {
  name  = "/bianca/staging/always-on"
  type  = "String"
  value = "false"  # Set to "true" to keep staging always running
  
  tags = {
    Environment = "staging"
    Purpose     = "Control staging instance scheduling"
  }
}

# Updated Lambda function that respects the override
resource "aws_lambda_function" "staging_scheduler_v2" {
  filename      = "staging-scheduler-v2.zip"
  function_name = "bianca-staging-scheduler-v2"
  role          = aws_iam_role.staging_lambda_role.arn
  handler       = "index.handler"
  runtime       = "python3.12"
  timeout       = 60

  environment {
    variables = {
      INSTANCE_ID = aws_instance.staging.id
      SSM_PARAMETER = aws_ssm_parameter.staging_always_on.name
    }
  }

  depends_on = [
    aws_iam_role_policy.staging_lambda_policy,
    data.archive_file.staging_scheduler_v2
  ]
}

# Add SSM permissions to the Lambda role
resource "aws_iam_role_policy" "staging_lambda_ssm_policy" {
  name = "bianca-staging-lambda-ssm-policy"
  role = aws_iam_role.staging_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = aws_ssm_parameter.staging_always_on.arn
      }
    ]
  })
}

data "archive_file" "staging_scheduler_v2" {
  type        = "zip"
  output_path = "staging-scheduler-v2.zip"
  
  source {
    content  = <<EOF
import boto3
import os
from datetime import datetime

def handler(event, context):
    ec2 = boto3.client('ec2')
    ssm = boto3.client('ssm')
    
    instance_id = os.environ['INSTANCE_ID']
    ssm_parameter = os.environ['SSM_PARAMETER']
    
    # Check if always-on override is enabled
    try:
        response = ssm.get_parameter(Name=ssm_parameter)
        always_on = response['Parameter']['Value'].lower() == 'true'
        
        if always_on:
            print("Always-on mode enabled - ensuring instance is running")
            response = ec2.describe_instances(InstanceIds=[instance_id])
            state = response['Reservations'][0]['Instances'][0]['State']['Name']
            
            if state == 'stopped':
                ec2.start_instances(InstanceIds=[instance_id])
                return {'statusCode': 200, 'body': 'Instance started (always-on mode)'}
            else:
                return {'statusCode': 200, 'body': 'Instance already running (always-on mode)'}
    except Exception as e:
        print(f"Error checking always-on parameter: {e}")
        # Fall back to normal scheduling if parameter doesn't exist
    
    # Normal business hours scheduling
    now = datetime.utcnow()
    hour = now.hour
    
    # Business hours: 6 AM - 10 PM UTC
    if 6 <= hour <= 22:
        response = ec2.describe_instances(InstanceIds=[instance_id])
        state = response['Reservations'][0]['Instances'][0]['State']['Name']
        
        if state == 'stopped':
            print(f"Starting staging instance {instance_id} for business hours")
            ec2.start_instances(InstanceIds=[instance_id])
            return {'statusCode': 200, 'body': 'Instance started'}
        else:
            return {'statusCode': 200, 'body': 'Instance already running'}
    else:
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
resource "aws_cloudwatch_event_rule" "staging_scheduler_v2" {
  name                = "staging-scheduler-v2-check"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "staging_scheduler_v2" {
  rule      = aws_cloudwatch_event_rule.staging_scheduler_v2.name
  target_id = "StagingSchedulerV2Lambda"
  arn       = aws_lambda_function.staging_scheduler_v2.arn
}

resource "aws_lambda_permission" "staging_scheduler_v2" {
  statement_id  = "AllowCloudWatchInvokeSchedulerV2"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.staging_scheduler_v2.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.staging_scheduler_v2.arn
}
