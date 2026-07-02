import { S3Client, ListObjectsV2Command, CopyObjectCommand } from "@aws-sdk/client-s3";
import config from "../config";
import logger from "../loaders/logger";

const s3ClientConfig: any = {
  region: "us-east-1", // default region
};

if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
  s3ClientConfig.credentials = {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  };
}

if (config.S3_ENDPOINT) {
  s3ClientConfig.endpoint = config.S3_ENDPOINT;
  s3ClientConfig.forcePathStyle = true; // standard for localstack / minio
}

export const s3Client = new S3Client(s3ClientConfig);

export async function copyS3Folder(
  sourcePrefix: string,
  destinationPrefix: string,
  continuationToken?: string
): Promise<void> {
  const bucket = config.S3_BUCKET;
  if (!bucket) {
    logger.warn("S3_BUCKET environment variable is not configured.");
    return;
  }

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: sourcePrefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(listCommand);
    const contents = response.Contents || [];
    if (contents.length === 0) {
      logger.info(`No contents found under S3 prefix: ${sourcePrefix}`);
      return;
    }

    // Copy concurrently
    await Promise.all(
      contents.map(async (obj) => {
        const key = obj.Key;
        if (!key) return;

        const destinationKey = key.replace(sourcePrefix, destinationPrefix);
        const copySource = encodeURIComponent(`${bucket}/${key}`);

        logger.info(`Copying S3 Object: ${key} -> ${destinationKey}...`);
        const copyCommand = new CopyObjectCommand({
          Bucket: bucket,
          CopySource: copySource,
          Key: destinationKey,
        });

        await s3Client.send(copyCommand);
        logger.info(`Successfully copied S3 Object to: ${destinationKey}`);
      })
    );

    if (response.IsTruncated && response.NextContinuationToken) {
      await copyS3Folder(sourcePrefix, destinationPrefix, response.NextContinuationToken);
    }
  } catch (error) {
    logger.error("Error copying folder from S3:", error);
    throw error;
  }
}
