// src/services/s3.service.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require('../config/config'); // Your main config file
const logger = require('../config/logger');

let s3ClientInstance;

function getS3Client() {
    if (!s3ClientInstance) {
        try {
            let s3ConfigOptions = {
                region: config.aws.region, // From your config.js: baselineConfig.aws.region
            };

            // Prefer IAM roles or env variables for credentials.
            // Only use credentials from config if explicitly provided AND no IAM/env creds are likely available.
            if (config.aws.accessKeyId && config.aws.secretAccessKey) {
                s3ConfigOptions.credentials = {
                    accessKeyId: config.aws.accessKeyId,
                    secretAccessKey: config.aws.secretAccessKey,
                };
                logger.info('[S3 Service] Initializing S3 client WITH credentials from config file.');
            } else {
                logger.info('[S3 Service] Initializing S3 client WITHOUT explicit credentials from config (will use default provider chain: IAM role, env vars, shared file).');
            }
            
            s3ClientInstance = new S3Client(s3ConfigOptions);
            logger.info(`[S3 Service] S3 client initialized for region: ${config.aws.region}`);

        } catch (error) {
            logger.error(`[S3 Service] CRITICAL: Failed to initialize S3 client: ${error.message}`, error);
            // Depending on how critical S3 is, you might re-throw or have a fallback
            // For now, operations will fail if the client isn't initialized.
            s3ClientInstance = null; // Ensure it's null if init fails
        }
    }
    return s3ClientInstance;
}


/**
 * Uploads a file to S3.
 * @param {Buffer} fileContent - The file content as a Buffer.
 * @param {string} key - The S3 key (path/filename.ext) for the uploaded file.
 * @param {string} contentType - The MIME type of the file (e.g., 'audio/wav', 'application/octet-stream').
 * @param {object} [metadata={}] - Optional metadata to store with the S3 object.
 * @param {string} [bucketNameParam=null] - Optional bucket name. If null, uses bucket from config.
 * @returns {Promise<import('@aws-sdk/client-s3').PutObjectCommandOutput>} The S3 PutObjectCommand output.
 */
async function uploadFile(fileContent, key, contentType, metadata = {}, bucketNameParam = null) {
    const s3Client = getS3Client();
    if (!s3Client) {
        const initErrorMsg = '[S3 Service] S3 client not initialized. Cannot upload file.';
        logger.error(initErrorMsg);
        throw new Error(initErrorMsg);
    }

    const bucketToUse = bucketNameParam || config.aws.s3.bucketName; // Use bucket from config

    if (!bucketToUse) {
        const bucketErrorMsg = '[S3 Service] S3 bucket name is not configured or provided. Cannot upload file.';
        logger.error(bucketErrorMsg);
        throw new Error(bucketErrorMsg);
    }

    const params = {
        Bucket: bucketToUse,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
        Metadata: metadata,
    };

    try {
        logger.info(`[S3 Service] Uploading to S3 -> Bucket: ${params.Bucket}, Key: ${params.Key}, Size: ${fileContent.length} bytes, ContentType: ${params.ContentType}`);
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
 * @param {string} [bucketNameParam=null] - Optional bucket name. If null, uses bucket from config.
 * @returns {Promise<string>} The presigned URL.
 */
async function getPresignedUrl(key, expiresIn = 3600, bucketNameParam = null) {
    const s3Client = getS3Client();
    if (!s3Client) {
        const initErrorMsg = '[S3 Service] S3 client not initialized. Cannot get presigned URL.';
        logger.error(initErrorMsg);
        throw new Error(initErrorMsg);
    }
    
    const bucketToUse = bucketNameParam || config.aws.s3.bucketName; // Use bucket from config

    if (!bucketToUse) {
        const bucketErrorMsg = '[S3 Service] S3 bucket name is not configured or provided. Cannot get presigned URL.';
        logger.error(bucketErrorMsg);
        throw new Error(bucketErrorMsg);
    }

    const params = {
        Bucket: bucketToUse,
        Key: key,
    };

    try {
        logger.info(`[S3 Service] Generating presigned URL for S3 -> Bucket: ${params.Bucket}, Key: ${params.Key}`);
        const command = new GetObjectCommand(params);
        const url = await getSignedUrl(s3Client, command, { expiresIn });
        logger.info(`[S3 Service] Successfully generated presigned URL for ${key}`);
        return url;
    } catch (err) {
        logger.error(`[S3 Service] Error generating presigned URL (Bucket: ${params.Bucket}, Key: ${key}): ${err.name} - ${err.message}`, { errorDetails: err });
        throw err;
    }
}

module.exports = {
    uploadFile,
    getPresignedUrl,
};