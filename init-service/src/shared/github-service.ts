import os from "os";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3-service";
import config from "../config";
import logger from "../loaders/logger";

const execAsync = promisify(exec);

// Recursive folder traversal to get all files (excluding .git)
function getFilesRecursive(dir: string, baseDir: string): Array<{ localPath: string; relativePath: string }> {
  let results: Array<{ localPath: string; relativePath: string }> = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === ".git") continue;
    const localPath = path.join(dir, file);
    const stat = fs.statSync(localPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursive(localPath, baseDir));
    } else {
      results.push({
        localPath,
        relativePath: path.relative(baseDir, localPath),
      });
    }
  }
  return results;
}

export async function uploadDirectoryToS3(localDir: string, s3Prefix: string, bucket: string): Promise<number> {
  const files = getFilesRecursive(localDir, localDir);
  
  await Promise.all(
    files.map(async (file) => {
      const s3Key = `${s3Prefix}/${file.relativePath.replace(/\\/g, "/")}`;
      logger.info(`Uploading ${file.localPath} -> s3://${bucket}/${s3Key}`);
      
      const fileStream = fs.createReadStream(file.localPath);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: fileStream,
        })
      );
    })
  );

  return files.length;
}

export async function cloneGithubAndUpload(githubUrl: string, replId: string): Promise<any> {
  const bucket = config.S3_BUCKET;
  
  // Create temp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yuvro_clone_"));
  const cloneTarget = path.join(tmpDir, "repo");

  try {
    logger.info(`[Clone] Cloning ${githubUrl} into ${cloneTarget} ...`);
    
    // Execute git clone
    await execAsync(`git clone --depth 1 "${githubUrl}" "${cloneTarget}"`);
    logger.info("[Clone] Clone successful.");

    // S3 Upload
    let uploadedCount = 0;
    const s3Prefix = `yuvro/code/${replId}`;
    if (bucket) {
      try {
        uploadedCount = await uploadDirectoryToS3(cloneTarget, s3Prefix, bucket);
        logger.info(`[Clone] Uploaded ${uploadedCount} files to s3://${bucket}/${s3Prefix}/`);
      } catch (e) {
        logger.warn(`[Clone] Warning: S3 upload failed: ${e}`);
      }
    } else {
      logger.info("[Clone] S3_BUCKET is not configured, skipping S3 upload.");
    }

    // Local workspace copy
    const parentDir = path.resolve(__dirname, "../../..");
    const workspacesDir = process.env.WORKSPACES_DIR || path.join(parentDir, "workspaces");
    const localWorkspaceDir = path.join(workspacesDir, replId);
    
    fs.mkdirSync(localWorkspaceDir, { recursive: true });
    
    let localFilesCopied = 0;
    const items = fs.readdirSync(cloneTarget);
    for (const item of items) {
      if (item === ".git") continue;
      
      const src = path.join(cloneTarget, item);
      const dest = path.join(localWorkspaceDir, item);
      const stat = fs.statSync(src);
      
      if (stat.isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
        localFilesCopied++;
      } else {
        fs.copyFileSync(src, dest);
        localFilesCopied++;
      }
    }

    logger.info(`[Clone] Copied cloned project files directly to local workspace directory: ${localWorkspaceDir}`);
    return {
      status: "cloned",
      files_uploaded: uploadedCount,
      s3_prefix: bucket ? s3Prefix : "",
      local_files_copied: localFilesCopied,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      logger.info(`[Clone] Cleaned up temp directory ${tmpDir}`);
    } catch (e) {
      // Ignore cleanup error
    }
  }
}
