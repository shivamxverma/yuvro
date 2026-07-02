import dotenv from "dotenv";
import path from "path";
import * as yup from "yup";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const envSchema = yup.object().shape({
  S3_BUCKET: yup.string().default(""),
  AWS_ACCESS_KEY_ID: yup.string().default(""),
  AWS_SECRET_ACCESS_KEY: yup.string().default(""),
  S3_ENDPOINT: yup.string().default(""),
  ADMIN_API_TOKEN: yup.string().default(""),
  CAS_GC_ENABLED: yup.boolean().default(false),
  CAS_GC_INTERVAL_MINUTES: yup.number().integer().default(60),
  CAS_GC_GRACE_HOURS: yup.number().integer().default(168),
  CAS_GC_BATCH_SIZE: yup.number().integer().default(500),
  PORT: yup.number().integer().default(3001),
  CLIENT_ORIGINS: yup.string().default("http://localhost:5173"),
  PUBLIC_BASE_URL: yup.string().default("http://localhost:3001"),
  DATABASE_URL: yup.string().default("postgresql://postgres:postgres@localhost:5432/yuvro"),
  AUTH_COOKIE_SECURE: yup.boolean().default(false),
  ACCESS_COOKIE_NAME: yup.string().default("yuvro_access"),
  REFRESH_COOKIE_NAME: yup.string().default("yuvro_refresh"),
  ACCESS_TOKEN_TTL_MINUTES: yup.number().integer().default(15),
  REFRESH_TOKEN_TTL_DAYS: yup.number().integer().default(30),
  OAUTH_STATE_TTL_MINUTES: yup.number().integer().default(10),
  AUTH_SECRET_KEY: yup.string().default("dev-only-change-me"),
  GOOGLE_CLIENT_ID: yup.string().default(""),
  GOOGLE_CLIENT_SECRET: yup.string().default(""),
  GITHUB_CLIENT_ID: yup.string().default(""),
  GITHUB_CLIENT_SECRET: yup.string().default(""),
});

const rawEnv = {
  ...process.env,
  CAS_GC_ENABLED: process.env.CAS_GC_ENABLED === "true" || process.env.CAS_GC_ENABLED === "1",
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE === "true" || process.env.AUTH_COOKIE_SECURE === "1",
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
  CAS_GC_INTERVAL_MINUTES: process.env.CAS_GC_INTERVAL_MINUTES ? parseInt(process.env.CAS_GC_INTERVAL_MINUTES, 10) : undefined,
  CAS_GC_GRACE_HOURS: process.env.CAS_GC_GRACE_HOURS ? parseInt(process.env.CAS_GC_GRACE_HOURS, 10) : undefined,
  CAS_GC_BATCH_SIZE: process.env.CAS_GC_BATCH_SIZE ? parseInt(process.env.CAS_GC_BATCH_SIZE, 10) : undefined,
  ACCESS_TOKEN_TTL_MINUTES: process.env.ACCESS_TOKEN_TTL_MINUTES ? parseInt(process.env.ACCESS_TOKEN_TTL_MINUTES, 10) : undefined,
  REFRESH_TOKEN_TTL_DAYS: process.env.REFRESH_TOKEN_TTL_DAYS ? parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10) : undefined,
  OAUTH_STATE_TTL_MINUTES: process.env.OAUTH_STATE_TTL_MINUTES ? parseInt(process.env.OAUTH_STATE_TTL_MINUTES, 10) : undefined,
};

const validatedEnv = envSchema.validateSync(rawEnv, {
  abortEarly: false,
  stripUnknown: true,
});

// Normalize Database URL protocol
const rawDbUrl = validatedEnv.DATABASE_URL;
const databaseUrl = rawDbUrl
  .replace("postgresql+psycopg2://", "postgresql://")
  .replace("postgres+psycopg2://", "postgres://");

const allowedClientOrigins = validatedEnv.CLIENT_ORIGINS
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultClientOrigin = allowedClientOrigins[0] || "http://localhost:5173";

const googleRedirectUri = `${validatedEnv.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/google/callback`;
const githubRedirectUri = `${validatedEnv.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/github/callback`;

export const config = {
  ...validatedEnv,
  DATABASE_URL: databaseUrl,
  allowedClientOrigins,
  defaultClientOrigin,
  googleRedirectUri,
  githubRedirectUri,
};

export default config;
