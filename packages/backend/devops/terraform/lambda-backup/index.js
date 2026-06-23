/**
 * HIPAA MongoDB Backup Lambda — orchestrates EC2 backup via SSM Run Command.
 * mongodump runs on the instance (Docker); Lambda verifies S3 upload and notifies.
 */

const { SSMClient, SendCommandCommand, ListCommandInvocationsCommand, GetCommandInvocationCommand } = require('@aws-sdk/client-ssm');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const region = process.env.AWS_REGION || 'ca-central-1';
const ssmClient = new SSMClient({ region });
const s3Client = new S3Client({ region });
const snsClient = new SNSClient({ region });

const POLL_MS = 5000;
const MAX_WAIT_MS = 840000; // 14 min (Lambda timeout is 15)

exports.handler = async (event) => {
  const backupType = event.backupType || 'daily';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `backup-${timestamp}`;
  const env = process.env.ENVIRONMENT;
  const tagName = process.env.EC2_TARGET_TAG_NAME || `bianca-${env}`;
  const scriptPath = `/opt/bianca-${env}/hipaa-backup.sh`;

  console.log(`Starting ${backupType} backup via SSM on tag:Name=${tagName}`);

  try {
    const sendResp = await ssmClient.send(new SendCommandCommand({
      DocumentName: 'AWS-RunShellScript',
      Targets: [{ Key: 'tag:Name', Values: [tagName] }],
      Parameters: {
        commands: [
          `export ENVIRONMENT=${env} AWS_REGION=${region} HIPAA_BACKUP_BUCKET=${process.env.S3_BUCKET}`,
          `${scriptPath} ${backupType}`,
        ],
      },
      TimeoutSeconds: 600,
      Comment: `HIPAA ${backupType} MongoDB backup (${env})`,
    }));

    const commandId = sendResp.Command?.CommandId;
    if (!commandId) {
      throw new Error('SSM SendCommand did not return a command ID');
    }

    const invocation = await waitForSsmCommand(commandId);
    if (invocation.Status !== 'Success') {
      throw new Error(
        `SSM backup command ${invocation.Status}: ${invocation.StandardErrorContent || invocation.StatusDetails || 'unknown error'}`,
      );
    }

    const s3Key = await findLatestBackupKey(backupType);
    const head = await s3Client.send(new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
    }));

    const fileSizeBytes = head.ContentLength || 0;
    const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);

    await sendNotification({
      subject: `✅ ${backupType.toUpperCase()} Backup Successful - ${env}`,
      message: [
        'Backup completed successfully!',
        '',
        `Backup ID: ${backupId}`,
        `Type: ${backupType}`,
        `Size: ${fileSizeMB} MB`,
        `S3 Location: s3://${process.env.S3_BUCKET}/${s3Key}`,
        `Timestamp: ${new Date().toISOString()}`,
        `Environment: ${env}`,
      ].join('\n'),
    });

    console.log(`✅ Backup completed: s3://${process.env.S3_BUCKET}/${s3Key}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        backupId,
        backupType,
        sizeMB: fileSizeMB,
        s3Key,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('❌ Backup failed:', error);

    await sendNotification({
      subject: `❌ ${backupType.toUpperCase()} Backup FAILED - ${env}`,
      message: [
        'BACKUP FAILURE ALERT!',
        '',
        `Backup ID: ${backupId}`,
        `Type: ${backupType}`,
        `Error: ${error.message}`,
        `Timestamp: ${new Date().toISOString()}`,
        `Environment: ${env}`,
      ].join('\n'),
    }).catch((notifyErr) => console.error('Failed to send SNS notification:', notifyErr));

    throw error;
  }
};

async function waitForSsmCommand(commandId) {
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT_MS) {
    const list = await ssmClient.send(new ListCommandInvocationsCommand({
      CommandId: commandId,
      Details: true,
    }));

    const invocations = list.CommandInvocations || [];
    if (invocations.length === 0) {
      await sleep(POLL_MS);
      continue;
    }

    const pending = invocations.filter((i) => ['Pending', 'InProgress', 'Delayed'].includes(i.Status));
    if (pending.length > 0) {
      await sleep(POLL_MS);
      continue;
    }

    const failed = invocations.find((i) => i.Status !== 'Success');
    if (failed) {
      const detail = await ssmClient.send(new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: failed.InstanceId,
      }));
      return detail;
    }

    return ssmClient.send(new GetCommandInvocationCommand({
      CommandId: commandId,
      InstanceId: invocations[0].InstanceId,
    }));
  }

  throw new Error('SSM command timed out waiting for completion');
}

async function findLatestBackupKey(backupType) {
  const prefix = `${backupType}/backup-`;
  const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const resp = await s3Client.send(new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET,
    Prefix: prefix,
  }));

  const objects = (resp.Contents || []).filter((o) => o.Key && o.Key.endsWith('.gz'));
  if (objects.length === 0) {
    throw new Error(`No backup found in s3://${process.env.S3_BUCKET}/${prefix}`);
  }

  objects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  return objects[0].Key;
}

async function sendNotification({ subject, message }) {
  if (!process.env.SNS_TOPIC_ARN) return;
  await snsClient.send(new PublishCommand({
    TopicArn: process.env.SNS_TOPIC_ARN,
    Subject: subject,
    Message: message,
  }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
