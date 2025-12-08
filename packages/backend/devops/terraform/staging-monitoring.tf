# staging-monitoring.tf
# Cost monitoring and alerts for staging environment

# SNS Topic for cost alerts
resource "aws_sns_topic" "staging_cost_alerts" {
  name = "bianca-staging-cost-alerts"

  tags = {
    Environment = "staging"
    Purpose     = "Cost monitoring alerts"
  }
}

# CloudWatch Alarm for high CPU usage (indicates instance should be stopped)
resource "aws_cloudwatch_metric_alarm" "staging_high_cpu" {
  alarm_name          = "staging-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors staging instance CPU utilization"
  alarm_actions       = [aws_sns_topic.staging_cost_alerts.arn]

  dimensions = {
    InstanceId = aws_instance.staging.id
  }

  tags = {
    Environment = "staging"
  }
}

# CloudWatch Alarm for low network activity (indicates instance might be idle)
resource "aws_cloudwatch_metric_alarm" "staging_low_network" {
  alarm_name          = "staging-low-network"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "NetworkIn"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1000000" # 1MB in 5 minutes
  alarm_description   = "This metric monitors staging instance network activity"
  alarm_actions       = [aws_sns_topic.staging_cost_alerts.arn]

  dimensions = {
    InstanceId = aws_instance.staging.id
  }

  tags = {
    Environment = "staging"
  }
}

# CloudWatch Dashboard for staging costs
# Use lifecycle ignore_changes to prevent drift when instance ID changes
resource "aws_cloudwatch_dashboard" "staging_costs" {
  dashboard_name = "Bianca-Staging-Costs"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.staging.id],
            [".", "NetworkIn", ".", "."],
            [".", "NetworkOut", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-2"
          title   = "Staging Instance Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/EC2", "StatusCheckFailed", "InstanceId", aws_instance.staging.id]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-2"
          title   = "Staging Instance Health"
          period  = 300
        }
      }
    ]
  })

  # Ignore changes to dashboard_body when instance ID changes (prevents unnecessary updates)
  lifecycle {
    ignore_changes = [dashboard_body]
  }
}
