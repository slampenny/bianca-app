// src/services/s3.service.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require('../config/config'); // Your main config file
const logger = require('../config/logger');

const s3ClientsByRegion = new Map();

function resolveStorage(jurisdiction) {
    const storage = config.getStorageRegion(jurisdiction);

    if (
        jurisdiction === 'GDPR' &&
        config.residency.mode !== 'US' &&
        !storage.bucketName
    ) {
        const msg =
            '[S3 Service] EU S3 bucket is not configured (EU_S3_BUCKET). ' +
            'GDPR-regulated data cannot be stored in the US bucket. ' +
            'Provision an EU bucket and set EU_S3_BUCKET before processing GDPR data, ' +
            'or set DATA_RESIDENCY_MODE=US only if legally permitted.';
        logger.error(msg);
        throw new Error(msg);
    }

    if (!storage.bucketName) {
        const bucketErrorMsg =
            '[S3 Service] S3 bucket name is not configured for the selected storage region.';
        logger.error(bucketErrorMsg);
        throw new Error(bucketErrorMsg);
    }

    return storage;
}

function getS3Client(region) {
    const targetRegion = region || config.aws.region;

    if (!s3ClientsByRegion.has(targetRegion)) {
        try {
            let s3ConfigOptions = {
                region: targetRegion,
            };

            if (config.aws.accessKeyId && config.aws.secretAccessKey) {
                s3ConfigOptions.credentials = {
                    accessKeyId: config.aws.accessKeyId,
                    secretAccessKey: config.aws.secretAccessKey,
                };
                logger.info(`[S3 Service] Initializing S3 client for ${targetRegion} WITH credentials from config file.`);
            } else {
                logger.info(`[S3 Service] Initializing S3 client for ${targetRegion} WITHOUT explicit credentials from config (will use default provider chain: IAM role, env vars, shared file).`);
            }

            s3ClientsByRegion.set(targetRegion, new S3Client(s3ConfigOptions));
            logger.info(`[S3 Service] S3 client initialized for region: ${targetRegion}`);
        } catch (error) {
            logger.error(`[S3 Service] CRITICAL: Failed to initialize S3 client for ${targetRegion}: ${error.message}`, error);
            s3ClientsByRegion.set(targetRegion, null);
        }
    }

    return s3ClientsByRegion.get(targetRegion);
}


/**
 * Uploads a file to S3.
 * @param {Buffer} fileContent - The file content as a Buffer.
 * @param {string} key - The S3 key (path/filename.ext) for the uploaded file.
 * @param {string} contentType - The MIME type of the file (e.g., 'audio/wav', 'application/octet-stream').
 * @param {object} [metadata={}] - Optional metadata to store with the S3 object.
 * @param {string} [jurisdiction] - Data jurisdiction (e.g. 'GDPR') for residency-aware bucket selection.
 * @returns {Promise<import('@aws-sdk/client-s3').PutObjectCommandOutput>} The S3 PutObjectCommand output.
 */
async function uploadFile(fileContent, key, contentType, metadata = {}, jurisdiction = null) {
    const { region, bucketName } = resolveStorage(jurisdiction);
    const s3Client = getS3Client(region);
    if (!s3Client) {
        const initErrorMsg = '[S3 Service] S3 client not initialized. Cannot upload file.';
        logger.error(initErrorMsg);
        throw new Error(initErrorMsg);
    }

    const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
        Metadata: metadata,
    };

    try {
        logger.info(`[S3 Service] Uploading to S3 -> Bucket: ${params.Bucket}, Region: ${region}, Key: ${params.Key}, Size: ${fileContent.length} bytes, ContentType: ${params.ContentType}`);
        const command = new PutObjectCommand(params);
        const data = await s3Client.send(command);
        logger.info(`[S3 Service] Successfully uploaded ${key} to ${params.Bucket}. ETag: ${data.ETag}`);
        return data;
    } catch (err) {
        logger.error(`[S3 Service] Error uploading to S3 (Bucket: ${params.Bucket}, Key: ${key}): ${err.name} - ${err.message}`, { errorDetails: err });
        throw err;
    }
}

/**
 * Gets a presigned URL for an S3 object.
 * @param {string} key - The S3 key (path/filename.ext).
 * @param {number} [expiresIn=3600] - URL expiration time in seconds (default 1 hour).
 * @param {string} [jurisdiction] - Data jurisdiction (e.g. 'GDPR') for residency-aware bucket selection.
 * @returns {Promise<string>} The presigned URL.
 */
async function getPresignedUrl(key, expiresIn = 3600, jurisdiction = null) {
    const { region, bucketName } = resolveStorage(jurisdiction);
    const s3Client = getS3Client(region);
    if (!s3Client) {
        const initErrorMsg = '[S3 Service] S3 client not initialized. Cannot get presigned URL.';
        logger.error(initErrorMsg);
        throw new Error(initErrorMsg);
    }

    const params = {
        Bucket: bucketName,
        Key: key,
    };

    try {
        logger.info(`[S3 Service] Generating presigned URL for S3 -> Bucket: ${params.Bucket}, Region: ${region}, Key: ${params.Key}`);
        const command = new GetObjectCommand(params);
        const url = await getSignedUrl(s3Client, command, { expiresIn });
        logger.info(`[S3 Service] Successfully generated presigned URL for ${key}`);
        return url;
    } catch (err) {
        logger.error(`[S3 Service] Error generating presigned URL (Bucket: ${params.Bucket}, Key: ${key}): ${err.name} - ${err.message}`, { errorDetails: err });
        throw err;
    }
}

/**
 * Deletes an object from S3.
 * @param {string} key - The S3 key to delete.
 * @param {string} [bucketNameParam=null] - Optional bucket name.
 * @returns {Promise<void>}
 */
async function deleteFile(key, bucketNameParam = null) {
    const s3Client = getS3Client();
    if (!s3Client) {
        const initErrorMsg = '[S3 Service] S3 client not initialized. Cannot delete file.';
        logger.error(initErrorMsg);
        throw new Error(initErrorMsg);
    }

    const bucketToUse = bucketNameParam || config.aws.s3.bucketName;
    if (!bucketToUse) {
        const bucketErrorMsg = '[S3 Service] S3 bucket name is not configured. Cannot delete file.';
        logger.error(bucketErrorMsg);
        throw new Error(bucketErrorMsg);
    }

    try {
        logger.info(`[S3 Service] Deleting from S3 -> Bucket: ${bucketToUse}, Key: ${key}`);
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucketToUse, Key: key }));
        logger.info(`[S3 Service] Successfully deleted ${key} from ${bucketToUse}`);
    } catch (err) {
        logger.error(`[S3 Service] Error deleting from S3 (Bucket: ${bucketToUse}, Key: ${key}): ${err.name} - ${err.message}`, { errorDetails: err });
        throw err;
    }
}

module.exports = {
    uploadFile,
    getPresignedUrl,
    deleteFile,
};
