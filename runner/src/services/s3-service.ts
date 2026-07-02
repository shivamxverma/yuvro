import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import config from "../config";

const s3ClientConfig: any = {
  region: "us-east-1",
};

if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
  s3ClientConfig.credentials = {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  };
}

if (config.S3_ENDPOINT) {
  s3ClientConfig.endpoint = config.S3_ENDPOINT;
  s3ClientConfig.forcePathStyle = true;
}

export const s3Client = new S3Client(s3ClientConfig);

export async function saveToS3(key: string, filePath: string, content: string): Promise<void> {
  const s3Key = filePath.startsWith("/") ? `${key}${filePath}` : `${key}/${filePath}`;
  const bucket = config.S3_BUCKET;
  if (!bucket) {
    console.error("[S3] Bucket is not configured.");
    return;
  }

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: Buffer.from(content, "utf-8"),
      })
    );
    console.log(`Successfully backed up ${filePath} to S3 Key: ${s3Key}`);
  } catch (error: any) {
    console.error(`[Error] Failed to save ${filePath} to S3: ${error.message || error}`);
  }
}

export async function downloadFromS3(key: string, localDir: string): Promise<void> {
  const bucket = config.S3_BUCKET;
  if (!bucket) {
    console.error("[Error] S3_BUCKET is not configured.");
    return;
  }

  try {
    // 1. Clean local directory (ignoring .venv)
    if (fs.existsSync(localDir)) {
      const list = fs.readdirSync(localDir);
      for (const filename of list) {
        if (filename === ".venv") continue;
        const fileLoc = path.join(localDir, filename);
        fs.rmSync(fileLoc, { recursive: true, force: true });
      }
    } else {
      fs.mkdirSync(localDir, { recursive: true });
    }

    // 2. Download files
    let continuationToken: string | undefined;
    do {
      const listCommand: any = {
        Bucket: bucket,
        Prefix: key,
      };
      if (continuationToken) {
        listCommand.ContinuationToken = continuationToken;
      }

      const response = await s3Client.send(new ListObjectsV2Command(listCommand));
      const contents = response.Contents || [];

      for (const obj of contents) {
        const s3Key = obj.Key;
        if (!s3Key) continue;

        // Extract relative path
        const relPath = s3Key.substring(key.length).replace(/^\//, "");
        if (!relPath) continue;

        const localFilePath = path.join(localDir, relPath);
        fs.mkdirSync(path.dirname(localFilePath), { recursive: true });

        console.log(`Downloading ${s3Key} -> ${localFilePath}...`);
        
        const getRes = await s3Client.send(
          new GetObjectCommand({ Bucket: bucket, Key: s3Key })
        );
        if (getRes.Body) {
          const bytes = await getRes.Body.transformToByteArray();
          fs.writeFileSync(localFilePath, Buffer.from(bytes));
        }
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (error) {
    console.error(`[Error] Failed to download from S3: ${error}`);
    throw error;
  }
}
