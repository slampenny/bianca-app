/**
 * HIPAA Backup Restore Lambda — orchestrates EC2 restore via SSM Run Command.
 */

const { SSMClient, SendCommandCommand, ListCommandInvocationsCommand, GetCommandInvocationCommand } = require('@aws-sdk/client-ssm');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const region = process.env.AWS_REGION || 'ca-central-1';
const ssmClient = new SSMClient({ region });
const s3Client = new S3Client({ region });
const snsClient = new SNSClient({ region });

const POLL_MS = 5000;
const MAX_WAIT_MS = 840000;

exports.handler = async (event) => {
  if (event.CONFIRM_RESTORE !== 'YES_I_WANT_TO_RESTORE') {
    throw new Error('Restore not confirmed. Set CONFIRM_RESTORE=YES_I_WANT_TO_RESTORE in event payload.');
  }

  const backupKey = event.backupKey;
  if (!backupKey) {
    throw new Error('backupKey is required in event payload');
  }

  const env = process.env.ENVIRONMENT;
  const tagName = process.env.EC2_TARGET_TAG_NAME || `bianca-${env}`;
  const scriptPath = `/opt/bianca-${env}/hipaa-restore.sh`;

  console.log(`⚠️  STARTING RESTORE via SSM on tag:Name=${tagName}`);
  console.log(`Backup: ${backupKey}`);

  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: backupKey,
    }));

    const sendResp = await ssmClient.send(new SendCommandCommand({
      DocumentName: 'AWS-RunShellScript',
      Targets: [{ Key: 'tag:Name', Values: [tagName] }],
      Parameters: {
        commands: [`export ENVIRONMENT=${env} AWS_REGION=${region}`, `${scriptPath} "${backupKey}" YES_I_WANT_TO_RESTORE`],
      },
      TimeoutSeconds: 600,
      Comment: `HIPAA MongoDB restore (${env}) from ${backupKey}`,
    }));

    const commandId = sendResp.Command?.CommandId;
    if (!commandId) {
      throw new Error('SSM SendCommand did not return a command ID');
    }

    const invocation = await waitForSsmCommand(commandId);
    if (invocation.Status !== 'Success') {
      throw new Error(
        `SSM restore command ${invocation.Status}: ${invocation.StandardErrorContent || invocation.StatusDetails || 'unknown error'}`,
      );
    }

    await sendNotification({
      subject: `✅ Database Restore COMPLETED - ${env}`,
      message: [
        'DATABASE RESTORE COMPLETED',
        '',
        `Backup Restored: ${backupKey}`,
        `Timestamp: ${new Date().toISOString()}`,
        `Environment: ${env}`,
        '',
        'Test application functionality immediately.',
      ].join('\n'),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        backupRestored: backupKey,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('❌ Restore failed:', error);

    await sendNotification({
      subject: `❌ Database Restore FAILED - ${env}`,
      message: [
        'DATABASE RESTORE FAILURE!',
        '',
        `Backup: ${backupKey}`,
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
      return ssmClient.send(new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: failed.InstanceId,
      }));
    }

    return ssmClient.send(new GetCommandInvocationCommand({
      CommandId: commandId,
      InstanceId: invocations[0].InstanceId,
    }));
  }

  throw new Error('SSM command timed out waiting for completion');
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
