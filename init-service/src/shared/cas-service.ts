import crypto from "crypto";
import fs from "fs";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3-service";
import config from "../config";
import logger from "../loaders/logger";

let storageDisabled = false;
const CAS_PREFIX = "yuvro/CAS";
const READ_CHUNK_SIZE = 1024 * 1024;

export function hashContent(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function hashFile(filePath: string): Promise<[string, number]> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    let sizeBytes = 0;

    const stream = fs.createReadStream(filePath, { highWaterMark: READ_CHUNK_SIZE });

    stream.on("data", (chunk) => {
      hash.update(chunk);
      sizeBytes += chunk.length;
    });

    stream.on("end", () => {
      resolve([hash.digest("hex"), sizeBytes]);
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

export function objectKey(contentHash: string): string {
  return `${CAS_PREFIX}/${contentHash.substring(0, 2)}/${contentHash}`;
}

function disableStorage(reason: string): void {
  if (storageDisabled) return;
  storageDisabled = true;
  logger.warn(`Disabling CAS uploads for this process: ${reason}`);
}

export async function uploadIfMissing(contentHash: string, content: Buffer): Promise<void> {
  const bucket = config.S3_BUCKET;
  if (!bucket || storageDisabled) return;

  const key = objectKey(contentHash);

  // Check if exists
  try {
    const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
    await s3Client.send(headCommand);
    return;
  } catch (error: any) {
    const code = error.name || error.$metadata?.httpStatusCode;
    if (code !== "NotFound" && error.$metadata?.httpStatusCode !== 404) {
      // Endpoint connection error or other S3 exceptions
      disableStorage(error.message || String(error));
      return;
    }
  }

  // Upload since it is missing
  try {
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
    });
    await s3Client.send(putCommand);
  } catch (error: any) {
    disableStorage(error.message || String(error));
  }
}

export async function uploadFileIfMissing(contentHash: string, filePath: string): Promise<void> {
  const bucket = config.S3_BUCKET;
  if (!bucket || storageDisabled) return;

  const key = objectKey(contentHash);

  // Check if exists
  try {
    const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
    await s3Client.send(headCommand);
    return;
  } catch (error: any) {
    const code = error.name || error.$metadata?.httpStatusCode;
    if (code !== "NotFound" && error.$metadata?.httpStatusCode !== 404) {
      disableStorage(error.message || String(error));
      return;
    }
  }

  // Upload since it is missing
  try {
    const fileStream = fs.createReadStream(filePath);
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileStream,
    });
    await s3Client.send(putCommand);
  } catch (error: any) {
    disableStorage(error.message || String(error));
  }
}
