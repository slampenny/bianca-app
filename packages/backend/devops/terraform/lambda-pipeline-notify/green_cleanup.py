"""
Terminate orphaned production green EC2 instances when a pipeline fails after CreateGreenInstance
but before SwapAndTerminate completes successfully. Only runs when blue is still running.
"""
import os

import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "ca-central-1")
PRODUCTION_PIPELINE = "bianca-production-pipeline"
BLUE_TAG = "bianca-production"
GREEN_TAG = "bianca-production-green"

ec2 = boto3.client("ec2", region_name=REGION)
codepipeline = boto3.client("codepipeline", region_name=REGION)


def cleanup_orphan_green(pipeline_name, execution_id):
    """Return a short log message describing what was done."""
    if pipeline_name != PRODUCTION_PIPELINE:
        return "skipped: not production pipeline"

    if not execution_id:
        return "skipped: no execution id"

    if _action_succeeded(pipeline_name, execution_id, "SwapAndTerminate", "SwapAndTerminate"):
        return "skipped: swap already succeeded"

    if not _action_succeeded(pipeline_name, execution_id, "CreateGreenInstance", "CreateGreenInstance"):
        return "skipped: create green did not succeed"

    if not _running_instance_by_name(BLUE_TAG):
        return "skipped: no running blue instance (swap may have partially completed)"

    terminated = _terminate_execution_greens(execution_id)
    if terminated:
        return f"terminated green instance(s): {', '.join(terminated)}"
    return "no matching green instances to terminate"


def _action_succeeded(pipeline_name, execution_id, stage_name, action_name):
    try:
        paginator = codepipeline.get_paginator("list_action_executions")
        for page in paginator.paginate(
            pipelineName=pipeline_name,
            filter={"pipelineExecutionId": execution_id},
        ):
            for action in page.get("actionExecutionDetails") or []:
                if action.get("stageName") != stage_name:
                    continue
                if action.get("actionName") != action_name:
                    continue
                return action.get("status") == "Succeeded"
    except ClientError as exc:
        print(f"Could not list action executions: {exc}")
    return False


def _running_instance_by_name(name_tag):
    try:
        resp = ec2.describe_instances(
            Filters=[
                {"Name": "tag:Name", "Values": [name_tag]},
                {"Name": "instance-state-name", "Values": ["running"]},
            ]
        )
        for reservation in resp.get("Reservations") or []:
            for instance in reservation.get("Instances") or []:
                if instance.get("InstanceId"):
                    return instance["InstanceId"]
    except ClientError as exc:
        print(f"Could not describe blue instance: {exc}")
    return None


def _terminate_execution_greens(execution_id):
    to_terminate = []
    try:
        resp = ec2.describe_instances(
            Filters=[
                {"Name": "tag:Name", "Values": [GREEN_TAG]},
                {
                    "Name": "instance-state-name",
                    "Values": ["running", "pending", "stopping", "stopped"],
                },
            ]
        )
        for reservation in resp.get("Reservations") or []:
            for instance in reservation.get("Instances") or []:
                instance_id = instance.get("InstanceId")
                if not instance_id:
                    continue
                tags = {t.get("Key"): t.get("Value") for t in instance.get("Tags") or []}
                if tags.get("PipelineExecutionId") == execution_id:
                    to_terminate.append(instance_id)
    except ClientError as exc:
        print(f"Could not describe green instances: {exc}")
        return []

    if not to_terminate:
        return []

    try:
        ec2.terminate_instances(InstanceIds=to_terminate)
    except ClientError as exc:
        print(f"Failed to terminate green instances: {exc}")
        return []
    return to_terminate
