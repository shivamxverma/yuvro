import * as dotenv from "dotenv";

dotenv.config();

export default {
  schema: "../db-schema/src/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: (process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/yuvro")
      .replace("postgresql+psycopg2://", "postgresql://")
      .replace("postgres+psycopg2://", "postgres://")
      .replace("@localhost", "@127.0.0.1"),
  },
};
