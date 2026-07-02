import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNNER_ROOT = path.resolve(__dirname, "../..");

const envPath = path.join(RUNNER_ROOT, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export const BASE_DIR = process.env.BASE_DIR || path.join(RUNNER_ROOT, "workspace");
export const S3_BUCKET = process.env.S3_BUCKET || "";
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
export const S3_ENDPOINT = process.env.S3_ENDPOINT;
export const RUNNER_LOG_PATH = process.env.RUNNER_LOG_PATH || path.join(RUNNER_ROOT, "runner.log");

export function logToFile(msg: string): void {
  try {
    fs.appendFileSync(RUNNER_LOG_PATH, msg + "\n", "utf-8");
  } catch (error) {
    // Ignore file write issues
  }
}

export const config = {
  BASE_DIR,
  S3_BUCKET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
  RUNNER_LOG_PATH,
  logToFile,
};

export default config;
