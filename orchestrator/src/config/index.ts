import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import * as yup from "yup";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const BASE_DIR = path.resolve(__dirname, "../../..");

const configSchema = yup.object().shape({
  WORKSPACES_DIR: yup.string().default(path.join(BASE_DIR, "workspaces")),
  RUNNER_ENV_PATH: yup.string().default(path.join(BASE_DIR, "runner", ".env")),
  RUNNER_IMAGE: yup.string().default("yuvro-runner:latest"),
  RUNNER_IMAGE_PULL_POLICY: yup.string().default("IfNotPresent"),
  RUNNER_INTERNAL_PORT: yup.number().integer().default(3002),
  USER_INTERNAL_PORT: yup.number().integer().default(8000),
  K8S_NAMESPACE: yup.string().default("yuvro"),
  K8S_CONTEXT: yup.string().nullable().optional(),
  K8S_BASE_DOMAIN: yup.string().default("127.0.0.1.nip.io"),
  K8S_INGRESS_SCHEME: yup.string().default("http"),
  K8S_INGRESS_PORT: yup.number().integer().default(8080),
  K8S_WORKSPACE_ROOT: yup.string().default("/workspaces-host"),
  POSTGRES_IMAGE: yup.string().default("postgres:15"),
  MYSQL_IMAGE: yup.string().default("mysql:8.0"),
  K8S_DB_STORAGE_SIZE: yup.string().default("5Gi"),
  K8S_DB_STORAGE_CLASS: yup.string().nullable().optional(),
  K8S_DB_READY_TIMEOUT_SECONDS: yup.number().integer().default(90),
  PORT: yup.number().integer().default(3002),
});

const rawEnv = {
  ...process.env,
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
  K8S_INGRESS_PORT: process.env.K8S_INGRESS_PORT ? parseInt(process.env.K8S_INGRESS_PORT, 10) : undefined,
  K8S_DB_READY_TIMEOUT_SECONDS: process.env.K8S_DB_READY_TIMEOUT_SECONDS ? parseInt(process.env.K8S_DB_READY_TIMEOUT_SECONDS, 10) : undefined,
};

export const config = configSchema.validateSync(rawEnv, {
  abortEarly: false,
  stripUnknown: true,
});

export function generateSecretValue(length = 24): string {
  // Generates urlsafe token matching secrets.token_urlsafe
  return crypto.randomBytes(length).toString("base64url");
}

export function getRunnerEnv(): Record<string, string> {
  const envVars: Record<string, string> = {};

  if (fs.existsSync(config.RUNNER_ENV_PATH)) {
    try {
      const content = fs.readFileSync(config.RUNNER_ENV_PATH, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const index = trimmed.indexOf("=");
          const key = trimmed.substring(0, index).trim();
          const val = trimmed.substring(index + 1).trim();
          envVars[key] = val;
        }
      }
    } catch (e) {
      console.warn(`[Config] Warning: Failed to read runner/.env: ${e}`);
    }
  }

  const keysToPropagate = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "S3_BUCKET",
    "AWS_REGION",
    "S3_ENDPOINT",
  ];

  for (const key of keysToPropagate) {
    const val = process.env[key];
    if (val) {
      envVars[key] = val;
    }
  }

  return envVars;
}

export default config;
