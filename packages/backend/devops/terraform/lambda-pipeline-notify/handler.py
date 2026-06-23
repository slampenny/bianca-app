"""
Post-pipeline email via SNS when production CodePipeline finishes.
Triggered by CodePipeline Pipeline Execution State Change (SUCCEEDED / FAILED).
"""
import os
from urllib.parse import quote

import boto3
from botocore.exceptions import ClientError

sns = boto3.client("sns")
codepipeline = boto3.client("codepipeline")
codebuild = boto3.client("codebuild")

PIPELINE_ENV = {
    "bianca-production-pipeline": "production",
}

REGION = os.environ.get("AWS_REGION", "ca-central-1")
ACCOUNT_ID = os.environ.get("AWS_ACCOUNT_ID", "")


def handler(event, context):
    detail = event.get("detail") or {}
    state = detail.get("state")
    pipeline = detail.get("pipeline")
    execution_id = detail.get("execution-id")

    if state not in ("SUCCEEDED", "FAILED") or not pipeline or not execution_id:
        print(f"Ignoring event: state={state!r} pipeline={pipeline!r}")
        return {"statusCode": 200, "body": "ignored"}

    env = PIPELINE_ENV.get(pipeline, "unknown")
    subject = "build successful" if state == "SUCCEEDED" else "build failed"

    lines = [
        f"Pipeline: {pipeline}",
        f"Environment: {env}",
        f"Execution ID: {execution_id}",
        f"State: {state}",
        f"Console: https://{REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/{quote(pipeline, safe='')}/executions/{quote(execution_id, safe='')}/timeline?region={REGION}",
    ]

    if state == "FAILED":
        lines.append("")
        lines.append("Failure details:")
        for line in _failure_details(pipeline, execution_id):
            lines.append(line)

    message = "\n".join(lines)
    topic_arn = os.environ["SNS_TOPIC_ARN"]

    sns.publish(
        TopicArn=topic_arn,
        Subject=subject[:100],
        Message=message[:256000],
    )
    print(f"Sent SNS notification: subject={subject!r} pipeline={pipeline!r}")
    return {"statusCode": 200, "body": "sent"}


def _failure_details(pipeline_name, execution_id):
    out = []
    try:
        paginator = codepipeline.get_paginator("list_action_executions")
        for page in paginator.paginate(
            pipelineName=pipeline_name,
            filter={"pipelineExecutionId": execution_id},
        ):
            for action in page.get("actionExecutionDetails") or []:
                if action.get("status") != "Failed":
                    continue
                stage = action.get("stageName", "?")
                name = action.get("actionName", "?")
                out.append(f"- Stage {stage} / action {name} failed")

                result = (action.get("output") or {}).get("executionResult") or {}
                summary = result.get("externalExecutionSummary")
                if summary:
                    out.append(f"  Summary: {summary}")

                err = result.get("errorDetails") or {}
                err_msg = err.get("message")
                if err_msg:
                    out.append(f"  Error: {err_msg}")

                ext_id = result.get("externalExecutionId")
                if ext_id:
                    out.extend(_codebuild_failure_lines(ext_id))
    except ClientError as e:
        out.append(f"- Could not load action executions: {e}")
    except Exception as e:
        out.append(f"- Unexpected error loading failures: {e}")

    if not out:
        out.append("- Pipeline failed but no failed action details were returned yet.")
    return out


def _codebuild_failure_lines(build_id):
    lines = []
    try:
        resp = codebuild.batch_get_builds(ids=[build_id])
        builds = resp.get("builds") or []
        if not builds:
            lines.append(f"  CodeBuild: no build found for {build_id}")
            return lines

        build = builds[0]
        project = build.get("projectName", "?")
        status = build.get("buildStatus", "?")
        reason = build.get("statusReason")
        lines.append(f"  CodeBuild project: {project} (status: {status})")
        if reason:
            lines.append(f"  CodeBuild reason: {reason}")

        for phase in build.get("phases") or []:
            if phase.get("phaseStatus") != "FAILED":
                continue
            phase_type = phase.get("phaseType", "?")
            lines.append(f"  Failed phase: {phase_type}")
            for ctx in phase.get("contexts") or []:
                msg = ctx.get("message")
                if msg:
                    lines.append(f"    {msg}")

        logs_info = build.get("logs") or {}
        group = logs_info.get("groupName")
        stream = logs_info.get("streamName")
        if group and stream:
            enc_group = quote(group, safe="")
            enc_stream = quote(stream, safe="")
            lines.append(
                f"  Logs: https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#logsV2:log-groups/log-group/{enc_group}/log-events/{enc_stream}"
            )
        elif ACCOUNT_ID:
            lines.append(
                f"  Build: https://{REGION}.console.aws.amazon.com/codesuite/codebuild/projects/{quote(project, safe='')}/build/{quote(build_id.split(':')[-1], safe='')}?region={REGION}"
            )
    except ClientError as e:
        lines.append(f"  CodeBuild lookup failed: {e}")
    return lines
